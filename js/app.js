/* ============================================================
 * app.js — 主入口（初始化 + 事件绑定）
 * 拆分自原 app.js：逻辑见 app-tools/library/settings/reader.js
 * ============================================================ */
(function () {
  'use strict';

  const els = AppEls;
  const s = AppState;

/* ================= 拖拽 ================= */
  function bindDragDrop() {
    ['dragenter', 'dragover'].forEach((ev) => {
      document.addEventListener(ev, (e) => {
        e.preventDefault();
        els.dropOverlay.classList.remove('hidden');
      });
    });
    ['dragleave', 'drop'].forEach((ev) => {
      document.addEventListener(ev, (e) => {
        e.preventDefault();
        if (ev === 'dragleave' && e.relatedTarget) return;
        els.dropOverlay.classList.add('hidden');
      });
    });
    document.addEventListener('drop', (e) => {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) {
        Array.from(files).forEach(importFile);
      }
    });
  }
/* ================= 初始化 ================= */
  function init() {
    const settings = Storage.getSettings();
    // 初始化界面语言（zh / en / ja）并应用 data-i18n 文案
    CosmosI18n.setLang(settings.lang || 'zh');
    document.body.className = 'theme-' + settings.theme;
    els.fontSizeRange.value = settings.fontSize;
    els.fontSizeVal.textContent = settings.fontSize + 'px';
    els.lineHeightRange.value = settings.lineHeight;
    els.lineHeightVal.textContent = settings.lineHeight;
    els.marginRange.value = settings.margin;
    els.marginVal.textContent = settings.margin + '%';
    els.fontPickerLabel.textContent = fontLabelOf(settings.fontFamily);
    updateFlowSeg(settings.flow);
    els.volumeKeyToggle.checked = !!settings.volumeKeyTurn;
    els.customBgInput.value = settings.customBg || themeColorsOf(hasCustomColors() ? 'custom' : settings.theme).bg;
    els.customTextInput.value = settings.customText || themeColorsOf(hasCustomColors() ? 'custom' : settings.theme).text;
    els.customAccentInput.value = settings.customAccent || themeColorsOf(hasCustomColors() ? 'custom' : settings.theme).accent;
    els.customBorderInput.value = settings.customBorder || themeColorsOf(hasCustomColors() ? 'custom' : settings.theme).border;
    els.customTextDimInput.value = settings.customTextDim || themeColorsOf(hasCustomColors() ? 'custom' : settings.theme).textDim;
    updateThemePickerUI();

    renderThemeOptions();
    showCustomColors(hasCustomColors());
    applyCustomTheme(); // 应用已保存的自定义主题色到 body 变量（拆分后 init 曾遗漏）
    renderFontOptions();
    renderCustomFontList();
    loadFontAssets();
    syncNativeVolumeKey();
    bindLangPicker();

    renderLibrary();
    bindDragDrop();
    bindBackButton();

    /* 顶部按钮 */
    els.btnBack.addEventListener('click', backToLibrary);
    els.btnPrev.addEventListener('click', () => s.reader && s.reader.prev());
    els.btnNext.addEventListener('click', () => s.reader && s.reader.next());

    /* 阅读区点击中间区域切换上下栏（主要针对 TXT；EPUB 由 s.reader.js 回调处理） */
    els.readerWrap.addEventListener('click', (e) => {
      if (e.target.closest('#page-nav') || e.target.closest('button') || e.target.closest('a')) return;
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) return;
      const r = els.readerWrap.getBoundingClientRect();
      const x = e.clientX - r.left;
      if (x >= r.width * 0.25 && x <= r.width * 0.75) toggleBars();
    });

    /* 右下角悬浮按钮（新建文件夹 / 导入小说，展开动画） */
    els.fabMain.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFab();
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#fab-wrap')) toggleFab(false);
    });
    els.fabNewFolder.addEventListener('click', async () => {
      toggleFab(false);
      const name = await showInputModal(t('common.newFolder'), t('input.folderName'));
      if (name === null) return;
      if (!name.trim()) { showToast(t('toast.nameEmpty')); return; }
      Storage.createFolder(name);
      renderLibrary();
      showToast(t('toast.folderCreated'));
    });
    els.fabImport.addEventListener('click', () => {
      toggleFab(false);
      els.fileInput.click();
    });
    els.btnFolderBack.addEventListener('click', backToLibraryRoot);
    els.btnFolderRename.addEventListener('click', async () => {
      const f = Storage.getFolders().find((x) => x.id === s.currentFolderId);
      if (!f) return;
      const name = await showInputModal(t('common.rename'), t('input.folderName'), f.name);
      if (name === null) return;
      if (!name.trim()) { showToast('名称不能为空'); return; }
      Storage.renameFolder(f.id, name.trim());
      renderLibrary();
      showToast(t('toast.folderRenamed'));
    });
    els.btnFolderDelete.addEventListener('click', async () => {
      const f = Storage.getFolders().find((x) => x.id === s.currentFolderId);
      if (!f) return;
      const ok = await confirmModal(t('confirm.deleteFolder', { name: f.name }), t('common.delete'));
      if (!ok) return;
      Storage.deleteFolder(f.id);
      s.currentFolderId = null;
      renderLibrary();
      showToast(t('toast.folderDeleted'));
    });
    els.btnFolderImport.addEventListener('click', () => els.fileInput.click());
    els.btnMoveClose.addEventListener('click', closeMoveModal);
    els.moveModal.addEventListener('click', (e) => { if (e.target === els.moveModal) closeMoveModal(); });

    /* 长按卡片操作菜单 */
    els.cardMenuMove.addEventListener('click', () => {
      const id = s.cardMenuBookId;
      closeCardMenu();
      if (id) openMoveModal(id);
    });
    els.cardMenuDelete.addEventListener('click', () => {
      const id = s.cardMenuBookId;
      closeCardMenu();
      if (id) deleteBook(id);
    });
    els.cardMenuCancel.addEventListener('click', closeCardMenu);
    els.cardMenu.addEventListener('click', (e) => { if (e.target === els.cardMenu) closeCardMenu(); });

    /* 长按菜单：预览信息 */
    els.cardMenuInfo.addEventListener('click', () => {
      const id = s.cardMenuBookId;
      closeCardMenu();
      if (id) openBookInfo(id);
    });

    /* 长按菜单：多选（进入多选模式并自动勾选当前书） */
    els.cardMenuSelect.addEventListener('click', () => {
      const id = s.cardMenuBookId;
      closeCardMenu();
      enterSelectMode();
      if (id) toggleSelect(id);
    });

    /* 书籍信息弹窗 */
    els.btnInfoClose.addEventListener('click', closeBookInfo);
    els.btnInfoClose2.addEventListener('click', closeBookInfo);
    els.bookInfoModal.addEventListener('click', (e) => { if (e.target === els.bookInfoModal) closeBookInfo(); });
    els.btnInfoRead.addEventListener('click', () => {
      const id = s.bookInfoId;
      closeBookInfo();
      if (id) openBook(id);
    });

    /* 排序菜单 */
    els.btnSort.addEventListener('click', openSortMenu);
    els.btnLibrarySettings.addEventListener('click', () => togglePanel('settingsPanel'));
    els.settingsMask.addEventListener('click', () => togglePanel('settingsPanel', false));
    els.sortMenu.querySelectorAll('.sheet-item[data-sort]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Storage.setSettings({ bookSort: btn.dataset.sort });
        closeSortMenu();
        renderLibrary();
      });
    });
    els.sortMenuCancel.addEventListener('click', closeSortMenu);
    els.sortMenu.addEventListener('click', (e) => { if (e.target === els.sortMenu) closeSortMenu(); });

    /* 书库搜索 */
    els.librarySearch.addEventListener('input', (e) => {
      s.librarySearch = e.target.value || '';
      renderLibrary();
    });

    /* 多选 */
    els.selectMove.addEventListener('click', selectBatchMove);
    els.selectDelete.addEventListener('click', selectBatchDelete);
    els.selectAll.addEventListener('click', toggleSelectAll);
    els.selectCancel.addEventListener('click', exitSelectMode);

    /* 弹窗按钮 */
    els.btnInputOk.addEventListener('click', () => resolveInput(els.inputField.value));
    els.btnInputCancel.addEventListener('click', () => resolveInput(null));
    els.btnInputClose.addEventListener('click', () => resolveInput(null));
    els.inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') resolveInput(els.inputField.value);
      else if (e.key === 'Escape') resolveInput(null);
    });
    els.inputModal.addEventListener('click', (e) => { if (e.target === els.inputModal) resolveInput(null); });
    els.btnConfirmOk.addEventListener('click', () => resolveConfirm(true));
    els.btnConfirmCancel.addEventListener('click', () => resolveConfirm(false));
    els.confirmModal.addEventListener('click', (e) => { if (e.target === els.confirmModal) resolveConfirm(false); });

    els.fileInput.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importFile(f);
      e.target.value = '';
    });

    /* 面板 */
    $('btn-toc').addEventListener('click', () => togglePanel('panelToc'));
    $('btn-bookmarks').addEventListener('click', () => togglePanel('panelBookmarks'));
    $('btn-settings').addEventListener('click', () => togglePanel('settingsPanel'));
    $('btn-search').addEventListener('click', () => togglePanel('searchPanel'));
    $('btn-search-close').addEventListener('click', () => togglePanel('searchPanel', false));
    $('btn-search-go').addEventListener('click', doSearch);
    els.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSearch();
      else if (e.key === 'Escape') togglePanel('searchPanel', false);
    });

    document.querySelectorAll('.panel-close').forEach((btn) => {
      btn.addEventListener('click', () => {
        const el = document.getElementById(btn.dataset.close);
        if (el) el.classList.add('hidden');
        // 设置面板关闭时同步隐藏遮罩，避免屏幕残留变暗
        if (el === els.settingsPanel) els.settingsMask.classList.add('hidden');
      });
    });

    els.btnAddBookmark.addEventListener('click', addBookmark);

    /* 划线（选中文本后操作条） */
    document.querySelectorAll('.hl-color').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!s.pendingHighlight || !s.currentBookId || !s.reader) return;
        const color = btn.dataset.color || 'yellow';
        s.reader.addHighlight(s.pendingHighlight.cfi, color);
        Storage.addBookmark(s.currentBookId, { cfi: s.pendingHighlight.cfi, text: s.pendingHighlight.text, date: Date.now(), type: 'highlight', color });
        s.pendingHighlight = null;
        els.hlBar.classList.add('hidden');
        renderBookmarks();
        showToast(t('toast.highlighted'));
      });
    });
    els.hlCancel.addEventListener('click', () => { s.pendingHighlight = null; els.hlBar.classList.add('hidden'); });
    els.hlClear.addEventListener('click', clearPendingHighlight);

    /* 自定义划线颜色 */
    els.hlColorInput.addEventListener('change', () => {
      if (!s.pendingHighlight || !s.currentBookId || !s.reader) return;
      const color = els.hlColorInput.value;
      s.reader.addHighlight(s.pendingHighlight.cfi, color);
      Storage.addBookmark(s.currentBookId, { cfi: s.pendingHighlight.cfi, text: s.pendingHighlight.text, date: Date.now(), type: 'highlight', color });
      s.pendingHighlight = null;
      els.hlBar.classList.add('hidden');
      renderBookmarks();
      showToast('已划线');
    });

    /* 数据备份 */
    els.btnExportBackup.addEventListener('click', exportBackup);
    els.btnImportBackup.addEventListener('click', () => els.backupFileInput.click());
    els.btnExportNotes.addEventListener('click', exportNotes);
    els.backupFileInput.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importBackup(f);
      e.target.value = '';
    });

    /* 设置 */
    els.fontSizeRange.addEventListener('input', () => {
      const v = parseInt(els.fontSizeRange.value, 10);
      els.fontSizeVal.textContent = v + 'px';
      Storage.setSettings({ fontSize: v });
      if (s.reader) s.reader.setFontSize(v);
    });
    els.lineHeightRange.addEventListener('input', () => {
      const v = parseFloat(els.lineHeightRange.value);
      els.lineHeightVal.textContent = v.toFixed(1);
      Storage.setSettings({ lineHeight: v });
      if (s.reader) s.reader.setLineHeight(v);
    });
    els.marginRange.addEventListener('input', () => {
      const v = parseInt(els.marginRange.value, 10);
      els.marginVal.textContent = v + '%';
      Storage.setSettings({ margin: v });
      if (s.reader) s.reader.setMargin(v);
    });
    /* 字体选择器（自定义下拉） */
    els.fontPickerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      els.fontPickerMenu.classList.toggle('hidden');
      els.fontPicker.classList.toggle('open', !els.fontPickerMenu.classList.contains('hidden'));
    });
    document.addEventListener('click', () => {
      els.fontPickerMenu.classList.add('hidden');
      els.fontPicker.classList.remove('open');
      els.themePickerMenu.classList.add('hidden');
      els.themePicker.classList.remove('open');
    });

    /* 自定义字体 */
    els.btnImportFont.addEventListener('click', () => els.fontFileInput.click());
    els.fontFileInput.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importFontFile(f);
      e.target.value = '';
    });
    /* 阅读模式分段控件 */
    els.flowSeg.querySelectorAll('.seg-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const v = b.dataset.flow;
        Storage.setSettings({ flow: v });
        if (s.reader) s.reader.setFlow(v);
        updateFlowSeg(v);
      });
    });
    els.volumeKeyToggle.addEventListener('change', () => {
      Storage.setSettings({ volumeKeyTurn: els.volumeKeyToggle.checked });
      syncNativeVolumeKey();
    });
    /* 主题选择器（自定义下拉） */
    els.themePickerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      els.themePickerMenu.classList.toggle('hidden');
      els.themePicker.classList.toggle('open', !els.themePickerMenu.classList.contains('hidden'));
    });

    /* 自定义颜色折叠 */
    els.customColorsToggle.addEventListener('click', () => toggleCustomColors());

    /* 自定义背景 / 自定义文字颜色 / 自定义强调色 */
    els.customBgInput.addEventListener('change', () => {
      Storage.setSettings({ customBg: els.customBgInput.value || null });
      applyCustomTheme();
    });
    els.customTextInput.addEventListener('change', () => {
      Storage.setSettings({ customText: els.customTextInput.value || null });
      applyCustomTheme();
    });
    els.customAccentInput.addEventListener('change', () => {
      Storage.setSettings({ customAccent: els.customAccentInput.value || null });
      applyCustomTheme();
    });
    els.customBorderInput.addEventListener('change', () => {
      Storage.setSettings({ customBorder: els.customBorderInput.value || null });
      applyCustomTheme();
    });
    els.customTextDimInput.addEventListener('change', () => {
      Storage.setSettings({ customTextDim: els.customTextDimInput.value || null });
      applyCustomTheme();
    });
    els.btnBgReset.addEventListener('click', () => {
      Storage.setSettings({ customBg: null });
      els.customBgInput.value = '#ffffff';
      applyCustomTheme();
    });
    els.btnTextReset.addEventListener('click', () => {
      Storage.setSettings({ customText: null });
      els.customTextInput.value = '#2c2c2c';
      applyCustomTheme();
    });
    els.btnAccentReset.addEventListener('click', () => {
      Storage.setSettings({ customAccent: null });
      els.customAccentInput.value = '#b8860b';
      applyCustomTheme();
    });
    els.btnBorderReset.addEventListener('click', () => {
      Storage.setSettings({ customBorder: null });
      els.customBorderInput.value = '#e4dfd3';
      applyCustomTheme();
    });
    els.btnTextDimReset.addEventListener('click', () => {
      Storage.setSettings({ customTextDim: null });
      els.customTextDimInput.value = '#8a8578';
      applyCustomTheme();
    });

    /* 快捷键 */
    document.addEventListener('keydown', (e) => {
      // 音量键翻页（可在设置中开关）
      if (e.key === 'VolumeUp' || e.key === 'AudioVolumeUp') {
        if (Storage.getSettings().volumeKeyTurn) { e.preventDefault(); s.reader && s.reader.next(); }
      } else if (e.key === 'VolumeDown' || e.key === 'AudioVolumeDown') {
        if (Storage.getSettings().volumeKeyTurn) { e.preventDefault(); s.reader && s.reader.prev(); }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        togglePanel('searchPanel');
      } else if (e.key === 'Escape') {
        closeAllPanels();
      } else if (!els.topbar.classList.contains('hidden') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
          e.preventDefault();
          s.reader && s.reader.next();
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault();
          s.reader && s.reader.prev();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
        }
      }
    });

    /* 音量键翻页（Android：原生 MainActivity 拦截音量键后触发的事件） */
    document.addEventListener('volumeUp', () => {
      if (Storage.getSettings().volumeKeyTurn) { s.reader && s.reader.next(); }
    });
    document.addEventListener('volumeDown', () => {
      if (Storage.getSettings().volumeKeyTurn) { s.reader && s.reader.prev(); }
    });

    // 窗口尺寸变化由 s.reader 内部处理
  }
  document.addEventListener('DOMContentLoaded', init);
})(window);
