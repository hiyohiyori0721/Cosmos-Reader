/* ============================================================
 * app-reader.js — 阅读UI（状态条/沉浸/返回键/目录/书签/搜索/划线/面板）
 * 依赖：app-state.js（AppEls/AppState）、config.js、utils.js
 * ============================================================ */
(function () {
  'use strict';

  const els = AppEls;
  const s = AppState;
  const escapeRegExp = CosmosUtils.escapeRegExp;


  function startStatusTimer() {
    const tick = () => {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      els.statusTime.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
    };
    tick();
    clearInterval(s.statusTimer);
    s.statusTimer = setInterval(tick, 1000);
  }

  function stopStatusTimer() {
    if (s.statusTimer) { clearInterval(s.statusTimer); s.statusTimer = null; }
  }
/** 读取系统电量（Battery API，可视电池条 + 百分比；低电量变红） */
  function updateBattery() {
    const setBattery = (level) => {
      const pct = Math.max(0, Math.min(100, Math.round((level || 0) * 100)));
      els.statusBatteryFill.style.width = pct + '%';
      els.statusBatteryFill.classList.toggle('low', pct <= 20);
      els.statusBatteryText.textContent = pct + '%';
    };
    setBattery(0);
    if (!navigator.getBattery) { els.statusBatteryText.textContent = ''; els.statusBatteryFill.style.width = '0%'; return; }
    try {
      navigator.getBattery().then((b) => {
        const render = () => setBattery(b.level);
        render();
        b.addEventListener('levelchange', render);
      }).catch(() => {});
    } catch (_) {}
  }
/** 5 秒后自动进入沉浸模式（仍在阅读、未沉浸、且无面板打开时） */
  function scheduleAutoHide() {
    clearTimeout(s.autoHideTimer);
    s.autoHideTimer = setTimeout(() => {
      s.autoHideTimer = null;
      if (els.readerWrap.classList.contains('hidden')) return;      // 已退出阅读
      if (document.body.classList.contains('bars-hidden')) return;   // 已沉浸
      const panelOpen = ['panelToc', 'panelBookmarks', 'searchPanel', 'settingsPanel']
        .some((k) => !els[k].classList.contains('hidden'));
      if (panelOpen) { scheduleAutoHide(); return; }                 // 面板打开中，稍后再试
      toggleBars();                                                  // 自动进入沉浸
    }, 5000);
  }
/** 切换沉浸模式：收起/展开顶部工具栏与底部翻页栏 */
  function toggleBars() {
    const hidden = document.body.classList.toggle('bars-hidden');
    if (hidden) {
      // 进入沉浸：清除自动隐藏计时器，并关闭所有面板（避免面板悬空错位）
      if (s.autoHideTimer) { clearTimeout(s.autoHideTimer); s.autoHideTimer = null; }
      closeAllPanels();
    } else {
      // 展开上下栏后 5 秒自动再次进入沉浸
      scheduleAutoHide();
    }
    // 阅读区全屏，上下栏悬浮覆盖其上，切换时无需重新排版
  }

  function backToLibrary() {
    document.body.classList.remove('bars-hidden');
    if (s.autoHideTimer) { clearTimeout(s.autoHideTimer); s.autoHideTimer = null; }
    // 退出前强制保存当前阅读进度（避免 800ms 节流导致最后翻页位置丢失）
    if (s.reader && s.currentBookId) {
      try {
        const gp = s.reader.getProgress();
        if (gp && gp.cfi) {
          Storage.setProgress(s.currentBookId, { cfi: gp.cfi, percent: Math.min(100, Math.max(0, gp.percent)) / 100 });
          Storage.upsertBookMeta({ id: s.currentBookId, progress: Math.min(100, Math.max(0, gp.percent)) / 100, lastReadAt: Date.now() });
        }
      } catch (_) {}
    }
    if (s.reader) { try { s.reader.destroy(); } catch (_) {} }
    s.reader = null;
    s.currentBookId = null;
    els.topbar.classList.add('hidden');
    els.readerWrap.classList.add('hidden');
    closeAllPanels();
    els.fabWrap.classList.remove('hidden'); // 返回书库恢复悬浮按钮
    els.readerStatus.classList.add('hidden'); // 隐藏阅读状态
    stopStatusTimer();
    els.libraryView.classList.remove('hidden');
    renderLibrary();
  }
/* ================= 返回键处理（Android） ================= */
  function handleBackButton() {
    // 1. 弹窗优先关闭
    let any = false;
    ['move-modal', 'input-modal', 'confirm-modal', 'card-menu', 'sort-menu', 'book-info-modal'].forEach((id) => {
      const el = document.getElementById(id);
      if (el && !el.classList.contains('hidden')) { el.classList.add('hidden'); any = true; }
    });
    if (any) return true;
    // 2. 多选模式先退出
    if (s.selectMode) { exitSelectMode(); return true; }
    // 3. 打开的面板
    if (!els.searchPanel.classList.contains('hidden') || !els.panelToc.classList.contains('hidden') ||
        !els.panelBookmarks.classList.contains('hidden') || !els.settingsPanel.classList.contains('hidden')) {
      closeAllPanels();
      return true;
    }
    // 4. 阅读界面 → 返回书库
    if (!els.readerWrap.classList.contains('hidden')) { backToLibrary(); return true; }
    // 5. 文件夹视图 → 返回书库主页
    if (s.currentFolderId) { backToLibraryRoot(); return true; }
    return false; // 书库：由调用方决定是否退出
  }

  function bindBackButton() {
    try {
      const cap = window.Capacitor;
      if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
      const app = (cap.Plugins && cap.Plugins.App) || null;
      if (!app || !app.addListener) return;
      let backAt = 0;
      app.addListener('backButton', () => {
        if (handleBackButton()) return;
        // 书库：再按一次退出
        const now = Date.now();
        if (now - backAt < 2000) {
          if (app.exitApp) app.exitApp();
        } else {
          backAt = now;
          showToast(t('toast.exitAgain'));
        }
      });
    } catch (_) {}
  }
/* ================= 目录 ================= */
  function renderToc() {
    els.tocList.innerHTML = '';
    if (!s.currentToc.length) {
      els.tocList.innerHTML = '<div class="search-empty">' + t('toc.empty') + '</div>';
      return;
    }
    function walk(items, depth) {
      items.forEach((it) => {
        const btn = document.createElement('button');
        btn.className = 'toc-item level-' + Math.min(depth, 6);
        btn.textContent = it.label || t('book.noTitle');
        btn.addEventListener('click', () => {
          s.reader.goToHref(it.href);
          togglePanel('panelToc', false);
        });
        els.tocList.appendChild(btn);
        if (it.subitems && it.subitems.length) walk(it.subitems, depth + 1);
      });
    }
    walk(s.currentToc, 1);
  }
/* ================= 书签 ================= */
  async function renderBookmarks() {
    if (!s.currentBookId) return;
    const list = Storage.getBookmarks(s.currentBookId);
    els.bookmarkList.innerHTML = '';
    if (!list.length) {
      els.bookmarkList.innerHTML = '<div class="search-empty">' + t('bookmarks.empty') + '</div>';
      return;
    }
    list.forEach((bm, i) => {
      const item = document.createElement('div');
      item.className = 'bookmark-item' + (bm.type === 'highlight' ? ' is-hl' : '');
      const meta = document.createElement('div');
      meta.className = 'bm-meta';
      if (bm.type === 'highlight') {
        const dot = document.createElement('span');
        if (/^#([0-9a-f]{6})$/i.test(bm.color || '')) {
          // 自定义颜色：直接设色点背景
          dot.className = 'hl-dot';
          dot.style.background = bm.color;
        } else {
          dot.className = 'hl-dot hl-' + (bm.color || 'yellow');
        }
        meta.appendChild(dot);
      }
      meta.appendChild(document.createTextNode(
        (bm.type === 'highlight' ? t('bookmarks.highlight') : t('bookmarks.bookmark')) + ' #' + (i + 1) + ' · ' +
        new Date(bm.date).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      ));
      const text = document.createElement('div');
      text.className = 'bm-text';
      text.textContent = bm.text || t('bookmarks.noText');
      const btns = document.createElement('div');
      btns.className = 'bm-btns';
      const go = document.createElement('button');
      go.className = 'bm-goto';
      go.textContent = t('bookmarks.goto');
      go.addEventListener('click', () => s.reader.goToCfi(bm.cfi, true, false));
      const del = document.createElement('button');
      del.className = 'bm-del';
      del.textContent = t('common.delete');
      del.addEventListener('click', () => {
        Storage.removeBookmark(s.currentBookId, bm.cfi);
        if (bm.type === 'highlight' && s.reader) s.reader.removeHighlight(bm.cfi);
        renderBookmarks();
      });
      btns.appendChild(go);
      btns.appendChild(del);
      item.appendChild(meta);
      item.appendChild(text);
      item.appendChild(btns);
      els.bookmarkList.appendChild(item);
    });
  }

  async function addBookmark() {
    if (!s.reader || !s.currentBookId) return;
    const cfi = s.reader.currentCfi;
    if (!cfi) { showToast(t('toast.noPosition')); return; }
    let text = await s.reader.getTextAt(cfi);
    if (!text) text = s.reader.getCurrentText();
    Storage.addBookmark(s.currentBookId, { cfi, text, date: Date.now() });
    renderBookmarks();
    showToast(t('toast.bookmarkAdded'));
  }
/* ================= 搜索 ================= */
  async function doSearch() {
    const q = els.searchInput.value.trim();
    els.searchResults.innerHTML = '';
    if (!q || !s.reader) return;
    const results = await s.reader.search(q);
    if (!results.length) {
      els.searchResults.innerHTML = '<div class="search-empty">' + t('search.noResult', { q: q }) + '</div>';
      return;
    }
    const heading = document.createElement('div');
    heading.className = 'search-empty';
    heading.style.textAlign = 'left';
    heading.innerHTML = t('search.hits', { n: results.length });
    els.searchResults.appendChild(heading);

    results.forEach((r) => {
      const btn = document.createElement('button');
      btn.className = 'search-item';
      const idx = (r.excerpt || '').toLowerCase().indexOf(q.toLowerCase());
      let display = r.excerpt || '';
      if (idx > -1) {
        const s = Math.max(0, idx - 20);
        display = (s > 0 ? '…' : '') + r.excerpt.slice(s, idx + q.length + 40) + '…';
      }
      btn.innerHTML = display.replace(new RegExp(escapeRegExp(q), 'gi'), (m) => '<span class="hits">' + m + '</span>');
      btn.addEventListener('click', () => {
        AppState.reader.goToCfi(r.cfi, true, false);
        togglePanel('searchPanel', false);
      });
      els.searchResults.appendChild(btn);
    });
  }
/* ================= 面板开关 ================= */
  function togglePanel(name, show) {
    const el = els[name] || (typeof name === 'string' ? $('panel-' + name) : null);
    if (!el) return;
    if (show === undefined) show = el.classList.contains('hidden');
    if (show) {
      // 关闭其它面板
      ['panelToc', 'panelBookmarks', 'searchPanel', 'settingsPanel'].forEach((k) => {
        if (els[k] && els[k] !== el) els[k].classList.add('hidden');
      });
      el.classList.remove('hidden');
      // 设置面板显示遮罩
      els.settingsMask.classList.toggle('hidden', el !== els.settingsPanel);
      // 打开设置面板时同步自定义颜色区显示（仅"自定义"主题显示）
      if (el === els.settingsPanel) showCustomColors(hasCustomColors());
      if (name === 'search-panel' || name === 'searchPanel') {
        els.searchInput.focus();
        els.searchInput.select();
      }
    } else {
      el.classList.add('hidden');
      if (el === els.settingsPanel) els.settingsMask.classList.add('hidden');
    }
  }

  function closeAllPanels() {
    ['panelToc', 'panelBookmarks', 'searchPanel', 'settingsPanel'].forEach((k) => els[k].classList.add('hidden'));
    els.settingsMask.classList.add('hidden');
  }
  Object.assign(globalThis, { addBookmark, backToLibrary, bindBackButton, closeAllPanels, doSearch, handleBackButton, renderBookmarks, renderToc, scheduleAutoHide, startStatusTimer, stopStatusTimer, toggleBars, togglePanel, updateBattery });
})(window);
