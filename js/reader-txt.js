/* ============================================================
 * reader-txt.js — TXT 阅读模式（编码解码、章节解析、划线）
 * 依赖：reader.js（Reader 类）、config.js（CosmosConfig）
 * ============================================================ */
(function (global) {
  'use strict';

  const Reader = global.Reader;
  const TXT_PREFIX = CosmosConfig.TXT_PREFIX;
  const HL_COLORS = CosmosConfig.HL_COLORS;
  const TXT_VIRTUAL_THRESHOLD = CosmosConfig.TXT_VIRTUAL_THRESHOLD;

  function parseTxt(text) {
    const lines = text.split(/\r?\n/);
    const chapterRe = /^\s*(第[零一二三四五六七八九十百千万两0-9０-９]{1,5}[章节回卷部篇集幕話編]|序章|序言|前言|楔子|引子|尾声|终章|后记|跋|プロローグ|エピローグ|あとがき|前書き|はじめに|終章)[\s：:、.．\-—]*/;
    const chapters = [];
    let cur = null;
    let para = [];
    const flushPara = () => {
      const pt = para.join('').replace(/\s+/g, ' ').trim();
      if (pt) {
        if (!cur) { cur = { title: t('book.body'), paras: [] }; chapters.push(cur); }
        cur.paras.push(pt);
      }
      para = [];
    };
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { flushPara(); continue; }
      if (chapterRe.test(line) && line.length <= 40) {
        flushPara();
        cur = { title: line, paras: [] };
        chapters.push(cur);
        continue;
      }
      para.push(raw);
    }
    flushPara();
    if (!chapters.length) chapters.push({ title: t('book.body'), paras: [] });
    return chapters;
  }


  Object.assign(Reader.prototype, {

    _openTxt(arrayBuffer, percent) {
      const text = decodeTxt(arrayBuffer);
      const chapters = parseTxt(text);

      // 超大 TXT → 虚拟化渲染（只渲染视口附近段落，滚动增删，避免卡死）
      let paraCount = 0;
      for (const ch of chapters) paraCount += ch.paras.length;
      if (paraCount > TXT_VIRTUAL_THRESHOLD) {
        this._openTxtVirtual(chapters, percent);
        return;
      }

      const container = document.createElement('div');
      container.className = 'txt-reader';

      const content = document.createElement('div');
      content.className = 'txt-content';

      chapters.forEach((ch, i) => {
        const section = document.createElement('section');
        section.className = 'txt-chapter';
        section.dataset.index = i;
        const h = document.createElement('h2');
        h.className = 'txt-chapter-title';
        h.textContent = ch.title;
        section.appendChild(h);
        ch.paras.forEach((p) => {
          const el = document.createElement('p');
          el.className = 'txt-para';
          // 过长制表符会撑出超宽空白，替换为普通空格
          el.textContent = p.replace(/\t/g, ' ');
          section.appendChild(el);
        });
        content.appendChild(section);
      });

      container.appendChild(content);
      this.el.appendChild(container);

      this.txt = { chapters, container, content };

      // 滚动进度
      this._txtScroll = () => this._updateTxtProgress();
      container.addEventListener('scroll', this._txtScroll, { passive: true });
      window.addEventListener('resize', (this._onResize = () => this._updateTxtProgress()));

      this._applyTxtAppearance();

      // 触摸水平滑动翻页
      this._bindTouchSwipe(container);

      // 选中文本 → 划线（TXT）
      this._txtSelHandler = () => {
        if (this.mode !== 'txt' || !this.txt || !this.onSelectedText) return;
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        if (!node || !this.txt.container.contains(node)) return;
        const el = node.nodeType === 3 ? node.parentElement : node;
        const para = el && el.closest ? el.closest('.txt-para') : null;
        if (!para) return;
        let ci, pi;
        if (this.txt.virtual) {
          const idx = parseInt(para.dataset.item, 10);
          const it = idx >= 0 ? this.txt.virtual.items[idx] : null;
          if (!it) return;
          ci = it.ci; pi = it.pi;
        } else {
          const sec = para.closest('.txt-chapter');
          ci = sec ? parseInt(sec.dataset.index, 10) : 0;
          pi = Array.prototype.indexOf.call(sec ? sec.querySelectorAll('.txt-para') : [], para);
        }
        const off = this._rangeOffsetsInPara(range, para);
        this.onSelectedText(TXT_PREFIX + ci + ':' + pi + ':' + off.start + ':' + off.end, para.textContent.trim().replace(/\s+/g, ' ').slice(0, 120), false);
      };
      document.addEventListener('selectionchange', this._txtSelHandler);

      // 恢复进度
      if (typeof percent === 'number' && isFinite(percent)) {
        this.goToPercent(percent);
      } else {
        this._updateTxtProgress();
      }
    }

    /* ---------- TXT 虚拟化（超大文件） ---------- */
,

    _findCenterPara() {
      if (this.txt && this.txt.virtual) {
        const v = this.txt.virtual;
        const idx = this._virtCenterItem();
        return v.content.querySelector('.txt-para[data-item="' + idx + '"]') || null;
      }
      const c = this.txt.container;
      const center = c.scrollTop + c.clientHeight / 2;
      const paras = c.querySelectorAll('.txt-para');
      let best = null;
      let bestDist = Infinity;
      for (const p of paras) {
        const r = p.getBoundingClientRect();
        const pcenter = (r.top + r.bottom) / 2;
        const dist = Math.abs(pcenter - center);
        if (dist < bestDist) { bestDist = dist; best = p; }
      }
      return best;
    }
,

    _updateTxtProgress() {
      const c = this.txt.container;
      if (this.txt.virtual) {
        const v = this.txt.virtual;
        const max = Math.max(0, v.total - c.clientHeight);
        let percent = max > 0 ? (c.scrollTop / max) * 100 : 0;
        percent = Math.min(100, Math.max(0, percent));
        this.txt.percent = percent;
        const it = v.items[this._virtCenterItem()];
        if (it && it.ci != null && it.pi >= 0) this.currentCfi = TXT_PREFIX + it.ci + ':' + it.pi;
        else this.currentCfi = TXT_PREFIX + Math.round(percent);
        this.onProgress({ cfi: this.currentCfi, percent });
        return;
      }
      const max = c.scrollHeight - c.clientHeight;
      let percent = max > 0 ? (c.scrollTop / max) * 100 : 0;
      percent = Math.min(100, Math.max(0, percent));
      this.txt.percent = percent;

      // 视口中心段落 → 精确书签定位 cfi
      const p = this._findCenterPara();
      if (p) {
        const sec = p.closest('.txt-chapter');
        const ci = sec ? parseInt(sec.dataset.index, 10) : 0;
        const pi = Array.prototype.indexOf.call(sec ? sec.querySelectorAll('.txt-para') : [], p);
        this.currentCfi = TXT_PREFIX + ci + ':' + pi;
      } else {
        this.currentCfi = TXT_PREFIX + Math.round(percent);
      }
      this.onProgress({ cfi: this.currentCfi, percent });
    }
,

    _goToTxtCfi(cfi, highlight) {
      if (!cfi || !cfi.startsWith(TXT_PREFIX)) return;
      if (this.txt.virtual) { this._goToTxtCfiVirtual(cfi, highlight); return; }
      const rest = cfi.slice(TXT_PREFIX.length);

      // 章节定位：txt:c:<chapterIndex>
      if (rest.startsWith('c:')) {
        const secIndex = parseInt(rest.slice(2), 10);
        const sections = this.txt.content.querySelectorAll('.txt-chapter');
        const section = sections[secIndex];
        if (section) {
          const container = this.txt.container;
          const top = section.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
          container.scrollTo({ top, behavior: 'smooth' });
          if (highlight) this._flashTxt(section);
        }
        return;
      }

      // 纯百分比形式：txt:<percent>
      if (rest.indexOf(':') === -1) {
        const p = parseFloat(rest);
        if (!isNaN(p)) { this.goToPercent(p); return; }
      }

      // 段落定位：txt:<chapterIndex>:<paraIndex>
      const parts = rest.split(':');
      const secIndex = parseInt(parts[0], 10);
      const paraIndex = parts.length > 1 ? parseInt(parts[1], 10) : -1;
      const sections = this.txt.content.querySelectorAll('.txt-chapter');
      const section = sections[secIndex];
      if (!section) return;
      let target = section;
      if (paraIndex >= 0) {
        const paras = section.querySelectorAll('.txt-para');
        if (paras[paraIndex]) target = paras[paraIndex];
      }
      // 显式滚动 .txt-reader 容器（scrollIntoView 可能滚错容器）
      const container = this.txt.container;
      const top = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      container.scrollTo({ top, behavior: 'smooth' });
      if (highlight) this._flashTxt(target);
    }
,

    _flashTxt(el) {
      el.classList.add('txt-highlight');
      setTimeout(() => el.classList.remove('txt-highlight'), 2200);
    }

    /* ================= 翻页 / 跳转 ================= */,

    _searchTxt(query) {
      if (!this.txt || !query) return [];
      const q = query.toLowerCase();
      const results = [];
      this.txt.chapters.forEach((ch, ci) => {
        ch.paras.forEach((p, pi) => {
          const idx = p.toLowerCase().indexOf(q);
          if (idx > -1) {
            const s = Math.max(0, idx - 20);
            const excerpt = (s > 0 ? '…' : '') + p.slice(s, idx + q.length + 40) + '…';
            results.push({ cfi: TXT_PREFIX + ci + ':' + pi, excerpt });
          }
        });
      });
      return results;
    }

    /** PDF 全文搜索（按页提取文本） */,

    _clearTxtParaMarks(para) {
      para.querySelectorAll('.txt-hl').forEach((m) => {
        const parent = m.parentNode;
        parent.replaceChild(document.createTextNode(m.textContent), m);
        parent.normalize();
      });
      para.style.background = '';
    }

    /** 用 mark 包裹段落中 [s,e) 范围的文字并上色 */,

    _markTxtRange(para, s, e, color) {
      const rgba = HL_COLORS[color] || hexToRgba(color, 0.45) || HL_COLORS.yellow;
      const textNodes = [];
      const walker = document.createTreeWalker(para, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      let pos = 0;
      for (const node of textNodes) {
        const len = node.nodeValue.length;
        const nodeStart = pos;
        const nodeEnd = pos + len;
        pos = nodeEnd;
        if (nodeEnd <= s || nodeStart >= e) continue;
        const cutS = Math.max(s, nodeStart) - nodeStart;
        const cutE = Math.min(e, nodeEnd) - nodeStart;
        if (cutS >= cutE) continue;
        const mark = document.createElement('mark');
        mark.className = 'txt-hl';
        mark.style.background = rgba;
        mark.style.borderRadius = '3px';
        const hl = node.splitText(cutS);
        hl.splitText(cutE - cutS);
        hl.parentNode.replaceChild(mark, hl);
        mark.appendChild(hl);
      }
      para.normalize();
    }
,

    _applyTxtHighlight(cfi, color) {
      const parts = cfi && cfi.indexOf(TXT_PREFIX) === 0 ? cfi.slice(TXT_PREFIX.length).split(':') : [];
      const ci = parseInt(parts[0], 10);
      const pi = parseInt(parts[1], 10);
      const s = parts.length >= 4 ? parseInt(parts[2], 10) : null;
      const e = parts.length >= 4 ? parseInt(parts[3], 10) : null;
      if (this.txt.virtual) {
        const v = this.txt.virtual;
        if (v.chapterStart[ci] == null || pi < 0) return;
        const idx = v.chapterStart[ci] + 1 + pi;
        if (idx >= v.items.length) return;
        const colorVal = color || 'yellow';
        const el = v.content.querySelector('.txt-para[data-item="' + idx + '"]');
        if (el) {
          this._clearTxtParaMarks(el);
          el.classList.remove('txt-hl');
          if (s == null || e == null || s >= e) {
            el.classList.add('txt-hl');
            el.style.background = HL_COLORS[colorVal] || hexToRgba(colorVal, 0.45) || HL_COLORS.yellow;
          } else {
            this._markTxtRange(el, s, e, colorVal);
          }
        } else {
          v.pendingHl.set(idx, { color: colorVal, s, e });
        }
        return;
      }
      const sec = this.txt.content.querySelectorAll('.txt-chapter')[ci];
      const para = sec ? sec.querySelectorAll('.txt-para')[pi] : null;
      if (!para) return;
      // 先清除该段已有划线标记
      this._clearTxtParaMarks(para);
      para.classList.remove('txt-hl');
      const colorVal = color || 'yellow';
      if (s == null || e == null || s >= e) {
        // 旧格式或无偏移：整段划线（inline 上色）
        para.classList.add('txt-hl');
        para.style.background = HL_COLORS[colorVal] || hexToRgba(colorVal, 0.45) || HL_COLORS.yellow;
        return;
      }
      this._markTxtRange(para, s, e, colorVal);
    }
,

    _removeTxtHighlight(cfi) {
      const parts = cfi && cfi.indexOf(TXT_PREFIX) === 0 ? cfi.slice(TXT_PREFIX.length).split(':') : [];
      const ci = parseInt(parts[0], 10);
      const pi = parseInt(parts[1], 10);
      if (this.txt.virtual) {
        const v = this.txt.virtual;
        if (v.chapterStart[ci] == null || pi < 0) return;
        const idx = v.chapterStart[ci] + 1 + pi;
        v.pendingHl.delete(idx);
        const el = v.content.querySelector('.txt-para[data-item="' + idx + '"]');
        if (el) {
          el.classList.remove('txt-hl');
          this._clearTxtParaMarks(el);
        }
        return;
      }
      const sec = this.txt.content.querySelectorAll('.txt-chapter')[ci];
      const para = sec ? sec.querySelectorAll('.txt-para')[pi] : null;
      if (para) {
        para.classList.remove('txt-hl');
        this._clearTxtParaMarks(para);
      }
    }

    /** 提取当前视口中心的正文文本（书签文字） */,

    _applyTxtAppearance() {
      const s = this.settings;
      const content = this.txt.content;
      content.style.fontSize = (s.fontSize || 18) + 'px';
      content.style.lineHeight = String(s.lineHeight || 1.8);
      const margin = (typeof s.margin === 'number' ? s.margin : 4);
      content.style.paddingLeft = margin + 'vw';
      content.style.paddingRight = margin + 'vw';
      const res = this._resolveFont(s.fontFamily);
      content.style.fontFamily = res ? res.family : '';
      this._applyCustomColors();
      // 虚拟化：字号/行距/留白/字体变化会改变段落高度 → 重建虚拟布局
      if (this.txt && this.txt.virtual) this._rebuildTxtVirtualLayout();
    }

  });
})(window);
