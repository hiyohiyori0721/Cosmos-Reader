/* ============================================================
 * reader-pdf.js — PDF 阅读模式（pdf.js 滚动渲染）
 * 依赖：reader.js（Reader 类）、config.js（CosmosConfig）
 * ============================================================ */
(function (global) {
  'use strict';

  const Reader = global.Reader;
  const PDF_PREFIX = CosmosConfig.PDF_PREFIX;

  Object.assign(Reader.prototype, {

    async _openPdf(arrayBuffer, pageNum) {
      const pdfjs = globalThis.pdfjsLib;
      if (!pdfjs) throw new Error(t('reader.pdfEngine'));
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
        const target = (typeof pageNum === 'number' && pageNum > 0 && pageNum <= this.pdf.numPages) ? pageNum : 1;
        // 内存窗口：打开只渲染目标页附近，其余按滚动懒加载 + 回收
        await this._renderPdfWindow(target - this._pdfKeepPages(), target + this._pdfKeepPages());
        await this._goToPdfPage(target);
        this._updatePdfProgress();
      } catch (e) {
        container.innerHTML = '<div class="pdf-error">' + t('reader.pdfFail') + '</div>';
        throw e;
      }
    }

    /** 懒加载渲染：滚动接近底部时补渲染到当前位置窗口 */,

    async _renderMorePdfPages() {
      const p = this.pdf;
      if (!p || !p.pdf) return;
      const cur = p.current || 1;
      await this._renderPdfWindow(p.renderedTo + 1, Math.min(p.numPages, cur + this._pdfKeepPages()));
    }

    /** 内存窗口半宽：视口上下各保留的页数（窗口外回收 canvas，滚回时重渲染） */,

    _pdfKeepPages() { return 4; }

    /** 渲染单页 PDF（画布 + 文本层 + 文本缓存；渲染锁防并发重复绘制） */,

    async _renderPdfPage(n) {
      const p = this.pdf;
      if (!p || !p.pdf) return null;
      const existing = p.pages[n];
      if (existing && existing.canvas && existing.canvas.isConnected) return existing;
      if (this._pdfRenderQ && this._pdfRenderQ.has(n)) return null;
      if (!this._pdfRenderQ) this._pdfRenderQ = new Set();
      this._pdfRenderQ.add(n);
      try {
        const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
        const base = this.el.clientWidth > 0 ? this.el.clientWidth : (p.container.clientWidth || 375);
        const pageW = Math.max(base - 24, 200);
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
        this._insertPdfCanvas(canvas, n);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const rec = { canvas, page, vp };
        p.pages[n] = rec;
        if (n > p.renderedTo) p.renderedTo = n;
        this._pdfCacheText(n, page);
        this._addPdfTextLayer(page, canvas, vp); // 文本选择层（可选中/复制）
        return rec;
      } catch (e) {
        return null;
      } finally {
        this._pdfRenderQ.delete(n);
      }
    }

    /** 按页码顺序插入 canvas（保持 offsetTop 顺序，进度计算依赖） */,

    _insertPdfCanvas(canvas, n) {
      const container = this.pdf.container;
      const pages = container.querySelectorAll('.pdf-page');
      for (const el of pages) {
        if (parseInt(el.dataset.page, 10) > n) { container.insertBefore(canvas, el); return; }
      }
      container.appendChild(canvas);
    }

    /** 渲染 [lo,hi] 窗口内的缺失页 */,

    async _renderPdfWindow(lo, hi) {
      const p = this.pdf;
      if (!p || !p.pdf) return;
      lo = Math.max(1, lo);
      hi = Math.min(p.numPages, hi);
      for (let n = lo; n <= hi; n++) {
        if (!await this._renderPdfPage(n)) return;
      }
    }

    /** 滚动时维护内存窗口：回收窗口外 canvas，恢复滚回的缺失页 */,

    _managePdfWindow() {
      const p = this.pdf;
      if (!p || !p.numPages || !p.pages) return;
      const cur = p.current || 1;
      const keep = this._pdfKeepPages();
      const lo = Math.max(1, cur - keep);
      const hi = Math.min(p.numPages, cur + keep);
      const container = p.container;
      for (let i = 1; i <= p.renderedTo; i++) {
        const rec = p.pages[i];
        if (!rec || !rec.canvas || !rec.canvas.isConnected) continue;
        if (i < lo || i > hi) {
          rec.canvas.remove();
          const tl = container.querySelector('.textLayer[data-page="' + i + '"]');
          if (tl) tl.remove();
          rec.canvas = null;
        }
      }
      this._renderPdfWindow(lo, hi); // 恢复窗口内缺失页（向前滚回时）
    }

    /** 为 PDF 页叠加文本选择层（pdf.js renderTextLayer：透明文字可选中/复制） */,

    async _addPdfTextLayer(page, canvas, vp) {
      try {
        const pdfjs = globalThis.pdfjsLib;
        if (!pdfjs || !this.pdf) return;
        const container = canvas.parentNode;
        if (!container) return;
        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        textLayerDiv.dataset.page = canvas.dataset.page || '';
        textLayerDiv.style.width = canvas.style.width;
        textLayerDiv.style.height = canvas.style.height;
        container.appendChild(textLayerDiv);
        const textContent = await page.getTextContent();
        if (!this.pdf || !textLayerDiv.isConnected) return;
        pdfjs.renderTextLayer({ textContentSource: textContent, container: textLayerDiv, viewport: vp });
      } catch (_) {}
    }

    /** 缓存某一页文本（书签/搜索用，后台异步） */,

    async _pdfCacheText(n, page) {
      try {
        const tc = await page.getTextContent();
        const txt = tc.items.map((it) => it.str || '').join(' ').replace(/\s+/g, ' ').trim();
        if (this.pdf) this.pdf.textCache[n] = txt;
      } catch (_) {}
    }
,

    _onPdfScroll() {
      const p = this.pdf;
      if (!p) return;
      const c = p.container;
      this._updatePdfProgress();
      // 接近底部时补渲染当前窗口；随后回收窗口外页面 + 恢复滚回页
      if (p.renderedTo < p.numPages && c.scrollTop + c.clientHeight > c.scrollHeight - c.clientHeight * 1.5) {
        this._renderMorePdfPages();
      }
      this._managePdfWindow();
    }
,

    _updatePdfProgress() {
      const p = this.pdf;
      if (!p || !p.numPages) return;
      const c = p.container;
      let page = 1;
      // 基于 DOM 中实际存在的 canvas 计算（窗口外页面被回收后不参与）
      const canvases = c.querySelectorAll('.pdf-page');
      for (const cv of canvases) {
        if (cv.offsetTop <= c.scrollTop + 4) page = parseInt(cv.dataset.page, 10);
        else break;
      }
      p.current = page;
      this.currentCfi = PDF_PREFIX + page;
      const percent = Math.min(100, Math.max(0, (page / p.numPages) * 100));
      this.onProgress({ cfi: this.currentCfi, percent });
    }
,

    async _goToPdfPage(n) {
      const p = this.pdf;
      if (!p || !p.numPages) return;
      n = Math.min(Math.max(1, n), p.numPages);
      if (n > p.renderedTo) {
        // 跳转只渲染目标页窗口，中间页按滚动懒加载（避免远距离跳转一次性渲染大量页）
        const keep = this._pdfKeepPages();
        await this._renderPdfWindow(n - keep, n + keep);
      }
      let rec = p.pages[n];
      if (!rec || !rec.canvas || !rec.canvas.isConnected) {
        rec = await this._renderPdfPage(n); // 目标页在窗口外已被回收 → 重新渲染
      }
      if (!rec || !rec.canvas) return;
      const c = p.container;
      c.scrollTop = Math.max(0, rec.canvas.offsetTop - 2);
      this._updatePdfProgress();
    }
,

    async _reflowPdf() {
      const p = this.pdf;
      if (!p) return;
      const cur = p.current || 1;
      p.container.innerHTML = '';
      p.pages = [];
      p.renderedTo = 0;
      const keep = this._pdfKeepPages();
      await this._renderPdfWindow(cur - keep, cur + keep);
      if (cur) await this._goToPdfPage(cur);
    }

    /* ---------- TXT ---------- */,

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

  });
})(window);
