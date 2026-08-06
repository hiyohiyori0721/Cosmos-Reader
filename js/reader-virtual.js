/* ============================================================
 * reader-virtual.js — 超大 TXT 虚拟化渲染（窗口渲染/回收/校准）
 * 依赖：reader.js（Reader 类）、config.js（CosmosConfig）
 * ============================================================ */
(function (global) {
  'use strict';

  const Reader = global.Reader;
  const TXT_PREFIX = CosmosConfig.TXT_PREFIX;
  const HL_COLORS = CosmosConfig.HL_COLORS;

  Object.assign(Reader.prototype, {

    _openTxtVirtual(chapters, percent) {
      const container = document.createElement('div');
      container.className = 'txt-reader';
      const content = document.createElement('div');
      content.className = 'txt-content txt-virtual';
      container.appendChild(content);
      this.el.appendChild(container);

      // 扁平化所有段落（章节标题也是一个 item）
      const items = [];
      const chapterStart = [];
      chapters.forEach((ch, ci) => {
        chapterStart[ci] = items.length;
        items.push({ ci, pi: -1, text: ch.title, isTitle: true });
        for (let pi = 0; pi < ch.paras.length; pi++) items.push({ ci, pi, text: ch.paras[pi], isTitle: false });
      });

      const v = { items, chapterStart, heights: [], offs: [], rendered: new Set(), pendingHl: new Map(), total: 0, bufStart: 0, bufEnd: -1, content };
      this.txt = { chapters, container, content, virtual: v };

      // 初始估算高度 + 累积偏移
      let y = 0;
      for (let i = 0; i < items.length; i++) {
        const h = this._estTxtHeight(i);
        v.heights[i] = h;
        v.offs[i] = y;
        y += h;
      }
      v.total = y;
      content.style.height = y + 'px';

      // 滚动进度
      this._txtScroll = () => { this._updateTxtVirtual(); this._updateTxtProgress(); };
      container.addEventListener('scroll', this._txtScroll, { passive: true });
      window.addEventListener('resize', (this._onResize = () => {
        if (this.txt && this.txt.virtual) this._rebuildTxtVirtualLayout();
        else this._updateTxtProgress();
      }));

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
        const idx = parseInt(para.dataset.item, 10);
        const it = idx >= 0 ? v.items[idx] : null;
        if (!it) return;
        const off = this._rangeOffsetsInPara(range, para);
        this.onSelectedText(TXT_PREFIX + it.ci + ':' + it.pi + ':' + off.start + ':' + off.end, para.textContent.trim().replace(/\s+/g, ' ').slice(0, 120), false);
      };
      document.addEventListener('selectionchange', this._txtSelHandler);

      // 恢复进度
      if (typeof percent === 'number' && isFinite(percent)) {
        this.goToPercent(percent);
      } else {
        this._updateTxtVirtual();
        this._updateTxtProgress();
      }
    }

    /** 估算某 item 高度（未渲染时占位用；渲染后以实测高度校准） */,

    _estTxtHeight(i) {
      const v = this.txt.virtual;
      const it = v.items[i];
      const s = this.settings;
      const fs = s.fontSize || 18;
      const lh = s.lineHeight || 1.8;
      const lineH = fs * lh;
      if (it.isTitle) return Math.round(lineH * 1.6 + fs * 0.8);
      const cw = this.txt.container.clientWidth || 375;
      const margin = (typeof s.margin === 'number' ? s.margin : 4);
      const innerW = Math.max(50, cw * (1 - margin * 2 / 100));
      const charsPerLine = Math.max(1, Math.floor(innerW / fs));
      let w = 0;
      for (let k = 0; k < it.text.length; k++) w += (it.text.charCodeAt(k) < 128 ? 0.62 : 1);
      const lines = Math.max(1, Math.ceil(w / charsPerLine));
      return Math.round(lines * lineH + fs * 0.6);
    }

    /** 重建累积偏移（from 起）+ 总高度 */,

    _rebuildTxtOffsets(from) {
      const v = this.txt.virtual;
      let y = from === 0 ? 0 : v.offs[from];
      for (let i = from; i < v.items.length; i++) {
        v.offs[i] = y;
        y += v.heights[i];
      }
      v.total = y;
      v.content.style.height = y + 'px';
    }

    /** 校准后同步已渲染 item 的绝对定位 top */,

    _syncTxtVirtualTops() {
      const v = this.txt.virtual;
      for (const i of v.rendered) {
        const el = v.content.querySelector('.txt-para[data-item="' + i + '"], .txt-chapter-title[data-item="' + i + '"]');
        if (el) el.style.top = v.offs[i] + 'px';
      }
    }

    /** 二分：y 偏移处对应的 item 索引 */,

    _virtIndexAt(y) {
      const v = this.txt.virtual;
      const offs = v.offs;
      const n = offs.length;
      if (!n) return 0;
      if (y <= offs[0]) return 0;
      if (y >= offs[n - 1] + v.heights[n - 1]) return n - 1;
      let lo = 0, hi = n - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (offs[mid] <= y) lo = mid; else hi = mid - 1;
      }
      return lo;
    }

    /** 渲染单个虚拟 item（绝对定位；返回 true 表示实测高度与估算偏差需校准） */,

    _renderTxtVirtualItem(i) {
      const v = this.txt.virtual;
      const it = v.items[i];
      const el = document.createElement(it.isTitle ? 'h2' : 'p');
      el.className = it.isTitle ? 'txt-chapter-title' : 'txt-para';
      el.dataset.item = i;
      el.textContent = it.isTitle ? it.text : it.text.replace(/\t/g, ' ');
      el.style.position = 'absolute';
      el.style.top = v.offs[i] + 'px';
      el.style.left = '0';
      el.style.right = '0';
      el.style.margin = '0';
      v.content.appendChild(el);
      v.rendered.add(i);
      // 待处理划线（该 item 尚未渲染时记录的高亮）
      if (v.pendingHl && v.pendingHl.has(i)) {
        const ph = v.pendingHl.get(i);
        if (ph.s == null || ph.s >= ph.e) {
          el.classList.add('txt-hl');
          el.style.background = HL_COLORS[ph.color] || hexToRgba(ph.color, 0.45) || HL_COLORS.yellow;
        } else {
          this._markTxtRange(el, ph.s, ph.e, ph.color);
        }
        v.pendingHl.delete(i);
      }
      // 实测高度校准
      const actual = el.offsetHeight;
      if (actual > 0 && Math.abs(actual - v.heights[i]) > 1) {
        v.heights[i] = actual;
        return true;
      }
      return false;
    }

    /** 移除窗口外虚拟 item */,

    _removeTxtVirtualItem(i) {
      const v = this.txt.virtual;
      const el = v.content.querySelector('.txt-para[data-item="' + i + '"], .txt-chapter-title[data-item="' + i + '"]');
      if (el) el.remove();
      v.rendered.delete(i);
    }

    /** 滚动时维护渲染窗口：渲染视口附近 items，回收远处 items */,

    _updateTxtVirtual() {
      const v = this.txt.virtual;
      if (!v) return;
      const c = this.txt.container;
      const start = Math.max(0, this._virtIndexAt(c.scrollTop) - 12);
      const end = Math.min(v.items.length - 1, this._virtIndexAt(c.scrollTop + c.clientHeight) + 12);
      let firstChanged = -1;
      for (let i = start; i <= end; i++) {
        if (!v.rendered.has(i)) {
          if (this._renderTxtVirtualItem(i) && firstChanged < 0) firstChanged = i;
        }
      }
      if (firstChanged >= 0) {
        this._rebuildTxtOffsets(firstChanged + 1);
        this._syncTxtVirtualTops();
      }
      const rm = [];
      for (const i of v.rendered) {
        if (i < start - 40 || i > end + 40) rm.push(i);
      }
      for (const i of rm) this._removeTxtVirtualItem(i);
      v.bufStart = start;
      v.bufEnd = end;
    }

    /** 滚动到虚拟内容中的 y 偏移（先渲染目标附近校准，再滚动） */,

    _scrollTxtToVirtual(y, smooth) {
      const v = this.txt.virtual;
      if (!v) return;
      const idx = this._virtIndexAt(y);
      const lo = Math.max(0, idx - 8);
      const hi = Math.min(v.items.length - 1, idx + 8);
      let firstChanged = -1;
      for (let i = lo; i <= hi; i++) {
        if (!v.rendered.has(i)) {
          if (this._renderTxtVirtualItem(i) && firstChanged < 0) firstChanged = i;
        }
      }
      if (firstChanged >= 0) {
        this._rebuildTxtOffsets(firstChanged + 1);
        this._syncTxtVirtualTops();
      }
      const c = this.txt.container;
      const top = v.offs[idx];
      if (smooth) {
        c.scrollTo({ top, behavior: 'smooth' });
        // 兼容 rAF 冻结环境（嵌入式浏览器）：smooth 未滚动时回退到直接定位
        const startTop = c.scrollTop;
        setTimeout(() => {
          if (this.txt && this.txt.virtual && c.scrollTop === startTop) c.scrollTop = top;
        }, 250);
      } else {
        c.scrollTop = top;
      }
      this._updateTxtVirtual();
      this._updateTxtProgress();
    }

    /** 外观/宽度变化后重建虚拟布局（重新估算高度，保持阅读百分比） */,

    _rebuildTxtVirtualLayout() {
      const v = this.txt.virtual;
      if (!v) return;
      const c = this.txt.container;
      const max = Math.max(0, v.total - c.clientHeight);
      const percent = max > 0 ? c.scrollTop / max : 0;
      v.content.innerHTML = '';
      v.rendered.clear();
      let y = 0;
      for (let i = 0; i < v.items.length; i++) {
        const h = this._estTxtHeight(i);
        v.heights[i] = h;
        v.offs[i] = y;
        y += h;
      }
      v.total = y;
      v.content.style.height = y + 'px';
      const m = Math.max(0, y - c.clientHeight);
      c.scrollTop = m * percent;
      this._updateTxtVirtual();
      this._updateTxtProgress();
    }

    /** 虚拟模式：定位 cfi */,

    _goToTxtCfiVirtual(cfi, highlight) {
      if (!cfi || !cfi.startsWith(TXT_PREFIX)) return;
      const v = this.txt.virtual;
      const rest = cfi.slice(TXT_PREFIX.length);
      let idx = -1;
      if (rest.startsWith('c:')) {
        idx = v.chapterStart[parseInt(rest.slice(2), 10)];
      } else if (rest.indexOf(':') === -1) {
        const p = parseFloat(rest);
        if (!isNaN(p)) { this.goToPercent(p); return; }
      } else {
        const parts = rest.split(':');
        const ci = parseInt(parts[0], 10);
        const pi = parts.length > 1 ? parseInt(parts[1], 10) : -1;
        if (v.chapterStart[ci] == null) return;
        idx = pi >= 0 ? v.chapterStart[ci] + 1 + pi : v.chapterStart[ci];
      }
      if (idx < 0 || idx >= v.items.length) return;
      this._scrollTxtToVirtual(v.offs[idx], true);
      if (highlight) {
        const el = v.content.querySelector('.txt-para[data-item="' + idx + '"], .txt-chapter-title[data-item="' + idx + '"]');
        if (el) this._flashTxt(el);
      }
    }

    /** 虚拟模式：中心 item 索引 */,

    _virtCenterItem() {
      const v = this.txt.virtual;
      return this._virtIndexAt(this.txt.container.scrollTop + this.txt.container.clientHeight / 2);
    }

    /** 返回最接近视口中心的段落元素 */
  });
})(window);
