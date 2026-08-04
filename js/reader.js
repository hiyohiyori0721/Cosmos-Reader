/* ============================================================
 * reader.js — 阅读器核心
 * 支持两种模式：
 *   - epub：基于 epub.js（分页/滚动、CFI 定位）
 *   - txt ：纯文本阅读（滚动渲染、编码检测、章节解析）
 * 负责：加载、渲染、翻页、进度、目录、搜索、外观、书签交互
 * ============================================================ */
(function (global) {
  'use strict';

  const TXT_PREFIX = 'txt:';
  const PDF_PREFIX = 'pdf:';
  const HL_COLORS = {
    yellow: 'rgba(255, 208, 0, 0.45)',
    green: 'rgba(76, 175, 80, 0.45)',
    blue: 'rgba(66, 133, 244, 0.45)',
  };

  /* ---------- TXT 工具 ---------- */
  function decodeTxt(buffer) {
    const bytes = new Uint8Array(buffer);
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return new TextDecoder('utf-8').decode(bytes.subarray(3));
    }
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return new TextDecoder('utf-16le').decode(bytes.subarray(2));
    }
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
      return new TextDecoder('utf-16be').decode(bytes.subarray(2));
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
      try { return new TextDecoder('gbk').decode(bytes); }
      catch (e2) { return new TextDecoder('utf-8').decode(bytes); }
    }
  }

  function parseTxt(text) {
    const lines = text.split(/\r?\n/);
    const chapterRe = /^\s*(第[零一二三四五六七八九十百千万两0-9０-９]{1,5}[章节回卷部篇集]|序章|序言|前言|楔子|引子|尾声|终章|后记|跋)[\s：:、.．\-—]*/;
    const chapters = [];
    let cur = null;
    let para = [];
    const flushPara = () => {
      const t = para.join('').replace(/\s+/g, ' ').trim();
      if (t) {
        if (!cur) { cur = { title: '正文', paras: [] }; chapters.push(cur); }
        cur.paras.push(t);
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
    if (!chapters.length) chapters.push({ title: '正文', paras: [] });
    return chapters;
  }

  class Reader {
    /**
     * @param {Object} opts
     * @param {HTMLElement} opts.el 渲染容器
     * @param {Object} opts.settings 外观设置
     * @param {Function} opts.onProgress 进度回调 { cfi, percent }
     * @param {Function} opts.onChapter 章节回调 { label, href }
     */
    constructor(opts) {
      this.el = opts.el;
      this.settings = opts.settings || {};
      this.onProgress = opts.onProgress || function () {};
      this.onChapter = opts.onChapter || function () {};
      this.onToggleBars = opts.onToggleBars || function () {};
      this.getFont = opts.getFont || null;   // (id) => { family, url, format } | null
      this.onSelectedText = opts.onSelectedText || null; // (cfi, text, clear) => void
      this.mode = 'epub';          // 'epub' | 'txt'
      this.book = null;
      this.rendition = null;
      this.locations = null;
      this.txt = null;             // { chapters, container, content }
      this.pdf = null;             // { container, pages, renderedTo, current, numPages, textCache, pdf }
      this.currentCfi = null;
      this._busy = false;
      this._onResize = null;
      this._txtScroll = null;
      this._txtSelHandler = null;
      this._hlList = [];
    }

    /* ================= 打开 ================= */
    /**
     * @param {ArrayBuffer} arrayBuffer 书籍数据
     * @param {Object|string} opts { type:'epub'|'txt', cfi, percent } 或旧式 cfi 字符串
     */
    async open(arrayBuffer, opts) {
      if (typeof opts === 'string') opts = { cfi: opts };
      opts = opts || {};
      this.destroy();
      if (opts.type === 'txt') {
        this.mode = 'txt';
        this._openTxt(arrayBuffer, opts.percent);
        return;
      }
      if (opts.type === 'pdf') {
        this.mode = 'pdf';
        await this._openPdf(arrayBuffer, opts.page);
        return;
      }
      this.mode = 'epub';
      await this._openEpub(arrayBuffer, opts.cfi);
    }

    /* ---------- EPUB ---------- */
    async _openEpub(arrayBuffer, cfi) {
      this.book = ePub(arrayBuffer);
      await this.book.ready;
      this.locations = this.book.locations;

      this.rendition = this.book.renderTo(this.el, {
        width: '100%',
        height: '100%',
        spread: 'auto',
        flow: this.settings.flow || 'paginated',
      });

      this._bindRendition();
      this._applyAppearance();
      await this.rendition.display(cfi || undefined);

      // 位置生成放后台，不阻塞首次渲染
      this._generateLocations();
    }

    /** 后台生成阅读位置（进度计算用），不阻塞显示 */
    async _generateLocations() {
      if (!this.book || !this.book.locations) return;
      try {
        // locations.generate 依赖 requestAnimationFrame，
        // 后台标签页下 rAF 不触发，因此加超时保护避免挂起
        await Promise.race([
          this.book.locations.generate(800),
          new Promise((resolve) => setTimeout(resolve, 4000)),
        ]);
      } catch (e) {
        // 位置生成失败时使用章节粗略进度
      }
      // 位置就绪后刷新当前进度（打开时 relocated 可能因位置未生成而显示近似值）
      try {
        const locs = this.book.locations;
        if (locs && locs._locations && locs._locations.length) {
          if (this.settings.flow === 'scrolled') {
            // 滚动模式：基于当前滚动位置重新计算准确进度
            this._lastScrollUpdate = 0;
            this._updateScrolledProgress();
          } else if (this.currentCfi) {
            const p = locs.percentageFromCfi(this.currentCfi) * 100;
            this.onProgress({ cfi: this.currentCfi, percent: Math.min(100, Math.max(0, p)) });
          }
        }
      } catch (_) {}
    }

    _bindRendition() {
      const r = this.rendition;
      r.on('relocated', (loc) => this._onRelocated(loc));
      r.on('rendered', () => {
        this._attachClickZones();
        this._applyEpubMargin();
        this._applyEpubFont();
        this._applyHls();
        this._bindScrolledProgress();
      });
      r.on('keyup', (e) => this._onKey(e));
      r.on('selected', (cfi) => {
        if (this.onSelectedText && cfi) {
          this._getTextByCfi(cfi).then((text) => {
            this.onSelectedText(cfi, text || this.getCurrentText(), false);
          });
        }
      });
      window.addEventListener('resize', (this._onResize = () => {
        try { r.resize(); } catch (_) {}
      }));
    }

    /** 应用 EPUB 左右留白（基于可见容器宽度换算固定 px，避免分页多列布局下 vw 循环放大） */
    _applyEpubMargin() {
      if (this.mode !== 'epub' || !this.el) return;
      try {
        const px = this._marginPx(this.settings.margin);
        this.el.querySelectorAll('iframe').forEach((iframe) => {
          const doc = iframe.contentDocument;
          if (!doc || !doc.head) return;
          this._injectMarginStyle(doc, px);
          // 观察 body style 变化：epub.js 重置时用当前设置重新注入
          if (doc.body && !doc.body._readerMarginObs) {
            const obs = new MutationObserver(() => {
              this._injectMarginStyle(doc, this._marginPx(this.settings.margin));
            });
            obs.observe(doc.body, { attributes: true, attributeFilter: ['style'] });
            doc.body._readerMarginObs = obs;
          }
        });
      } catch (_) {}
    }

    /** 按可见容器宽度换算留白为固定像素（防 vw 循环） */
    _marginPx(m) {
      const pct = (typeof m === 'number' ? m : 4);
      const el = this.el;
      const base = el && el.clientWidth > 0 ? el.clientWidth : 375;
      return Math.max(0, Math.round(base * pct / 100));
    }

    _injectMarginStyle(doc, px) {
      let style = doc.getElementById('reader-margin-style');
      if (!style) {
        style = doc.createElement('style');
        style.id = 'reader-margin-style';
        doc.head.appendChild(style);
      }
      // 分页模式下不能给 body 加 padding：epub.js 的翻页 delta = columnWidth（不含 gap），
      // 它的原始设计是 body padding 15px 使内容区=345、实际列宽=345、gap=30，
      // 列占位 345+30=375 恰好等于 delta，翻页才不会错位。
      // 若把 body padding 改成 0，实际列宽变 375，列占位 375+30=405≠375，每翻一页错位 30px（文字错位）。
      // 因此这里保持 body padding=0 的同时把 column-gap 也设为 0：
      // 实际列宽=375、gap=0 → 列占位 375 = delta，翻页对齐。
      // 留白通过给块级内容加左右 margin 实现，不改变列布局。
      const sel = 'p, div, h1, h2, h3, h4, h5, h6, li, blockquote, dl, dd, ul, ol, section, article, figure, pre';
      style.textContent =
        sel + ' { margin-left: ' + px + 'px !important; margin-right: ' + px + 'px !important; }\n' +
        'body { padding-left: 0px !important; padding-right: 0px !important; column-gap: 0px !important; }';
      // epub.js 会用 setProperty 把 body 的 padding-left/right 写成 !important（inline 优先于 stylesheet），
      // 必须用 setProperty 直接覆盖为 0；同时把 column-gap 归零保持列占位=delta。
      // 注意：不能用 style.paddingLeft = 'x !important'（longhand setter 会忽略 !important）。
      if (doc.body) {
        try {
          doc.body.style.setProperty('padding-left', '0px', 'important');
          doc.body.style.setProperty('padding-right', '0px', 'important');
          doc.body.style.setProperty('column-gap', '0px', 'important');
        } catch (_) {}
      }
    }

    _attachClickZones() {
      if (!this.rendition) return;
      this.rendition.getContents().forEach((c) => {
        if (c.document._readerClickBound) return;
        c.document._readerClickBound = true;
        c.document.addEventListener('click', (e) => {
          // 链接交给 epub.js 内部处理
          if (e.target.closest('a')) return;
          // 有文本选中时不翻页
          const sel = c.document.getSelection();
          if (sel && sel.toString().trim().length > 0) return;
          const x = e.clientX;
          // 分页模式下 iframe 视口宽 = 多列总宽（可能远大于可见页宽），
          // 因此点击区域按可见容器宽度计算，并减去容器 scrollLeft 得到相对当前页的位置
          const container = this.el.querySelector('.epub-container');
          const w = container && container.clientWidth > 0 ? container.clientWidth : c.document.documentElement.clientWidth;
          const px = x - (container ? container.scrollLeft : 0);
          if (px < w * 0.25) this.prev();
          else if (px > w * 0.75) this.next();
          else this.onToggleBars(); // 中间区域：收起/展开上下栏
        });

        // 滚轮翻页（仅分页模式；滚动模式下交由原生滚动）
        c.document.addEventListener('wheel', (e) => {
          if (this.settings.flow !== 'paginated') return;
          e.preventDefault();
          this._wheelAcc = (this._wheelAcc || 0) + e.deltaY;
          if (Math.abs(this._wheelAcc) >= 80) {
            if (this._wheelAcc > 0) this.next();
            else this.prev();
            this._wheelAcc = 0;
          }
        }, { passive: false });

        // 触摸水平滑动翻页
        this._bindTouchSwipe(c.document);
      });
    }

    /** 触摸水平滑动翻页（左滑下一页、右滑上一页；垂直滑动不拦截） */
    _bindTouchSwipe(target) {
      if (!target || target._readerTouchBound) return;
      target._readerTouchBound = true;
      let sx = null, sy = null;
      target.addEventListener('touchstart', (e) => {
        // 滚动模式（连续滚动）下不启用左右滑动翻页
        if (this.settings.flow === 'scrolled') { sx = sy = null; return; }
        const t = e.touches[0];
        if (t) { sx = t.clientX; sy = t.clientY; }
      }, { passive: true });
      target.addEventListener('touchend', (e) => {
        if (sx === null) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - sx;
        const dy = t.clientY - sy;
        sx = sy = null;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          if (dx < 0) this.next();
          else this.prev();
        }
      }, { passive: true });
    }

    _onKey(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') this.next();
      else if (e.key === 'ArrowLeft') this.prev();
    }

    _onRelocated(loc) {
      const start = loc.start;
      this.currentCfi = start.cfi;

      let percent = 0;
      if (this.locations && this.locations._locations && this.locations._locations.length) {
        try {
          percent = this.locations.percentageFromCfi(start.cfi) * 100;
        } catch (_) {
          percent = typeof start.percent === 'number' ? start.percent * 100 : 0;
        }
      } else if (typeof start.percent === 'number') {
        percent = start.percent * 100;
      }
      percent = Math.min(100, Math.max(0, percent));

      this.onProgress({ cfi: start.cfi, percent });

      // 章节信息
      const href = start.href;
      if (href) {
        this.book.loaded.navigation.then((nav) => {
          const label = this._findTocLabel(nav.toc, href);
          if (label) this.onChapter({ label, href });
        }).catch(() => {});
      }
    }

    _findTocLabel(items, href) {
      for (const it of items) {
        if (it.href === href || href.startsWith(it.href) || it.href.startsWith(href)) {
          return it.label;
        }
        if (it.subitems && it.subitems.length) {
          const sub = this._findTocLabel(it.subitems, href);
          if (sub) return sub;
        }
      }
      return null;
    }

    /* ---------- PDF（pdf.js 滚动渲染） ---------- */
    async _openPdf(arrayBuffer, pageNum) {
      const pdfjs = globalThis.pdfjsLib;
      if (!pdfjs) throw new Error('PDF 引擎未加载');
      const container = document.createElement('div');
      container.className = 'pdf-reader';
      this.el.appendChild(container);
      this.pdf = { container, pages: [], renderedTo: 0, current: 1, numPages: 0, textCache: {}, pdf: null };
      try {
        if (!globalThis._pdfWorkerSet) {
          pdfjs.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
          globalThis._pdfWorkerSet = true;
        }
        const task = pdfjs.getDocument({ data: arrayBuffer });
        this.pdf.pdf = await task.promise;
        this.pdf.numPages = this.pdf.pdf.numPages;
        this._pdfScroll = () => this._onPdfScroll();
        container.addEventListener('scroll', this._pdfScroll, { passive: true });
        window.addEventListener('resize', (this._onResize = () => this._reflowPdf()));
        this._bindTouchSwipe(container);
        await this._renderMorePdfPages();
        const target = (typeof pageNum === 'number' && pageNum > 0 && pageNum <= this.pdf.numPages) ? pageNum : 1;
        await this._goToPdfPage(target);
        this._updatePdfProgress();
      } catch (e) {
        container.innerHTML = '<div class="pdf-error">PDF 解析失败或文件损坏</div>';
        throw e;
      }
    }

    /** 懒加载渲染 PDF 页面（滚动到接近末尾时补充渲染） */
    async _renderMorePdfPages() {
      const p = this.pdf;
      if (!p || !p.pdf) return;
      const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
      const base = this.el.clientWidth > 0 ? this.el.clientWidth : (p.container.clientWidth || 375);
      const pageW = Math.max(base - 24, 200);
      while (p.renderedTo < p.numPages) {
        const n = p.renderedTo + 1;
        try {
          const page = await p.pdf.getPage(n);
          const vp1 = page.getViewport({ scale: 1 });
          const scale = pageW / vp1.width;
          const vp = page.getViewport({ scale: scale * dpr });
          const canvas = document.createElement('canvas');
          canvas.className = 'pdf-page';
          canvas.dataset.page = n;
          canvas.width = Math.max(1, Math.floor(vp.width));
          canvas.height = Math.max(1, Math.floor(vp.height));
          canvas.style.width = Math.floor(vp.width / dpr) + 'px';
          canvas.style.height = Math.floor(vp.height / dpr) + 'px';
          const ctx = canvas.getContext('2d');
          p.container.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          p.pages[n] = { canvas, page, vp };
          p.renderedTo = n;
          this._pdfCacheText(n, page);
        } catch (e) {
          break;
        }
      }
    }

    /** 缓存某一页文本（书签/搜索用，后台异步） */
    async _pdfCacheText(n, page) {
      try {
        const tc = await page.getTextContent();
        const txt = tc.items.map((it) => it.str || '').join(' ').replace(/\s+/g, ' ').trim();
        if (this.pdf) this.pdf.textCache[n] = txt;
      } catch (_) {}
    }

    _onPdfScroll() {
      const p = this.pdf;
      if (!p) return;
      const c = p.container;
      if (p.renderedTo < p.numPages && c.scrollTop + c.clientHeight > c.scrollHeight - c.clientHeight * 1.5) {
        this._renderMorePdfPages();
      }
      this._updatePdfProgress();
    }

    _updatePdfProgress() {
      const p = this.pdf;
      if (!p || !p.numPages) return;
      const c = p.container;
      let page = 1;
      for (let i = 1; i <= p.renderedTo; i++) {
        const rec = p.pages[i];
        if (rec && rec.canvas) {
          if (rec.canvas.offsetTop <= c.scrollTop + 4) page = i;
          else break;
        }
      }
      p.current = page;
      this.currentCfi = PDF_PREFIX + page;
      const percent = Math.min(100, Math.max(0, (page / p.numPages) * 100));
      this.onProgress({ cfi: this.currentCfi, percent });
    }

    async _goToPdfPage(n) {
      const p = this.pdf;
      if (!p || !p.numPages) return;
      n = Math.min(Math.max(1, n), p.numPages);
      if (n > p.renderedTo) await this._renderMorePdfPages();
      const rec = p.pages[n];
      if (!rec || !rec.canvas) return;
      const c = p.container;
      c.scrollTop = Math.max(0, rec.canvas.offsetTop - 2);
      this._updatePdfProgress();
    }

    async _reflowPdf() {
      const p = this.pdf;
      if (!p) return;
      const cur = p.current || 1;
      p.container.innerHTML = '';
      p.pages = [];
      p.renderedTo = 0;
      await this._renderMorePdfPages();
      if (cur) await this._goToPdfPage(cur);
    }

    /* ---------- TXT ---------- */
    _openTxt(arrayBuffer, percent) {
      const text = decodeTxt(arrayBuffer);
      const chapters = parseTxt(text);

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
          el.textContent = p;
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
        const node = sel.anchorNode;
        if (!node || !this.txt.container.contains(node)) return;
        const el = node.nodeType === 3 ? node.parentElement : node;
        const para = el && el.closest ? el.closest('.txt-para') : null;
        if (!para) return;
        const sec = para.closest('.txt-chapter');
        const ci = sec ? parseInt(sec.dataset.index, 10) : 0;
        const pi = Array.prototype.indexOf.call(sec ? sec.querySelectorAll('.txt-para') : [], para);
        this.onSelectedText(TXT_PREFIX + ci + ':' + pi, para.textContent.trim().replace(/\s+/g, ' ').slice(0, 120), false);
      };
      document.addEventListener('selectionchange', this._txtSelHandler);

      // 恢复进度
      if (typeof percent === 'number' && isFinite(percent)) {
        this.goToPercent(percent);
      } else {
        this._updateTxtProgress();
      }
    }

    /** 返回最接近视口中心的段落元素 */
    _findCenterPara() {
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

    _updateTxtProgress() {
      const c = this.txt.container;
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

    _goToTxtCfi(cfi, highlight) {
      if (!cfi || !cfi.startsWith(TXT_PREFIX)) return;
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

    _flashTxt(el) {
      el.classList.add('txt-highlight');
      setTimeout(() => el.classList.remove('txt-highlight'), 2200);
    }

    /* ================= 翻页 / 跳转 ================= */
    next() {
      if (this.mode === 'txt') {
        const c = this.txt.container;
        c.scrollBy({ top: c.clientHeight * 0.9, behavior: 'smooth' });
        return;
      }
      if (this.mode === 'pdf') {
        const c = this.pdf.container;
        c.scrollBy({ top: c.clientHeight * 0.9, behavior: 'smooth' });
        return;
      }
      // 连续滚动模式下：未到底时滚动一屏，到底后再翻才进入下一章
      if (this.settings.flow === 'scrolled') {
        this._scrollEpubPage(1);
        return;
      }
      // 分页模式：带滑动动画翻页
      if (this.settings.flow === 'paginated') {
        this._animatePageTurn(1);
        return;
      }
      if (!this.rendition || this._busy) return;
      this._busy = true;
      this.rendition.next().catch(() => {}).finally(() => { this._busy = false; });
    }

    prev() {
      if (this.mode === 'txt') {
        const c = this.txt.container;
        c.scrollBy({ top: -c.clientHeight * 0.9, behavior: 'smooth' });
        return;
      }
      if (this.mode === 'pdf') {
        const c = this.pdf.container;
        c.scrollBy({ top: -c.clientHeight * 0.9, behavior: 'smooth' });
        return;
      }
      // 连续滚动模式下：未到顶时向上滚动一屏，到顶后再翻才回到上一章
      if (this.settings.flow === 'scrolled') {
        this._scrollEpubPage(-1);
        return;
      }
      // 分页模式：带滑动动画翻页
      if (this.settings.flow === 'paginated') {
        this._animatePageTurn(-1);
        return;
      }
      if (!this.rendition || this._busy) return;
      this._busy = true;
      this.rendition.prev().catch(() => {}).finally(() => { this._busy = false; });
    }

    /** 分页模式翻页动画：平滑滑动到相邻页；到章节边界才切换章节 */
    _animatePageTurn(dir) {
      const c = this.el.querySelector('.epub-container');
      if (!c || !this.rendition) return;
      // 每页偏移量 = epub.js 布局 delta（列宽，column-gap 已设为 0）
      let delta = 375;
      try {
        const d = this.rendition.manager && this.rendition.manager.layout ? this.rendition.manager.layout.delta : 0;
        delta = (d && d > 0) ? d : (c.clientWidth || 375);
      } catch (_) {
        delta = c.clientWidth || 375;
      }
      const max = Math.max(0, c.scrollWidth - c.clientWidth);
      let base;
      if (this._lastTurnTarget != null && Math.abs(c.scrollLeft - this._lastTurnTarget) < delta * 0.5) {
        base = this._lastTurnTarget; // 动画中连点：基于上次目标继续翻，避免丢页
      } else {
        base = Math.round(c.scrollLeft / delta) * delta;
      }
      const target = Math.min(max, Math.max(0, base + dir * delta));
      // 已到章节边界（章末/章首）或无法再翻时：切换章节
      const atEnd = c.scrollLeft >= max - 8;
      const atStart = c.scrollLeft <= 8;
      if ((dir > 0 && atEnd) || (dir < 0 && atStart) || Math.abs(target - c.scrollLeft) < 2) {
        this._lastTurnTarget = null;
        if (this._busy) return;
        this._busy = true;
        const p = dir > 0 ? this.rendition.next() : this.rendition.prev();
        if (p && p.catch) p.catch(() => {});
        if (p && p.finally) p.finally(() => { this._busy = false; });
        else this._busy = false;
        return;
      }
      this._lastTurnTarget = target;
      this._animateScrollTo(c, target, 150);
    }

    /** 快速翻页动画：rAF 平滑滚动（~150ms，比原生 smooth 更快） */
    _animateScrollTo(el, to, duration) {
      if (this._turnAnimId) { cancelAnimationFrame(this._turnAnimId); this._turnAnimId = null; }
      const from = el.scrollLeft;
      const start = performance.now();
      const dur = duration || 150;
      const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
      const step = (now) => {
        const p = Math.min(1, (now - start) / dur);
        el.scrollLeft = from + (to - from) * ease(p);
        if (p < 1) { this._turnAnimId = requestAnimationFrame(step); }
        else { this._turnAnimId = null; el.scrollLeft = to; }
      };
      this._turnAnimId = requestAnimationFrame(step);
    }

    /** 连续滚动（EPUB）模式下一屏滚动；到达章节边界时跳转章节 */
    _scrollEpubPage(dir) {
      const c = this.el.querySelector('.epub-container');
      if (!c) return;
      const max = c.scrollHeight - c.clientHeight;
      const atEnd = c.scrollTop >= max - 8;
      const atTop = c.scrollTop <= 8;
      if ((dir > 0 && atEnd) || (dir < 0 && atTop)) {
        if (!this.rendition || this._busy) return;
        this._busy = true;
        const p = dir > 0 ? this.rendition.next() : this.rendition.prev();
        if (p && p.catch) p.catch(() => {});
        if (p && p.finally) p.finally(() => { this._busy = false; });
        else this._busy = false;
        return;
      }
      c.scrollBy({ top: c.clientHeight * 0.9 * dir, behavior: 'smooth' });
    }

    /** 连续滚动（EPUB）模式：绑定滚动事件以更新阅读进度 */
    _bindScrolledProgress() {
      const c = this.el.querySelector('.epub-container');
      if (!c || c._readerScrollBound) return;
      c._readerScrollBound = true;
      c.addEventListener('scroll', () => this._updateScrolledProgress());
      // 打开书后主动刷新一次进度（scrolled 模式下 relocated 可能不触发）
      setTimeout(() => this._updateScrolledProgress(), 500);
    }

    _updateScrolledProgress() {
      if (this.settings.flow !== 'scrolled' || !this.rendition) return;
      const c = this.el.querySelector('.epub-container');
      if (!c) return;
      const now = Date.now();
      if (this._lastScrollUpdate && now - this._lastScrollUpdate < 250) return;
      this._lastScrollUpdate = now;
      const max = c.scrollHeight - c.clientHeight;
      if (max <= 0) return;
      const secPct = Math.min(1, Math.max(0, c.scrollTop / max));
      try {
        const loc = this.rendition.currentLocation();
        const start = loc && loc.start;
        const cfi = start && start.cfi ? start.cfi : this.currentCfi;
        let pct = null;
        const locs = this.book && this.book.locations;
        if (cfi && locs && locs._locations && locs._locations.length) {
          pct = locs.percentageFromCfi(cfi) * 100;
        }
        if (pct === null || isNaN(pct)) {
          const idx = start && typeof start.index === 'number' ? start.index : 0;
          const spine = this.book && this.book.spine;
          const total = spine && spine.length ? spine.length : 1;
          pct = ((idx + secPct) / total) * 100;
        }
        pct = Math.min(100, Math.max(0, pct));
        this.onProgress({ cfi, percent: pct });
      } catch (_) {}
    }

    async goToCfi(cfi, highlight) {
      if (this.mode === 'txt') {
        this._goToTxtCfi(cfi, highlight);
        return;
      }
      if (this.mode === 'pdf') {
        const m = cfi && cfi.indexOf(PDF_PREFIX) === 0 ? cfi.slice(PDF_PREFIX.length).match(/\d+/) : null;
        if (m) this._goToPdfPage(parseInt(m[0], 10));
        return;
      }
      if (!this.rendition || !cfi) return;
      try {
        await this.rendition.display(cfi);
      } catch (e) {
        console.warn('display failed:', e);
        return;
      }
      if (highlight) {
        try {
          // 样式需通过 styles(attributes) 参数传递，data 参数会写入 dataset（不能含连字符键）
          this.rendition.annotations.highlight(cfi, {}, null, 'epubjs-hl', {
            fill: 'rgba(255, 208, 0, 0.45)',
            'fill-opacity': '0.45',
          });
        } catch (e) {
          console.warn('highlight failed:', e);
        }
      }
    }

    goToPercent(percent) {
      if (this.mode === 'txt') {
        const c = this.txt.container;
        const max = c.scrollHeight - c.clientHeight;
        c.scrollTop = max * (percent / 100);
        this._updateTxtProgress();
        return;
      }
      if (this.mode === 'pdf') {
        const n = Math.max(1, Math.min(this.pdf.numPages, Math.round((percent / 100) * this.pdf.numPages)));
        this._goToPdfPage(n);
        return;
      }
      if (!this.book || !this.locations) return;
      try {
        const cfi = this.locations.cfiFromPercentage(percent / 100);
        if (cfi) this.goToCfi(cfi, false);
      } catch (_) {}
    }

    async goToHref(href) {
      if (this.mode === 'txt') {
        if (href && href.startsWith(TXT_PREFIX)) this._goToTxtCfi(href, false);
        return;
      }
      if (this.mode === 'pdf') {
        if (href && href.indexOf(PDF_PREFIX) === 0) this._goToPdfPage(parseInt(href.slice(PDF_PREFIX.length), 10));
        return;
      }
      if (!this.book || !href) return;
      try {
        await this.rendition.display(href);
      } catch (_) {}
    }

    /* ================= 数据 ================= */
    async getMetadata() {
      if (this.mode === 'txt') return { title: '', creator: '' };
      if (this.mode === 'pdf') {
        try {
          const m = await this.pdf.pdf.getMetadata();
          return { title: (m && m.info && m.info.Title) || '', creator: (m && m.info && m.info.Author) || '' };
        } catch (_) { return {}; }
      }
      try { return await this.book.loaded.metadata; } catch (_) { return {}; }
    }

    async getToc() {
      if (this.mode === 'txt') {
        return this.txt.chapters.map((ch, i) => ({ label: ch.title, href: TXT_PREFIX + 'c:' + i }));
      }
      if (this.mode === 'pdf') {
        // PDF 大纲（书签）：解析 outline → 页码
        try {
          const outline = await this.pdf.pdf.getOutline();
          const walk = async (items) => {
            const out = [];
            for (const it of (items || [])) {
              let page = 1;
              try {
                let dest = it.dest;
                if (typeof dest === 'string') dest = await this.pdf.pdf.getDestination(dest);
                if (dest && dest[0]) {
                  const idx = await this.pdf.pdf.getPageIndex(dest[0]);
                  page = idx + 1;
                }
              } catch (_) {}
              out.push({ label: it.title || '', href: PDF_PREFIX + page });
              if (it.items && it.items.length) out.push(...await walk(it.items));
            }
            return out;
          };
          return await walk(outline);
        } catch (_) { return []; }
      }
      try {
        const nav = await this.book.loaded.navigation;
        return nav.toc || [];
      } catch (_) { return []; }
    }

    async getCoverUrl() {
      if (this.mode === 'txt') return null;
      try { return await this.book.coverUrl(); } catch (_) { return null; }
    }

    async search(query) {
      if (this.mode === 'txt') return this._searchTxt(query);
      if (this.mode === 'pdf') return this._searchPdf(query);
      if (!this.book || !query) return [];
      const results = [];
      const sections = this.book.spine.spineItems || [];
      for (const section of sections) {
        try {
          await section.load(this.book.load.bind(this.book));
          const matches = section.search(query);
          if (matches && matches.length) results.push(...matches);
          section.unload();
        } catch (_) {}
      }
      return results;
    }

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

    /** PDF 全文搜索（按页提取文本） */
    async _searchPdf(query) {
      if (!this.pdf || !query) return [];
      const q = query.toLowerCase();
      const results = [];
      for (let n = 1; n <= this.pdf.numPages; n++) {
        let txt = this.pdf.textCache[n];
        if (txt === undefined) {
          try {
            const page = await this.pdf.pdf.getPage(n);
            const tc = await page.getTextContent();
            txt = tc.items.map((it) => it.str || '').join(' ').replace(/\s+/g, ' ').trim();
            if (this.pdf) this.pdf.textCache[n] = txt;
          } catch (_) { txt = ''; }
        }
        const idx = txt.toLowerCase().indexOf(q);
        if (idx > -1) {
          const s = Math.max(0, idx - 20);
          const excerpt = (s > 0 ? '…' : '') + txt.slice(s, idx + q.length + 40) + '…';
          results.push({ cfi: PDF_PREFIX + n, excerpt });
        }
      }
      return results;
    }

    async getTextAt(cfi) {
      if (this.mode === 'txt') {
        if (cfi && cfi.startsWith(TXT_PREFIX) && cfi.indexOf(':') > -1) {
          const parts = cfi.slice(TXT_PREFIX.length).split(':');
          const ch = this.txt.chapters[parseInt(parts[0], 10)];
          const para = ch && ch.paras[parseInt(parts[1], 10)];
          if (para) return para.slice(0, 120);
        }
        return this.getCurrentText();
      }
      if (this.mode === 'pdf') {
        const m = cfi && cfi.indexOf(PDF_PREFIX) === 0 ? cfi.slice(PDF_PREFIX.length).match(/\d+/) : null;
        const n = m ? parseInt(m[0], 10) : 0;
        const t = this.pdf && this.pdf.textCache[n];
        if (t) return t.slice(0, 120);
        return this.getCurrentText();
      }
      if (!this.book || !cfi) return '';
      try {
        const range = await this.book.getRange(cfi);
        if (range) return range.toString().trim().replace(/\s+/g, ' ').slice(0, 120);
      } catch (_) {}
      return '';
    }

    /* ================= 划线 / 高亮 ================= */
    async _getTextByCfi(cfi) {
      try {
        const range = await this.book.getRange(cfi);
        if (range) return range.toString().trim().replace(/\s+/g, ' ').slice(0, 120);
      } catch (_) {}
      return '';
    }

    /** 设置本书高亮列表（打开书后调用）；rendered 时自动重绘 */
    setHighlights(list) {
      this._hlList = (list || []).filter((h) => h && h.cfi).slice();
      this._applyHls();
    }

    addHighlight(cfi, color) {
      if (!cfi) return;
      if (!this._hlList.some((h) => h.cfi === cfi)) this._hlList.push({ cfi, color: color || 'yellow' });
      this._applyHls();
    }

    removeHighlight(cfi) {
      this._hlList = this._hlList.filter((h) => h.cfi !== cfi);
      if (this.mode === 'epub' && this.rendition) {
        try { this.rendition.annotations.remove(cfi, 'highlight'); } catch (_) {}
        // epub.js 的 remove 可能移除不完整，重建确保一致
        this._rebuildHls();
      } else if (this.mode === 'txt') {
        this._removeTxtHighlight(cfi);
      }
    }

    /** 清除全部高亮并重绘剩余（保证删除后 svg 一致） */
    _rebuildHls() {
      if (this.mode !== 'epub' || !this.rendition) return;
      try { this.rendition.annotations.removeAll('highlight'); } catch (_) {}
      this._applyHls();
    }

    _applyHls() {
      // 先清除已存在的全部高亮，避免 setHighlights/rendered/addHighlight 多次调用导致重复渲染、色块错位
      if (this.mode === 'epub' && this.rendition) {
        try { this.rendition.annotations.removeAll('highlight'); } catch (_) {}
        // epub.js 的 removeAll 对 svg rect 移除不完整，直接清空高亮容器保证幂等
        this.el.querySelectorAll('.epub-view svg').forEach((s) => { s.innerHTML = ''; });
      }
      if (!this._hlList.length) return;
      if (this.mode === 'epub') {
        this._hlList.forEach((h) => {
          try {
            this.rendition.annotations.highlight(h.cfi, { type: 'highlight', color: h.color }, function () {}, 'reader-hl', {
              fill: HL_COLORS[h.color] || HL_COLORS.yellow,
              'fill-opacity': '0.45',
            });
          } catch (e) {
            console.error('highlight failed:', e);
          }
        });
      } else if (this.mode === 'txt') {
        this._hlList.forEach((h) => this._applyTxtHighlight(h.cfi, h.color));
      }
    }

    _applyTxtHighlight(cfi, color) {
      const parts = cfi && cfi.indexOf(TXT_PREFIX) === 0 ? cfi.slice(TXT_PREFIX.length).split(':') : [];
      const ci = parseInt(parts[0], 10);
      const pi = parseInt(parts[1], 10);
      const sec = this.txt.content.querySelectorAll('.txt-chapter')[ci];
      const para = sec ? sec.querySelectorAll('.txt-para')[pi] : null;
      if (para) {
        para.classList.add('txt-hl');
        para.dataset.hlColor = color || 'yellow';
      }
    }

    _removeTxtHighlight(cfi) {
      const parts = cfi && cfi.indexOf(TXT_PREFIX) === 0 ? cfi.slice(TXT_PREFIX.length).split(':') : [];
      const ci = parseInt(parts[0], 10);
      const pi = parseInt(parts[1], 10);
      const sec = this.txt.content.querySelectorAll('.txt-chapter')[ci];
      const para = sec ? sec.querySelectorAll('.txt-para')[pi] : null;
      if (para) para.classList.remove('txt-hl');
    }

    /** 提取当前视口中心的正文文本（书签文字） */
    getCurrentText() {
      if (this.mode === 'txt') {
        const p = this._findCenterPara();
        return p ? p.textContent.trim().slice(0, 120) : '';
      }
      if (this.mode === 'pdf') {
        const t = this.pdf && this.pdf.textCache[this.pdf.current];
        return t ? t.slice(0, 120) : '';
      }
      try {
        let doc = null;
        const contents = this.rendition.getContents();
        if (contents && contents.length && contents[0].document) {
          doc = contents[0].document;
        } else {
          const iframe = this.el.querySelector('iframe');
          if (iframe && iframe.contentDocument) doc = iframe.contentDocument;
        }
        if (!doc) return '';
        const body = doc.querySelector('body');
        const text = body ? body.textContent.replace(/\s+/g, ' ').trim() : '';
        return text.slice(0, 120);
      } catch (e) { console.warn('getCurrentText failed:', e); return ''; }
    }

    /* ================= 外观 ================= */
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
    }

    _applyAppearance() {
      const s = this.settings;
      const themes = this.rendition.themes;

      themes.register('app-light', {
        body: { color: '#2c2c2c !important', background: '#ffffff !important' },
        a: { color: '#a97832 !important' },
      });
      themes.register('app-sepia', {
        body: { color: '#433422 !important', background: '#f2e8d5 !important' },
        a: { color: '#a97832 !important' },
      });
      themes.register('app-dark', {
        body: { color: '#d6d3cb !important', background: '#1c1c1e !important' },
        a: { color: '#d4a844 !important' },
      });

      const margin = (typeof s.margin === 'number' ? s.margin : 4);
      themes.select('app-' + (s.theme || 'light'));
      themes.fontSize((s.fontSize || 18) + 'px');
      themes.override('line-height', String(s.lineHeight || 1.8));
      // 左右留白（由 _applyEpubMargin 用固定 px 注入，不用 vw 避免分页多列下循环放大）
      this._applyEpubMargin();
      // 字体：内置字体在 display 前即可应用；自定义字体需等 iframe 就绪（rendered 事件注入 @font-face）
      const res = this._resolveFont(s.fontFamily);
      if (res && res.url) {
        this._applyEpubFont();
      } else if (res) {
        try { themes.font(res.family); } catch (_) {}
      }
    }

    /* ---- 字体解析与注入 ---- */
    /** 解析字体设置为实际 CSS font-family；自定义字体（font:<id>）返回 @font-face 信息 */
    _resolveFont(fam) {
      if (fam && fam.indexOf('font:') === 0) {
        const id = fam.slice(5);
        const f = this.getFont ? this.getFont(id) : null;
        if (f && f.url) {
          return { family: f.family, url: f.url, format: f.format || 'truetype' };
        }
      }
      if (fam === 'serif') return { family: 'Georgia, "Times New Roman", "Songti SC", serif' };
      if (fam === 'sans-serif') return { family: '"Segoe UI", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif' };
      return null; // default：跟随书籍
    }

    /** 向 EPUB iframe 注入自定义字体 @font-face 并应用 */
    _applyEpubFont() {
      if (this.mode !== 'epub' || !this.el) return;
      try {
        const res = this._resolveFont(this.settings.fontFamily);
        this.el.querySelectorAll('iframe').forEach((iframe) => {
          const doc = iframe.contentDocument;
          if (!doc || !doc.head) return;
          let style = doc.getElementById('reader-font-face');
          if (res && res.url) {
            if (!style) {
              style = doc.createElement('style');
              style.id = 'reader-font-face';
              doc.head.appendChild(style);
            }
            style.textContent = "@font-face { font-family: '" + res.family + "'; src: url('" + res.url + "') format('" + res.format + "'); }";
          } else if (style) {
            style.remove();
          }
        });
        if (res && res.url) {
          try { this.rendition.themes.font("'" + res.family + "', sans-serif"); } catch (_) {}
        }
      } catch (_) {}
    }

    setTheme(theme) {
      this.settings.theme = theme;
      if (this.mode === 'txt') return; // 主题由 body 主题类控制
      if (this.rendition) {
        try { this.rendition.themes.select('app-' + theme); } catch (_) {}
      }
    }

    setFontSize(px) {
      this.settings.fontSize = px;
      if (this.mode === 'txt') {
        if (this.txt) this.txt.content.style.fontSize = px + 'px';
        return;
      }
      if (this.rendition) {
        try { this.rendition.themes.fontSize(px + 'px'); } catch (_) {}
        // 布局变化后重画高亮，避免色块错位
        this._applyHls();
      }
    }

    setLineHeight(lh) {
      this.settings.lineHeight = lh;
      if (this.mode === 'txt') {
        if (this.txt) this.txt.content.style.lineHeight = String(lh);
        return;
      }
      if (this.rendition) {
        try { this.rendition.themes.override('line-height', String(lh)); } catch (_) {}
        this._applyHls();
      }
    }

    /** 设置左右留白（百分比，按视口宽度） */
    setMargin(pct) {
      this.settings.margin = pct;
      if (this.mode === 'txt') {
        if (this.txt) {
          this.txt.content.style.paddingLeft = pct + 'vw';
          this.txt.content.style.paddingRight = pct + 'vw';
        }
        return;
      }
      if (this.rendition) {
        this._applyEpubMargin();
        this._applyHls(); // 留白变化后重画高亮
      }
    }

    setFontFamily(fam) {
      this.settings.fontFamily = fam;
      const res = this._resolveFont(fam);
      if (this.mode === 'txt') {
        if (this.txt) this.txt.content.style.fontFamily = res ? res.family : '';
        return;
      }
      if (this.rendition && fam !== 'default') {
        try {
          if (res && res.url) this._applyEpubFont();
          else if (res) this.rendition.themes.font(res.family);
        } catch (_) {}
        this._applyHls(); // 字体变化后重画高亮
      }
    }

    async setFlow(flow) {
      if (this.mode === 'txt') {
        this.settings.flow = flow; // txt 始终连续滚动，仅记录设置
        return;
      }
      if (this.settings.flow === flow || !this.book) return;
      this.settings.flow = flow;
      this._wheelAcc = 0;
      const cfi = this.currentCfi;
      try { this.rendition.destroy(); } catch (_) {}
      this.rendition = this.book.renderTo(this.el, {
        width: '100%',
        height: '100%',
        spread: 'auto',
        flow: flow,
      });
      this._bindRendition();
      this._applyAppearance();
      await this.rendition.display(cfi || undefined);
    }

    /** 重新计算渲染尺寸（沉浸模式收起/展开上下栏后调用，避免底部空白） */
    resize(w, h) {
      if (this.mode === 'epub' && this.rendition) {
        try { this.rendition.resize(w, h); } catch (_) {}
      } else if (this.mode === 'pdf') {
        this._reflowPdf();
      }
    }

    /* ================= 清理 ================= */
    destroy() {
      if (this._onResize) window.removeEventListener('resize', this._onResize);
      if (this.txt && this.txt.container && this._txtScroll) {
        this.txt.container.removeEventListener('scroll', this._txtScroll);
      }
      if (this._txtSelHandler) document.removeEventListener('selectionchange', this._txtSelHandler);
      if (this.pdf && this.pdf.container && this._pdfScroll) {
        this.pdf.container.removeEventListener('scroll', this._pdfScroll);
      }
      if (this.pdf && this.pdf.pdf && this.pdf.pdf.destroy) {
        try { this.pdf.pdf.destroy(); } catch (_) {}
      }
      this.el.innerHTML = '';
      if (this.rendition) {
        try { this.rendition.destroy(); } catch (_) {}
      }
      this.rendition = null;
      this.book = null;
      this.locations = null;
      this.txt = null;
      this.pdf = null;
      this._onResize = null;
      this._txtScroll = null;
      this._pdfScroll = null;
      this._txtSelHandler = null;
      this._hlList = [];
      this.currentCfi = null;
    }
  }

  global.Reader = Reader;
})(window);
