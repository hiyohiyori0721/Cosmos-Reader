/* ============================================================
 * app.js — 应用主逻辑
 * 负责：书库管理、导入、视图切换、目录/书签/搜索/设置面板、
 *       进度持久化与快捷键
 * ============================================================ */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const els = {
    topbar: $('topbar'),
    readerWrap: $('reader-wrap'),
    readerEl: $('reader'),
    bookTitle: $('book-title'),
    bookAuthor: $('book-author'),
    progressText: $('progress-text'),
    libraryView: $('library-view'),
    bookGrid: $('book-grid'),
    emptyHint: $('empty-hint'),
    fileInput: $('file-input'),
    fabMain: $('fab-main'),
    fabActions: $('fab-actions'),
    fabNewFolder: $('fab-new-folder'),
    fabImport: $('fab-import'),
    btnBack: $('btn-back'),
    btnPrev: $('btn-prev'),
    btnNext: $('btn-next'),
    panelToc: $('panel-toc'),
    tocList: $('toc-list'),
    panelBookmarks: $('panel-bookmarks'),
    bookmarkList: $('bookmark-list'),
    btnAddBookmark: $('btn-add-bookmark'),
    searchPanel: $('search-panel'),
    searchInput: $('search-input'),
    searchResults: $('search-results'),
    settingsPanel: $('settings-panel'),
    customBgInput: $('custom-bg-input'),
    customTextInput: $('custom-text-input'),
    customAccentInput: $('custom-accent-input'),
    customBorderInput: $('custom-border-input'),
    customTextDimInput: $('custom-textdim-input'),
    btnBgReset: $('btn-bg-reset'),
    btnTextReset: $('btn-text-reset'),
    btnAccentReset: $('btn-accent-reset'),
    btnBorderReset: $('btn-border-reset'),
    btnTextDimReset: $('btn-textdim-reset'),
    customColorsToggle: $('custom-colors-toggle'),
    customColorsBody: $('custom-colors-body'),
    customColorsSection: $('custom-colors-section'),
    fontSizeRange: $('font-size-range'),
    fontSizeVal: $('font-size-val'),
    lineHeightRange: $('line-height-range'),
    lineHeightVal: $('line-height-val'),
    marginRange: $('margin-range'),
    marginVal: $('margin-val'),
    fontPicker: $('font-picker'),
    fontPickerBtn: $('font-picker-btn'),
    fontPickerLabel: $('font-picker-label'),
    fontPickerMenu: $('font-picker-menu'),
    flowSeg: $('flow-seg'),
    themePicker: $('theme-picker'),
    themePickerBtn: $('theme-picker-btn'),
    themePickerLabel: $('theme-picker-label'),
    themePickerMenu: $('theme-picker-menu'),
    volumeKeyToggle: $('volume-key-toggle'),
    dropOverlay: $('drop-overlay'),
    toast: $('toast'),
    folderBar: $('folder-bar'),
    folderNav: $('folder-nav'),
    folderName: $('folder-name'),
    fabWrap: $('fab-wrap'),
    btnFolderBack: $('btn-folder-back'),
    btnFolderImport: $('btn-folder-import'),
    btnFolderRename: $('btn-folder-rename'),
    btnFolderDelete: $('btn-folder-delete'),
    moveModal: $('move-modal'),
    moveList: $('move-list'),
    btnMoveClose: $('btn-move-close'),
    inputModal: $('input-modal'),
    inputModalTitle: $('input-modal-title'),
    inputField: $('input-modal-field'),
    btnInputOk: $('btn-input-ok'),
    btnInputCancel: $('btn-input-cancel'),
    btnInputClose: $('btn-input-close'),
    confirmModal: $('confirm-modal'),
    confirmText: $('confirm-modal-text'),
    btnConfirmOk: $('btn-confirm-ok'),
    btnConfirmCancel: $('btn-confirm-cancel'),
    cardMenu: $('card-menu'),
    cardMenuTitle: $('card-menu-title'),
    cardMenuMove: $('card-menu-move'),
    cardMenuDelete: $('card-menu-delete'),
    cardMenuCancel: $('card-menu-cancel'),
    cardMenuInfo: $('card-menu-info'),
    cardMenuSelect: $('card-menu-select'),
    btnSort: $('btn-sort'),
    btnLibrarySettings: $('btn-library-settings'),
    sortMenu: $('sort-menu'),
    sortMenuCancel: $('sort-menu-cancel'),
    btnImportFont: $('btn-import-font'),
    fontFileInput: $('font-file-input'),
    customFontList: $('custom-font-list'),
    selectBar: $('select-bar'),
    selectCount: $('select-count'),
    selectMove: $('select-move'),
    selectDelete: $('select-delete'),
    selectAll: $('select-all'),
    selectCancel: $('select-cancel'),
    bookInfoModal: $('book-info-modal'),
    btnInfoClose: $('btn-info-close'),
    btnInfoClose2: $('btn-info-close2'),
    btnInfoRead: $('btn-info-read'),
    bookInfoCover: $('book-info-cover'),
    biTitle: $('bi-title'),
    biAuthor: $('bi-author'),
    biType: $('bi-type'),
    biSize: $('bi-size'),
    biProgress: $('bi-progress'),
    biAdded: $('bi-added'),
    biLastread: $('bi-lastread'),
    hlBar: $('hl-bar'),
    hlCancel: $('hl-cancel'),
    hlClear: $('hl-clear'),
    hlColorInput: $('hl-color-input'),
    readerStatus: $('reader-status'),
    statusTime: $('status-time'),
    statusBatteryFill: $('battery-fill'),
    statusBatteryText: $('battery-text'),
    btnExportBackup: $('btn-export-backup'),
    btnImportBackup: $('btn-import-backup'),
    backupFileInput: $('backup-file-input'),
    settingsMask: $('settings-mask'),
  };

  /* ---- 弹窗（WebView 不支持 prompt/confirm，自建） ---- */
  let inputResolve = null;
  let confirmResolve = null;

  function showInputModal(title, placeholder, initial) {
    return new Promise((resolve) => {
      inputResolve = resolve;
      els.inputModalTitle.textContent = title || '输入';
      els.inputField.placeholder = placeholder || '请输入';
      els.inputField.value = initial || '';
      els.inputModal.classList.remove('hidden');
      setTimeout(() => { els.inputField.focus(); }, 50);
    });
  }

  function resolveInput(val) {
    els.inputModal.classList.add('hidden');
    if (inputResolve) { inputResolve(val); inputResolve = null; }
  }

  function confirmModal(text, okText) {
    return new Promise((resolve) => {
      confirmResolve = resolve;
      els.confirmText.textContent = text || '确定吗？';
      els.btnConfirmOk.textContent = okText || '确定';
      els.confirmModal.classList.remove('hidden');
    });
  }

  function resolveConfirm(val) {
    els.confirmModal.classList.add('hidden');
    if (confirmResolve) { confirmResolve(val); confirmResolve = null; }
  }

  let reader = null;
  let currentBookId = null;
  let currentToc = [];
  let toastTimer = null;
  let lastProgressSave = 0;
  let cardMenuBookId = null;
  let bookInfoId = null;
  let pendingHighlight = null; // 选中文本待划线 { cfi, text }
  let fontBlobUrls = {}; // 自定义字体 id → blob URL

  /* ================= 工具 ================= */
  /** 十六进制颜色 → rgba（自定义强调色派生浅背景用） */
  function hexToRgba(hex, alpha) {
    const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ', ' + (alpha == null ? 0.18 : alpha) + ')';
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 2400);
  }

  /** 展开/收起右下角悬浮按钮（带旋转与弹出动画） */
  function toggleFab(force) {
    const open = force === undefined ? !els.fabWrap.classList.contains('open') : !!force;
    els.fabWrap.classList.toggle('open', open);
  }

  /** 阅读中选中文本（EPUB/TXT）回调：显示/隐藏划线操作条 */
  function onSelectedText(cfi, text, clear) {
    if (clear) { pendingHighlight = null; els.hlBar.classList.add('hidden'); return; }
    if (!cfi) return;
    pendingHighlight = { cfi, text };
    els.hlBar.classList.remove('hidden');
  }

  /** 清除选中文字处的划线（划线条上的透明/清除按钮） */
  function clearPendingHighlight() {
    if (!pendingHighlight || !currentBookId) return;
    const cfi = pendingHighlight.cfi;
    const text = (pendingHighlight.text || '').trim();
    const bms = Storage.getBookmarks(currentBookId);
    // 先按 cfi 精确匹配，再按文本内容匹配（epub.js 选区 cfi 可能不同）
    let match = bms.find((b) => b.type === 'highlight' && b.cfi === cfi);
    if (!match && text) {
      match = bms.find((b) => b.type === 'highlight' && b.text && (text.indexOf(b.text) >= 0 || b.text.indexOf(text) >= 0));
    }
    pendingHighlight = null;
    els.hlBar.classList.add('hidden');
    if (!match) { showToast('该位置没有划线'); return; }
    Storage.removeBookmark(currentBookId, match.cfi);
    if (reader) reader.removeHighlight(match.cfi);
    renderBookmarks();
    showToast('已取消划线');
  }

  /* ================= 阅读状态（时间 / 电量） ================= */
  let statusTimer = null;

  function startStatusTimer() {
    const tick = () => {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      els.statusTime.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
    };
    tick();
    clearInterval(statusTimer);
    statusTimer = setInterval(tick, 1000);
  }

  function stopStatusTimer() {
    if (statusTimer) { clearInterval(statusTimer); statusTimer = null; }
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

  /* ================= 自定义字体 ================= */
  /** @font-face 中使用的字体族名（保证唯一、安全） */
  function customFontFamily(id) { return 'Custom-' + id; }

  /** 加载所有导入字体的 blob URL（供 Reader 注入 @font-face） */
  async function loadFontAssets() {
    const fonts = Storage.getFonts();
    for (const f of fonts) {
      try {
        const rec = await Storage.getFont(f.id);
        if (rec && rec.arrayBuffer) {
          fontBlobUrls[f.id] = URL.createObjectURL(new Blob([rec.arrayBuffer], { type: f.type || '' }));
        }
      } catch (_) {}
    }
  }

  /** 供 Reader 查询自定义字体：返回 { family, url, format } 或 null */
  function getCustomFont(id) {
    if (!fontBlobUrls[id]) return null;
    const meta = Storage.getFonts().find((x) => x.id === id) || {};
    return { family: customFontFamily(id), url: fontBlobUrls[id], format: meta.format || 'truetype' };
  }

  /** 字体值 → 显示名 */
  function fontLabelOf(val) {
    if (!val || val === 'default') return '跟随书籍';
    const f = Storage.getFonts().find((x) => 'font:' + x.id === val);
    return f ? f.name : '跟随书籍';
  }

  /** 同步字体选择器 UI（当前值高亮 + 按钮文字） */
  function updateFontPickerUI() {
    const cur = Storage.getSettings().fontFamily;
    els.fontPickerLabel.textContent = fontLabelOf(cur);
    els.fontPickerMenu.querySelectorAll('.picker-item').forEach((b) => {
      b.classList.toggle('active', b.dataset.value === cur);
    });
  }

  /** 阅读模式分段控件高亮 */
  function updateFlowSeg(flow) {
    els.flowSeg.querySelectorAll('.seg-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.flow === flow);
    });
  }

  const THEMES = [
    { v: 'light', label: '白天', cls: 'light', bg: '#ffffff', text: '#2c2c2c', accent: '#b8860b', border: '#e4dfd3', textDim: '#8a8578' },
    { v: 'sepia', label: '护眼', cls: 'sepia', bg: '#f2e8d5', text: '#433422', accent: '#a97832', border: '#e0d2b4', textDim: '#9a8a6d' },
    { v: 'dark', label: '夜间', cls: 'dark', bg: '#1c1c1e', text: '#d6d3cb', accent: '#d4a844', border: '#38383c', textDim: '#7c7a72' },
    { v: 'green', label: '绿意', cls: 'green', bg: '#e6efe2', text: '#2e3a2b', accent: '#4f8a43', border: '#cfddc7', textDim: '#7d8f76' },
    { v: 'blue', label: '湛蓝', cls: 'blue', bg: '#e3ecf5', text: '#293846', accent: '#3577a8', border: '#cbdae6', textDim: '#7b8f9f' },
    { v: 'ink', label: '墨夜', cls: 'ink', bg: '#121214', text: '#e4e1d9', accent: '#e0a94f', border: '#333339', textDim: '#7d7b74' },
    { v: 'custom', label: '自定义', cls: 'custom' },
  ];

  /** 是否设置了自定义颜色（决定主题选择器是否高亮"自定义"） */
  function hasCustomColors() {
    const s = Storage.getSettings();
    return !!(s.customBg || s.customText || s.customAccent || s.customBorder || s.customTextDim);
  }

  /** 主题默认背景/文字/强调/边框/次要文字色（自定义颜色输入框在无自定义值时显示） */
  function themeColorsOf(v) {
    if (v === 'custom') {
      const s = Storage.getSettings();
      const t = THEMES.find((x) => x.v === s.theme) || THEMES[0];
      return {
        bg: s.customBg || '#ffffff',
        text: s.customText || '#2c2c2c',
        accent: s.customAccent || t.accent,
        border: s.customBorder || t.border,
        textDim: s.customTextDim || t.textDim,
      };
    }
    const t = THEMES.find((x) => x.v === v) || THEMES[0];
    return { bg: t.bg, text: t.text, accent: t.accent, border: t.border, textDim: t.textDim };
  }

  /** 主题值 → 显示名 */
  function themeLabelOf(v) {
    const t = THEMES.find((x) => x.v === v);
    return t ? t.label : '白天';
  }

  /** 渲染主题选择器选项（色块预览 + 名称） */
  function renderThemeOptions() {
    const hasCustom = hasCustomColors();
    const cur = hasCustom ? 'custom' : Storage.getSettings().theme;
    els.themePickerMenu.innerHTML = '';
    THEMES.forEach((t) => {
      const o = document.createElement('button');
      o.type = 'button';
      o.className = 'picker-item theme-item' + (t.v === cur ? ' active' : '');
      o.dataset.theme = t.v;
      o.innerHTML = '<span class="swatch ' + t.cls + '"></span>' + t.label;
      o.addEventListener('click', () => {
        els.themePickerMenu.classList.add('hidden');
        els.themePicker.classList.remove('open');
        applyTheme(t.v);
      });
      els.themePickerMenu.appendChild(o);
    });
    updateThemePickerUI();
  }

  /** 同步主题选择器 UI（当前值高亮 + 按钮文字） */
  function updateThemePickerUI() {
    const cur = hasCustomColors() ? 'custom' : Storage.getSettings().theme;
    els.themePickerLabel.textContent = themeLabelOf(cur);
    els.themePickerMenu.querySelectorAll('.theme-item').forEach((b) => {
      b.classList.toggle('active', b.dataset.theme === cur);
    });
  }

  /** 刷新字体选择器选项（跟随书籍 + 已导入字体；已移除内置衬线/无衬线） */
  function renderFontOptions() {
    let cur = Storage.getSettings().fontFamily;
    els.fontPickerMenu.innerHTML = '';
    const mk = (val, label) => {
      const o = document.createElement('button');
      o.type = 'button';
      o.className = 'picker-item' + (val === cur ? ' active' : '');
      o.dataset.value = val;
      o.textContent = label;
      o.addEventListener('click', () => {
        els.fontPickerMenu.classList.add('hidden');
        els.fontPicker.classList.remove('open');
        if (val === cur) return;
        Storage.setSettings({ fontFamily: val });
        if (reader) reader.setFontFamily(val);
        updateFontPickerUI();
      });
      els.fontPickerMenu.appendChild(o);
    };
    mk('default', '跟随书籍');
    Storage.getFonts().forEach((f) => mk('font:' + f.id, f.name));
    // 若当前仍是已移除的内置字体（serif/sans-serif），回退为跟随书籍
    if (cur !== 'default' && !Storage.getFonts().some((f) => 'font:' + f.id === cur)) {
      cur = 'default';
      Storage.setSettings({ fontFamily: 'default' });
      if (reader) { try { reader.setFontFamily('default'); } catch (_) {} }
    }
    updateFontPickerUI();
  }

  /** 渲染设置面板的自定义字体列表 */
  function renderCustomFontList() {
    const fonts = Storage.getFonts();
    els.customFontList.innerHTML = '';
    if (!fonts.length) {
      els.customFontList.innerHTML = '<div class="font-list-empty">未导入字体</div>';
      return;
    }
    fonts.forEach((f) => {
      const item = document.createElement('div');
      item.className = 'custom-font-item';
      const info = document.createElement('div');
      info.className = 'custom-font-info';
      const nm = document.createElement('div');
      nm.className = 'custom-font-name';
      nm.textContent = f.name;
      const sz = document.createElement('div');
      sz.className = 'custom-font-size';
      sz.textContent = (f.size ? (f.size / 1024 / 1024).toFixed(1) : 0) + ' MB';
      info.appendChild(nm);
      info.appendChild(sz);
      const del = document.createElement('button');
      del.className = 'custom-font-del';
      del.textContent = '删除';
      del.addEventListener('click', () => deleteCustomFont(f.id));
      item.appendChild(info);
      item.appendChild(del);
      els.customFontList.appendChild(item);
    });
  }

  /** 导入字体文件（TTF/OTF/WOFF/WOFF2） */
  async function importFontFile(file) {
    if (!file) return;
    if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) {
      showToast('仅支持 TTF / OTF / WOFF / WOFF2 字体');
      return;
    }
    showToast('正在导入字体…');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const ext = (file.name.match(/\.([a-z0-9]+)$/i) || [])[1].toLowerCase();
      const format = ext === 'ttf' ? 'truetype' : ext === 'otf' ? 'opentype' : ext === 'woff' ? 'woff' : 'woff2';
      const base = file.name.replace(/\.[a-z0-9]+$/i, '').trim() || '自定义字体';
      const id = Storage.genId();
      await Storage.saveFont(id, arrayBuffer);
      Storage.upsertFontMeta({
        id, name: base, family: customFontFamily(id),
        type: file.type || '', format, size: arrayBuffer.byteLength, addedAt: Date.now(),
      });
      fontBlobUrls[id] = URL.createObjectURL(new Blob([arrayBuffer], { type: file.type || '' }));
      renderFontOptions();
      renderCustomFontList();
      showToast('已导入字体：' + base);
    } catch (e) {
      console.error(e);
      showToast('字体导入失败');
    }
  }

  /** 删除自定义字体（若正在使用则回退为跟随书籍） */
  async function deleteCustomFont(id) {
    const f = Storage.getFonts().find((x) => x.id === id);
    const ok = await confirmModal(`确定删除字体「${f ? f.name : ''}」吗？`, '删除');
    if (!ok) return;
    if (fontBlobUrls[id]) { try { URL.revokeObjectURL(fontBlobUrls[id]); } catch (_) {} delete fontBlobUrls[id]; }
    await Storage.deleteFont(id);
    Storage.removeFontMeta(id);
    if (Storage.getSettings().fontFamily === 'font:' + id) {
      Storage.setSettings({ fontFamily: 'default' });
    }
    renderFontOptions();
    renderCustomFontList();
    if (reader) reader.setFontFamily(Storage.getSettings().fontFamily);
    showToast('已删除字体');
  }

  async function extractMeta(arrayBuffer) {
    let title = '未命名', author = '';
    let coverBlob = null;
    try {
      // 直接用 JSZip 读取元数据，避免 epub.js 完整解析全书（大书更快）
      const zip = await JSZip.loadAsync(arrayBuffer);
      const container = await zip.file('META-INF/container.xml').async('string');
      const cDoc = new DOMParser().parseFromString(container, 'application/xml');
      const rootfiles = cDoc.getElementsByTagNameNS('*', 'rootfile');
      let opfPath = (rootfiles && rootfiles.length) ? rootfiles[0].getAttribute('full-path') : null;
      if (!opfPath) opfPath = 'OEBPS/content.opf';

      const opfEntry = zip.file(opfPath);
      if (opfEntry) {
        const opf = await opfEntry.async('string');
        const oDoc = new DOMParser().parseFromString(opf, 'application/xml');
        const t = oDoc.getElementsByTagNameNS('*', 'title');
        if (t && t.length && t[0].textContent) title = t[0].textContent.trim() || '未命名';
        const cr = oDoc.getElementsByTagNameNS('*', 'creator');
        if (cr && cr.length && cr[0].textContent) author = cr[0].textContent.trim();
        coverBlob = await extractCoverFromOpf(zip, oDoc, opfPath);
      }
    } catch (_) {
      // 结构异常时回退 epub.js
      try {
        const book = ePub(arrayBuffer);
        await book.ready;
        const m = await book.loaded.metadata;
        title = m.title || title;
        author = Array.isArray(m.creator) ? (m.creator[0] || '') : (m.creator || '');
      } catch (_) {}
    }
    return { title, author, coverBlob };
  }

  /** 从 OPF 中提取封面图（支持多种封面标识，找不到时取第一张图片） */
  async function extractCoverFromOpf(zip, oDoc, opfPath) {
    try {
      const items = Array.prototype.slice.call(oDoc.getElementsByTagNameNS('*', 'item'));
      if (!items.length) return null;

      let coverId = null;
      const metas = oDoc.getElementsByTagNameNS('*', 'meta');
      for (const meta of metas) {
        if ((meta.getAttribute('name') || '') === 'cover') { coverId = meta.getAttribute('content'); break; }
      }

      let coverHref = null;
      let firstImageHref = null;
      for (const it of items) {
        const id = (it.getAttribute('id') || '').toLowerCase();
        const props = it.getAttribute('properties') || '';
        const mediaType = it.getAttribute('media-type') || '';
        const href = it.getAttribute('href');
        if (coverId && id === coverId.toLowerCase()) { coverHref = href; break; }
        if (props.split(/\s+/).indexOf('cover') > -1) { coverHref = href; break; }
        if (mediaType.indexOf('image/') === 0) {
          if (!firstImageHref) firstImageHref = href;
          if (id.indexOf('cover') > -1 && !coverHref) coverHref = href;
        }
      }
      // 兜底：取第一张图片
      if (!coverHref) coverHref = firstImageHref;
      if (!coverHref) return null;

      const opfDir = opfPath.indexOf('/') > -1 ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
      const href = coverHref.indexOf('%') > -1 ? decodeURIComponent(coverHref) : coverHref;
      let entry = zip.file(opfDir + href);
      if (!entry && href.indexOf('/') > -1) entry = zip.file(href); // 绝对路径
      if (!entry) {
        const stripped = href.replace(/^\/+/, '');
        entry = zip.file(stripped) || zip.file(opfDir + stripped);
      }
      if (!entry) return null;
      const blob = await entry.async('blob');
      if (!blob || blob.size <= 0) return null;
      // JSZip 的 blob 不带 MIME 类型，按扩展名补充
      const mm = /\.([a-zA-Z0-9]+)$/.exec(entry.name);
      const ext = mm ? mm[1].toLowerCase() : '';
      const mimes = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp' };
      if (mimes[ext] && blob.type !== mimes[ext]) {
        return new Blob([blob], { type: mimes[ext] });
      }
      return blob;
    } catch (_) { return null; }
  }

  /* TXT 编码检测（与 reader.js 一致） */
  function decodeTxtHead(bytes) {
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return new TextDecoder('utf-8').decode(bytes.subarray(3));
    }
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return new TextDecoder('utf-16le').decode(bytes.subarray(2));
    }
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
      return new TextDecoder('utf-16be').decode(bytes.subarray(2));
    }
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch (e) {
      try { return new TextDecoder('gbk').decode(bytes); }
      catch (e2) { return new TextDecoder('utf-8').decode(bytes); }
    }
  }

  async function extractTxtMeta(arrayBuffer) {
    const size = Math.min(arrayBuffer.byteLength, 8192);
    const head = new Uint8Array(arrayBuffer.slice(0, size));
    const text = decodeTxtHead(head);
    const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    let title = lines[0] || '';
    // 去掉常见章节前缀，取正文标题
    title = title.replace(/^第[零一二三四五六七八九十百千万两0-9]{1,5}[章节回卷部篇集][\s：:、.．\-—]*/, '').trim();
    title = title.slice(0, 30) || '未命名文本';
    return { title, author: '' };
  }

  /* ================= 书库 ================= */
  let currentFolderId = null; // null = 书库主页（未分类）
  let moveBookIds = null;     // 移动弹窗目标（支持批量）
  let selectMode = false;     // 书库多选模式
  let selectedIds = new Set(); // 多选选中的书籍 id

  /** 渲染顶部文件夹条（书库主页显示，横向可滚动） */
  function renderFolderBar() {
    const folders = Storage.getFolders();
    if (!folders.length) { els.folderBar.classList.add('hidden'); els.folderBar.innerHTML = ''; return; }
    els.folderBar.classList.remove('hidden');
    els.folderBar.innerHTML = '';
    const allBooks = Storage.getBooksMeta();
    folders.forEach((f) => {
      const chip = document.createElement('button');
      chip.className = 'folder-chip' + (f.id === currentFolderId ? ' active' : '');
      const icon = document.createElement('span');
      icon.className = 'folder-chip-icon';
      icon.textContent = '📁';
      const name = document.createElement('span');
      name.className = 'folder-chip-name';
      name.textContent = f.name;
      const count = document.createElement('span');
      count.className = 'folder-chip-count';
      count.textContent = allBooks.filter((b) => b.folderId === f.id).length;
      chip.appendChild(icon);
      chip.appendChild(name);
      chip.appendChild(count);
      chip.addEventListener('click', () => openFolder(f.id));
      els.folderBar.appendChild(chip);
    });
  }

  /** 文件夹详情导航条（进入文件夹后显示） */
  function renderFolderNav() {
    if (!currentFolderId) { els.folderNav.classList.add('hidden'); return; }
    const f = Storage.getFolders().find((x) => x.id === currentFolderId);
    els.folderNav.classList.remove('hidden');
    els.folderName.textContent = f ? f.name : '文件夹';
  }

  /** 按当前排序方式排列书籍 */
  function sortBooks(list) {
    const mode = Storage.getSettings().bookSort || 'recent';
    const arr = list.slice();
    arr.sort((a, b) => {
      if (mode === 'title') return (a.title || '').localeCompare(b.title || '', 'zh');
      if (mode === 'author') return (a.author || '').localeCompare(b.author || '', 'zh');
      if (mode === 'lastRead') return (b.lastReadAt || 0) - (a.lastReadAt || 0);
      return (b.addedAt || 0) - (a.addedAt || 0); // recent：最近添加在前
    });
    return arr;
  }

  async function renderBookGrid() {
    const list = sortBooks(Storage.getBooksMeta());
    const books = currentFolderId
      ? list.filter((b) => b.folderId === currentFolderId)
      : list.filter((b) => !b.folderId);
    if (!books.length) {
      els.emptyHint.classList.remove('hidden');
      els.emptyHint.innerHTML = currentFolderId
        ? '<div class="empty-icon">📁</div><p>这个文件夹还是空的</p><p class="empty-sub">点击上方「导入到此」把小说放进这里</p>'
        : '<div class="empty-icon">📚</div><p>书库还是空的</p><p class="empty-sub">点击右下角「导入小说」或把文件拖到本页面</p><p class="empty-sub">支持 txt,pdf 与 epub 格式或zip压缩包</p>';
    } else {
      els.emptyHint.classList.add('hidden');
    }
    els.bookGrid.innerHTML = '';

    for (const book of books) {
      const card = document.createElement('button');
      card.className = 'book-card';
      card.dataset.id = book.id;
      if (selectMode) card.classList.add('selectable');
      if (selectedIds.has(book.id)) card.classList.add('selected');

      const coverEl = document.createElement('div');
      coverEl.className = 'book-cover';

      // 多选复选标记（仅多选模式显示）
      const check = document.createElement('span');
      check.className = 'select-check';
      check.textContent = '✓';
      coverEl.appendChild(check);

      const fallback = document.createElement('div');
      fallback.className = 'cover-fallback';
      fallback.textContent = (book.title || '书').slice(0, 2);
      coverEl.appendChild(fallback);

      // 异步加载封面
      Storage.getBookFile(book.id).then((file) => {
        const cover = file && file.coverBlob;
        const type = cover ? (cover.type || '') : '';
        // type 为空也尝试渲染（旧数据/无 MIME 的 blob），加载失败由 onerror 兜底
        if (cover && cover.size > 0 && (type === '' || type.indexOf('image/') === 0)) {
          const url = URL.createObjectURL(cover);
          const img = document.createElement('img');
          img.src = url;
          img.onload = () => {
            img.style.display = 'block';
            fallback.style.display = 'none';
          };
          img.onerror = () => URL.revokeObjectURL(url);
          coverEl.insertBefore(img, fallback);
        }
      });

      const pct = Math.round((book.progress || 0) * 100);
      if (pct > 0 && pct < 99) {
        const badge = document.createElement('div');
        badge.className = 'progress-badge';
        badge.textContent = pct + '%';
        coverEl.appendChild(badge);
      }

      const meta = document.createElement('div');
      meta.className = 'book-meta';
      const t = document.createElement('div');
      t.className = 'b-title';
      t.textContent = book.title;
      const a = document.createElement('div');
      a.className = 'b-author';
      a.textContent = book.author || '未知作者';
      const bar = document.createElement('div');
      bar.className = 'b-progress-bar';
      const fill = document.createElement('div');
      fill.className = 'b-progress-fill';
      fill.style.width = pct + '%';
      bar.appendChild(fill);
      meta.appendChild(t);
      meta.appendChild(a);
      meta.appendChild(bar);

      card.appendChild(coverEl);
      card.appendChild(meta);

      // 长按卡片：弹出操作菜单（删除 / 移动）
      let pressTimer = null;
      let pressTriggered = false;
      card.addEventListener('pointerdown', () => {
        if (selectMode) return; // 多选模式下长按不弹单本菜单
        pressTriggered = false;
        clearTimeout(pressTimer);
        card.classList.add('card-tap'); // 点击按压缩放反馈（CSS 动画）
        pressTimer = setTimeout(() => {
          pressTriggered = true;
          try { if (navigator.vibrate) navigator.vibrate(20); } catch (_) {}
          openCardMenu(book.id);
        }, 500);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => {
        card.addEventListener(ev, () => {
          clearTimeout(pressTimer);
          card.classList.remove('card-tap');
        });
      });
      card.addEventListener('click', (e) => {
        if (pressTriggered) { e.preventDefault(); e.stopPropagation(); pressTriggered = false; return; }
        if (selectMode) { toggleSelect(book.id); return; }
        openBook(book.id);
      });
      els.bookGrid.appendChild(card);
    }
  }

  async function renderLibrary() {
    renderFolderBar();
    renderFolderNav();
    await renderBookGrid();
  }

  /* ================= 排序 ================= */
  function openSortMenu() {
    const cur = Storage.getSettings().bookSort || 'recent';
    els.sortMenu.querySelectorAll('.sheet-item[data-sort]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.sort === cur);
    });
    els.sortMenu.classList.remove('hidden');
  }

  function closeSortMenu() {
    els.sortMenu.classList.add('hidden');
  }

  /* ================= 多选 ================= */
  /** 当前视图可见书籍（文件夹过滤 + 当前排序） */
  function getVisibleBooks() {
    const list = sortBooks(Storage.getBooksMeta());
    return currentFolderId
      ? list.filter((b) => b.folderId === currentFolderId)
      : list.filter((b) => !b.folderId);
  }

  function enterSelectMode() {
    if (!getVisibleBooks().length) { showToast('没有可选择的书籍'); return; }
    selectMode = true;
    selectedIds.clear();
    els.selectBar.classList.remove('hidden');
    els.fabWrap.classList.add('hidden');
    updateSelectUI();
    renderBookGrid();
  }

  function exitSelectMode() {
    selectMode = false;
    selectedIds.clear();
    els.selectBar.classList.add('hidden');
    els.fabWrap.classList.remove('hidden');
    renderBookGrid();
  }

  function toggleSelect(id) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    const card = els.bookGrid.querySelector('.book-card[data-id="' + id + '"]');
    if (card) card.classList.toggle('selected', selectedIds.has(id));
    updateSelectUI();
  }

  function updateSelectUI() {
    const n = selectedIds.size;
    els.selectCount.textContent = '已选 ' + n + ' 本';
    const all = getVisibleBooks();
    const allSelected = all.length > 0 && all.every((b) => selectedIds.has(b.id));
    els.selectAll.textContent = allSelected ? '取消全选' : '全选';
  }

  function toggleSelectAll() {
    const all = getVisibleBooks();
    const allSelected = all.length > 0 && all.every((b) => selectedIds.has(b.id));
    if (allSelected) { all.forEach((b) => selectedIds.delete(b.id)); }
    else { all.forEach((b) => selectedIds.add(b.id)); }
    updateSelectUI();
    renderBookGrid(); // 重渲染更新选中态
  }

  function selectBatchMove() {
    if (!selectedIds.size) { showToast('未选择任何书'); return; }
    openMoveModalFor(Array.from(selectedIds));
  }

  async function selectBatchDelete() {
    const ids = Array.from(selectedIds);
    if (!ids.length) { showToast('未选择任何书'); return; }
    const ok = await confirmModal(`确定删除选中的 ${ids.length} 本小说吗？阅读进度与书签将一并删除。`, '删除');
    if (!ok) return;
    for (const id of ids) {
      try { await Storage.deleteBookFile(id); } catch (_) {}
      Storage.removeBookMeta(id);
    }
    exitSelectMode();
    renderLibrary();
    showToast(`已删除 ${ids.length} 本`);
  }

  /* ================= 文件夹操作 ================= */
  function openFolder(id) {
    if (selectMode) exitSelectMode();
    currentFolderId = id;
    renderLibrary();
    els.libraryView.scrollTop = 0;
  }

  function backToLibraryRoot() {
    if (selectMode) exitSelectMode();
    currentFolderId = null;
    renderLibrary();
    els.libraryView.scrollTop = 0;
  }

  /** 打开移动弹窗（支持单本或批量） */
  function openMoveModalFor(ids) {
    moveBookIds = ids || [];
    const folders = Storage.getFolders();
    els.moveList.innerHTML = '';
    const mk = (label, folderId) => {
      const btn = document.createElement('button');
      btn.className = 'move-item';
      btn.innerHTML = '<span class="move-icon">' + (folderId ? '📁' : '🗂') + '</span>' + label;
      btn.addEventListener('click', () => {
        moveBookIds.forEach((id) => Storage.setBookFolder(id, folderId));
        moveBookIds = null;
        els.moveModal.classList.add('hidden');
        if (selectMode) exitSelectMode();
        renderLibrary();
        showToast('已移动');
      });
      els.moveList.appendChild(btn);
    };
    mk('未分类', null);
    folders.forEach((f) => mk(f.name, f.id));
    els.moveModal.classList.remove('hidden');
  }

  function openMoveModal(bookId) {
    openMoveModalFor([bookId]);
  }

  function closeMoveModal() {
    moveBookIds = null;
    els.moveModal.classList.add('hidden');
  }

  /* ================= 长按卡片操作菜单 ================= */
  function openCardMenu(bookId) {
    cardMenuBookId = bookId;
    const book = Storage.getBooksMeta().find((b) => b.id === bookId);
    els.cardMenuTitle.textContent = book ? book.title : '';
    els.cardMenu.classList.remove('hidden');
  }

  function closeCardMenu() {
    cardMenuBookId = null;
    els.cardMenu.classList.add('hidden');
  }

  /* ================= 书籍信息预览 ================= */
  const TYPE_LABELS = { epub: 'EPUB', txt: 'TXT', pdf: 'PDF' };

  function formatSize(bytes) {
    if (!bytes && bytes !== 0) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  function formatTime(ts) {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (_) { return '—'; }
  }

  /** 打开书籍信息预览弹窗（封面 + 基本信息） */
  async function openBookInfo(bookId) {
    const book = Storage.getBooksMeta().find((b) => b.id === bookId);
    if (!book) return;
    bookInfoId = bookId;
    els.biTitle.textContent = book.title || '未命名';
    els.biAuthor.textContent = book.author || '未知作者';
    els.biType.textContent = TYPE_LABELS[book.type] || (book.type || 'EPUB').toUpperCase();
    els.biProgress.textContent = Math.round((book.progress || 0) * 100) + '%';
    els.biAdded.textContent = formatTime(book.addedAt);
    const lastRead = book.lastReadAt || (Storage.getProgress(bookId) || {}).updatedAt;
    els.biLastread.textContent = formatTime(lastRead);
    els.biSize.textContent = '…';
    els.bookInfoCover.innerHTML = '';
    // 封面与文件大小（IndexedDB 异步读取）
    try {
      const file = await Storage.getBookFile(bookId);
      if (file && file.arrayBuffer) {
        els.biSize.textContent = formatSize(file.arrayBuffer.byteLength);
      }
      if (file && file.coverBlob && file.coverBlob.size > 0) {
        const url = URL.createObjectURL(file.coverBlob);
        const img = document.createElement('img');
        img.src = url;
        img.className = 'bi-cover-img';
        img.onload = () => URL.revokeObjectURL(url);
        img.onerror = () => URL.revokeObjectURL(url);
        els.bookInfoCover.appendChild(img);
      }
    } catch (_) {}
    els.bookInfoModal.classList.remove('hidden');
  }

  function closeBookInfo() {
    bookInfoId = null;
    els.bookInfoModal.classList.add('hidden');
  }

  /** 删除书籍（统一入口：确认、删文件、删元数据、刷新） */
  async function deleteBook(bookId) {
    const book = Storage.getBooksMeta().find((b) => b.id === bookId);
    if (!book) return;
    const ok = await confirmModal(`确定要删除《${book.title}》吗？阅读进度与书签将一并删除。`, '删除');
    if (!ok) return;
    await Storage.deleteBookFile(bookId);
    Storage.removeBookMeta(bookId);
    renderLibrary();
    showToast('已删除');
  }

  /* ================= 导入 ================= */
  async function importFile(file) {
    if (!file) return;
    if (/\.zip$/i.test(file.name)) return importZip(file);
    return importBookFile(file, false);
  }

  /** 按扩展名分派单个电子书文件（epub / txt / pdf） */
  async function importBookFile(file, silent) {
    if (/\.epub$/i.test(file.name)) return importEpub(file, silent);
    if (/\.txt$/i.test(file.name)) return importTxt(file, silent);
    if (/\.pdf$/i.test(file.name)) return importPdf(file, silent);
    if (!silent) showToast('仅支持 .epub / .txt / .pdf 文件');
    return false;
  }

  async function importEpub(file, silent) {
    if (!silent) showToast('正在导入…');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { title, author, coverBlob } = await extractMeta(arrayBuffer);
      const id = Storage.genId();
      await Storage.saveBookFile(id, arrayBuffer, coverBlob);
      Storage.upsertBookMeta({ id, title, author, type: 'epub', folderId: currentFolderId, addedAt: Date.now(), progress: 0 });
      if (!silent) { renderLibrary(); showToast(`已导入《${title}》`); }
      return true;
    } catch (e) {
      console.error(e);
      if (!silent) showToast('导入失败：文件可能已损坏');
      return false;
    }
  }

  async function importTxt(file, silent) {
    if (!silent) showToast('正在导入…');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { title, author } = await extractTxtMeta(arrayBuffer);
      const id = Storage.genId();
      await Storage.saveBookFile(id, arrayBuffer, null);
      Storage.upsertBookMeta({ id, title, author, type: 'txt', folderId: currentFolderId, addedAt: Date.now(), progress: 0 });
      if (!silent) { renderLibrary(); showToast(`已导入《${title}》`); }
      return true;
    } catch (e) {
      console.error(e);
      if (!silent) showToast('导入失败：文件可能已损坏');
      return false;
    }
  }

  async function importPdf(file, silent) {
    if (!silent) showToast('正在导入…');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base = (file.name.replace(/\.pdf$/i, '') || '未命名 PDF').trim();
      const id = Storage.genId();
      await Storage.saveBookFile(id, arrayBuffer, null);
      Storage.upsertBookMeta({ id, title: base, author: '', type: 'pdf', folderId: currentFolderId, addedAt: Date.now(), progress: 0 });
      if (!silent) { renderLibrary(); showToast(`已导入《${base}》`); }
      return true;
    } catch (e) {
      console.error(e);
      if (!silent) showToast('导入失败：文件可能已损坏');
      return false;
    }
  }

  /** 解压 zip 并自动识别其中的电子书（epub / txt / pdf）批量导入 */
  async function importZip(file) {
    showToast('正在解压识别…');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const candidates = [];
      zip.forEach((path, entry) => {
        if (entry.dir) return;
        if (/\.(epub|txt|pdf)$/i.test(entry.name)) candidates.push(entry);
      });
      if (!candidates.length) { showToast('压缩包内未发现电子书（epub / txt / pdf）'); return; }
      let ok = 0, fail = 0;
      for (const entry of candidates) {
        try {
          const buf = await entry.async('arraybuffer');
          const name = entry.name.split('/').pop();
          const fake = { name, arrayBuffer: () => Promise.resolve(buf) };
          if (await importBookFile(fake, true)) ok++; else fail++;
        } catch (_) { fail++; }
      }
      renderLibrary();
      showToast(fail ? `已导入 ${ok} 本，失败 ${fail} 本` : `已导入 ${ok} 本电子书`);
    } catch (e) {
      console.error(e);
      showToast('压缩包解析失败');
    }
  }

  /* ================= 打开书籍 ================= */
  async function openBook(id) {
    const meta = Storage.getBooksMeta().find((b) => b.id === id);
    const file = await Storage.getBookFile(id);
    if (!file || !file.arrayBuffer) {
      showToast('书籍数据缺失');
      return;
    }
    currentBookId = id;
    Storage.upsertBookMeta({ id, lastReadAt: Date.now() });
    const progress = Storage.getProgress(id);

    // 切换视图
    els.libraryView.classList.add('hidden');
    els.fabWrap.classList.add('hidden'); // 阅读时隐藏右下角悬浮按钮
    els.topbar.classList.remove('hidden');
    els.readerWrap.classList.remove('hidden');

    // 显示阅读状态（时间 / 电量）
    els.readerStatus.classList.remove('hidden');
    startStatusTimer();
    updateBattery();

    els.bookTitle.textContent = meta ? meta.title : '未命名';
    els.bookAuthor.textContent = meta && meta.author ? meta.author : '';

    if (!reader) {
      reader = new Reader({
        el: els.readerEl,
        settings: Storage.getSettings(),
        onProgress: onProgress,
        onChapter: onChapter,
        onToggleBars: toggleBars,
        getFont: getCustomFont,
        onSelectedText: onSelectedText,
      });
    }

    const type = meta && meta.type === 'txt' ? 'txt' : (meta && meta.type === 'pdf' ? 'pdf' : 'epub');
    const openOpts = { type };
    if (type === 'txt') {
      // txt 用滚动百分比恢复进度
      openOpts.percent = progress && typeof progress.percent === 'number' ? progress.percent * 100 : 0;
    } else if (type === 'pdf') {
      // pdf 用页码恢复进度（cfi 格式 pdf:<page>）
      const m = progress && progress.cfi ? progress.cfi.match(/^pdf:(\d+)/) : null;
      openOpts.page = m ? parseInt(m[1], 10) : 1;
    } else {
      openOpts.cfi = progress && progress.cfi ? progress.cfi : undefined;
    }
    try {
      await reader.open(file.arrayBuffer, openOpts);
    } catch (_) {
      try { await reader.open(file.arrayBuffer, { type }); } catch (e) { console.error(e); }
    }

    // 目录
    currentToc = await reader.getToc();
    renderToc();

    // 恢复书签列表
    renderBookmarks();

    // 渲染已有划线高亮（EPUB/TXT）
    try {
      reader.setHighlights(Storage.getBookmarks(currentBookId).filter((b) => b.type === 'highlight'));
    } catch (_) {}

    // 恢复设置 UI 状态
    syncSettingsUI();
    showToast('正在阅读');

    // 5 秒后自动进入沉浸模式
    scheduleAutoHide();
  }

  function onProgress({ cfi, percent }) {
    els.progressText.textContent = Math.round(percent) + '%';
    // 翻页/滚动后隐藏划线操作条
    if (pendingHighlight) { pendingHighlight = null; els.hlBar.classList.add('hidden'); }
    const now = Date.now();
    if (now - lastProgressSave > 800) {
      lastProgressSave = now;
      Storage.setProgress(currentBookId, { cfi, percent: percent / 100 });
      Storage.upsertBookMeta({ id: currentBookId, progress: percent / 100, lastReadAt: now });
    }
  }

  function onChapter({ label }) {
    // 可选：顶部显示章节名
  }

  /** 自动进入沉浸模式的计时器 */
  let autoHideTimer = null;

  /** 5 秒后自动进入沉浸模式（仍在阅读、未沉浸、且无面板打开时） */
  function scheduleAutoHide() {
    clearTimeout(autoHideTimer);
    autoHideTimer = setTimeout(() => {
      autoHideTimer = null;
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
      if (autoHideTimer) { clearTimeout(autoHideTimer); autoHideTimer = null; }
      closeAllPanels();
    } else {
      // 展开上下栏后 5 秒自动再次进入沉浸
      scheduleAutoHide();
    }
    // 阅读区全屏，上下栏悬浮覆盖其上，切换时无需重新排版
  }

  function backToLibrary() {
    document.body.classList.remove('bars-hidden');
    if (autoHideTimer) { clearTimeout(autoHideTimer); autoHideTimer = null; }
    if (reader) { try { reader.destroy(); } catch (_) {} }
    reader = null;
    currentBookId = null;
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
    if (selectMode) { exitSelectMode(); return true; }
    // 3. 打开的面板
    if (!els.searchPanel.classList.contains('hidden') || !els.panelToc.classList.contains('hidden') ||
        !els.panelBookmarks.classList.contains('hidden') || !els.settingsPanel.classList.contains('hidden')) {
      closeAllPanels();
      return true;
    }
    // 4. 阅读界面 → 返回书库
    if (!els.readerWrap.classList.contains('hidden')) { backToLibrary(); return true; }
    // 5. 文件夹视图 → 返回书库主页
    if (currentFolderId) { backToLibraryRoot(); return true; }
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
          showToast('再按一次返回键退出');
        }
      });
    } catch (_) {}
  }

  /* ================= 目录 ================= */
  function renderToc() {
    els.tocList.innerHTML = '';
    if (!currentToc.length) {
      els.tocList.innerHTML = '<div class="search-empty">本书没有目录</div>';
      return;
    }
    function walk(items, depth) {
      items.forEach((it) => {
        const btn = document.createElement('button');
        btn.className = 'toc-item level-' + Math.min(depth, 6);
        btn.textContent = it.label || '（无标题）';
        btn.addEventListener('click', () => {
          reader.goToHref(it.href);
          togglePanel('panelToc', false);
        });
        els.tocList.appendChild(btn);
        if (it.subitems && it.subitems.length) walk(it.subitems, depth + 1);
      });
    }
    walk(currentToc, 1);
  }

  /* ================= 书签 ================= */
  async function renderBookmarks() {
    if (!currentBookId) return;
    const list = Storage.getBookmarks(currentBookId);
    els.bookmarkList.innerHTML = '';
    if (!list.length) {
      els.bookmarkList.innerHTML = '<div class="search-empty">还没有书签，阅读时点击上方按钮添加</div>';
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
        (bm.type === 'highlight' ? '划线' : '书签') + ' #' + (i + 1) + ' · ' +
        new Date(bm.date).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      ));
      const text = document.createElement('div');
      text.className = 'bm-text';
      text.textContent = bm.text || '（无文字内容）';
      const btns = document.createElement('div');
      btns.className = 'bm-btns';
      const go = document.createElement('button');
      go.className = 'bm-goto';
      go.textContent = '跳转';
      go.addEventListener('click', () => reader.goToCfi(bm.cfi, true));
      const del = document.createElement('button');
      del.className = 'bm-del';
      del.textContent = '删除';
      del.addEventListener('click', () => {
        Storage.removeBookmark(currentBookId, bm.cfi);
        if (bm.type === 'highlight' && reader) reader.removeHighlight(bm.cfi);
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
    if (!reader || !currentBookId) return;
    const cfi = reader.currentCfi;
    if (!cfi) { showToast('无法获取当前位置'); return; }
    let text = await reader.getTextAt(cfi);
    if (!text) text = reader.getCurrentText();
    Storage.addBookmark(currentBookId, { cfi, text, date: Date.now() });
    renderBookmarks();
    showToast('已添加书签');
  }

  /* ================= 数据备份 ================= */
  function exportBackup() {
    try {
      const data = Storage.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const name = 'epub-reader-backup-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.json';
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
      showToast('备份已导出');
    } catch (e) {
      console.error(e);
      showToast('导出失败');
    }
  }

  async function importBackup(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || data.app !== 'epub-reader') { showToast('无效的备份文件'); return; }
      const n = Array.isArray(data.books) ? data.books.length : 0;
      const ok = await confirmModal(`导入备份将覆盖当前书库信息、进度、书签与设置（含 ${n} 本书元数据）。书籍文件不在备份中，导入后需重新导入书籍。继续吗？`, '导入');
      if (!ok) return;
      Storage.importData(data);
      // 刷新设置与字体资源
      const s = Storage.getSettings();
      document.body.className = 'theme-' + s.theme;
      renderFontOptions();
      renderCustomFontList();
      loadFontAssets();
      if (reader) { try { reader.destroy(); } catch (_) {} reader = null; }
      closeAllPanels();
      backToLibrary();
      showToast('备份已导入');
    } catch (e) {
      console.error(e);
      showToast('导入失败：备份文件无效');
    }
  }

  /* ================= 搜索 ================= */
  async function doSearch() {
    const q = els.searchInput.value.trim();
    els.searchResults.innerHTML = '';
    if (!q || !reader) return;
    const results = await reader.search(q);
    if (!results.length) {
      els.searchResults.innerHTML = '<div class="search-empty">未找到「' + q + '」相关内容</div>';
      return;
    }
    const heading = document.createElement('div');
    heading.className = 'search-empty';
    heading.style.textAlign = 'left';
    heading.innerHTML = '找到 <span class="hits">' + results.length + '</span> 处结果';
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
        reader.goToCfi(r.cfi, true);
        togglePanel('searchPanel', false);
      });
      els.searchResults.appendChild(btn);
    });
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  /* ================= 设置 ================= */
  function syncSettingsUI() {
    const s = Storage.getSettings();
    els.fontSizeRange.value = s.fontSize;
    els.fontSizeVal.textContent = s.fontSize + 'px';
    els.lineHeightRange.value = s.lineHeight;
    els.lineHeightVal.textContent = s.lineHeight;
    els.marginRange.value = s.margin;
    els.marginVal.textContent = s.margin + '%';
    els.fontPickerLabel.textContent = fontLabelOf(s.fontFamily);
    updateFlowSeg(s.flow);
    els.volumeKeyToggle.checked = !!s.volumeKeyTurn;
    els.customBgInput.value = s.customBg || themeColorsOf(hasCustomColors() ? 'custom' : s.theme).bg;
    els.customTextInput.value = s.customText || themeColorsOf(hasCustomColors() ? 'custom' : s.theme).text;
    els.customAccentInput.value = s.customAccent || themeColorsOf(hasCustomColors() ? 'custom' : s.theme).accent;
    els.customBorderInput.value = s.customBorder || themeColorsOf(hasCustomColors() ? 'custom' : s.theme).border;
    els.customTextDimInput.value = s.customTextDim || themeColorsOf(hasCustomColors() ? 'custom' : s.theme).textDim;
    updateThemePickerUI();
  }

  function applyTheme(theme) {
    if (theme === 'custom') {
      // 选择"自定义"主题：应用自定义颜色；未设置过则用当前主题默认色（可在输入框调整）
      const s = Storage.getSettings();
      const t = THEMES.find((x) => x.v === s.theme) || THEMES[0];
      const bg = s.customBg || '#ffffff';
      const text = s.customText || '#2c2c2c';
      const accent = s.customAccent || t.accent;
      const border = s.customBorder || t.border;
      const textDim = s.customTextDim || t.textDim;
      Storage.setSettings({ theme: s.theme || 'light', customBg: bg, customText: text, customAccent: accent, customBorder: border, customTextDim: textDim });
      document.body.className = 'theme-' + (s.theme || 'light');
      if (reader) { try { reader.setCustomTheme(bg, text, accent); } catch (_) {} }
      applyCustomTheme();
      showCustomColors(true); // 显示自定义颜色区（默认折叠）
      updateThemePickerUI();
      return;
    }
    document.body.className = 'theme-' + theme;
    // 切换预设主题时清空自定义颜色，确保主题完全生效（自定义色会覆盖主题色）
    Storage.setSettings({ theme, customBg: null, customText: null, customAccent: null, customBorder: null, customTextDim: null });
    if (reader) {
      try { reader.setTheme(theme); } catch (_) {}
      try { reader.setCustomTheme(null, null, null); } catch (_) {}
    }
    applyCustomTheme(); // 同步颜色选择器 UI（显示主题默认色值）
    showCustomColors(false); // 非自定义主题：隐藏自定义颜色区
    updateThemePickerUI();
  }

  /** 展开/折叠自定义颜色区（有自定义色时默认展开） */
  function toggleCustomColors(force) {
    const open = force === undefined ? els.customColorsBody.classList.contains('hidden') : !!force;
    els.customColorsBody.classList.toggle('hidden', !open);
    els.customColorsToggle.classList.toggle('open', open);
    els.customColorsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  /** 自定义颜色区仅在选择"自定义"主题时显示；否则整个隐藏。显示时默认折叠 */
  function showCustomColors(visible) {
    els.customColorsSection.classList.toggle('hidden', !visible);
    if (visible) toggleCustomColors(false);
  }

  /** 应用自定义背景/文字/强调/边框/次要文字颜色（设置面板颜色选择器） */
  function applyCustomTheme() {
    const s = Storage.getSettings();
    const hasCustom = hasCustomColors();
    const tc = themeColorsOf(hasCustom ? 'custom' : s.theme);
    els.customBgInput.value = s.customBg || tc.bg;
    els.customTextInput.value = s.customText || tc.text;
    els.customAccentInput.value = s.customAccent || tc.accent;
    els.customBorderInput.value = s.customBorder || tc.border;
    els.customTextDimInput.value = s.customTextDim || tc.textDim;
    // 自定义颜色同步更新主题色：在 body 上覆盖 CSS 变量（主题变量定义于 body.theme-xxx，
    // 需在 body 级 inline 覆盖才能让整个界面生效）；无自定义色时用主题默认色，有则用自定义色
    const b = document.body;
    b.style.setProperty('--bg', tc.bg);
    b.style.setProperty('--surface', tc.bg);
    b.style.setProperty('--text', tc.text);
    b.style.setProperty('--accent', tc.accent);
    b.style.setProperty('--accent-soft', hexToRgba(tc.accent, 0.18));
    b.style.setProperty('--border', tc.border);
    b.style.setProperty('--text-dim', tc.textDim);
    if (reader) { try { reader.setCustomTheme(s.customBg, s.customText, s.customAccent); } catch (_) {} }
    // 重建主题选项 + 更新 UI
    renderThemeOptions();
  }

  /** 同步“音量键翻页”开关到原生：关闭时恢复系统音量键（原生不再拦截） */
  function syncNativeVolumeKey() {
    try {
      const enabled = !!Storage.getSettings().volumeKeyTurn;
      const V = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.VolumeKey;
      if (V) V.setEnabled({ enabled: enabled });
    } catch (_) {}
  }

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
    const s = Storage.getSettings();
    document.body.className = 'theme-' + s.theme;
    els.fontSizeRange.value = s.fontSize;
    els.fontSizeVal.textContent = s.fontSize + 'px';
    els.lineHeightRange.value = s.lineHeight;
    els.lineHeightVal.textContent = s.lineHeight;
    els.marginRange.value = s.margin;
    els.marginVal.textContent = s.margin + '%';
    els.fontPickerLabel.textContent = fontLabelOf(s.fontFamily);
    updateFlowSeg(s.flow);
    els.volumeKeyToggle.checked = !!s.volumeKeyTurn;
    els.customBgInput.value = s.customBg || themeColorsOf(hasCustomColors() ? 'custom' : s.theme).bg;
    els.customTextInput.value = s.customText || themeColorsOf(hasCustomColors() ? 'custom' : s.theme).text;
    els.customAccentInput.value = s.customAccent || themeColorsOf(hasCustomColors() ? 'custom' : s.theme).accent;
    els.customBorderInput.value = s.customBorder || themeColorsOf(hasCustomColors() ? 'custom' : s.theme).border;
    els.customTextDimInput.value = s.customTextDim || themeColorsOf(hasCustomColors() ? 'custom' : s.theme).textDim;
    updateThemePickerUI();

    renderThemeOptions();
    showCustomColors(hasCustomColors());
    renderFontOptions();
    renderCustomFontList();
    loadFontAssets();
    syncNativeVolumeKey();

    renderLibrary();
    bindDragDrop();
    bindBackButton();

    /* 顶部按钮 */
    els.btnBack.addEventListener('click', backToLibrary);
    els.btnPrev.addEventListener('click', () => reader && reader.prev());
    els.btnNext.addEventListener('click', () => reader && reader.next());

    /* 阅读区点击中间区域切换上下栏（主要针对 TXT；EPUB 由 reader.js 回调处理） */
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
      const name = await showInputModal('新建文件夹', '文件夹名称');
      if (name === null) return;
      if (!name.trim()) { showToast('名称不能为空'); return; }
      Storage.createFolder(name);
      renderLibrary();
      showToast('已创建文件夹');
    });
    els.fabImport.addEventListener('click', () => {
      toggleFab(false);
      els.fileInput.click();
    });
    els.btnFolderBack.addEventListener('click', backToLibraryRoot);
    els.btnFolderRename.addEventListener('click', async () => {
      const f = Storage.getFolders().find((x) => x.id === currentFolderId);
      if (!f) return;
      const name = await showInputModal('重命名文件夹', '文件夹名称', f.name);
      if (name === null) return;
      if (!name.trim()) { showToast('名称不能为空'); return; }
      Storage.renameFolder(f.id, name.trim());
      renderLibrary();
      showToast('已重命名');
    });
    els.btnFolderDelete.addEventListener('click', async () => {
      const f = Storage.getFolders().find((x) => x.id === currentFolderId);
      if (!f) return;
      const ok = await confirmModal(`确定删除文件夹「${f.name}」吗？其中的小说会移回未分类，不会被删除。`, '删除');
      if (!ok) return;
      Storage.deleteFolder(f.id);
      currentFolderId = null;
      renderLibrary();
      showToast('已删除文件夹');
    });
    els.btnFolderImport.addEventListener('click', () => els.fileInput.click());
    els.btnMoveClose.addEventListener('click', closeMoveModal);
    els.moveModal.addEventListener('click', (e) => { if (e.target === els.moveModal) closeMoveModal(); });

    /* 长按卡片操作菜单 */
    els.cardMenuMove.addEventListener('click', () => {
      const id = cardMenuBookId;
      closeCardMenu();
      if (id) openMoveModal(id);
    });
    els.cardMenuDelete.addEventListener('click', () => {
      const id = cardMenuBookId;
      closeCardMenu();
      if (id) deleteBook(id);
    });
    els.cardMenuCancel.addEventListener('click', closeCardMenu);
    els.cardMenu.addEventListener('click', (e) => { if (e.target === els.cardMenu) closeCardMenu(); });

    /* 长按菜单：预览信息 */
    els.cardMenuInfo.addEventListener('click', () => {
      const id = cardMenuBookId;
      closeCardMenu();
      if (id) openBookInfo(id);
    });

    /* 长按菜单：多选（进入多选模式并自动勾选当前书） */
    els.cardMenuSelect.addEventListener('click', () => {
      const id = cardMenuBookId;
      closeCardMenu();
      enterSelectMode();
      if (id) toggleSelect(id);
    });

    /* 书籍信息弹窗 */
    els.btnInfoClose.addEventListener('click', closeBookInfo);
    els.btnInfoClose2.addEventListener('click', closeBookInfo);
    els.bookInfoModal.addEventListener('click', (e) => { if (e.target === els.bookInfoModal) closeBookInfo(); });
    els.btnInfoRead.addEventListener('click', () => {
      const id = bookInfoId;
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
        if (!pendingHighlight || !currentBookId || !reader) return;
        const color = btn.dataset.color || 'yellow';
        reader.addHighlight(pendingHighlight.cfi, color);
        Storage.addBookmark(currentBookId, { cfi: pendingHighlight.cfi, text: pendingHighlight.text, date: Date.now(), type: 'highlight', color });
        pendingHighlight = null;
        els.hlBar.classList.add('hidden');
        renderBookmarks();
        showToast('已划线');
      });
    });
    els.hlCancel.addEventListener('click', () => { pendingHighlight = null; els.hlBar.classList.add('hidden'); });
    els.hlClear.addEventListener('click', clearPendingHighlight);

    /* 自定义划线颜色 */
    els.hlColorInput.addEventListener('change', () => {
      if (!pendingHighlight || !currentBookId || !reader) return;
      const color = els.hlColorInput.value;
      reader.addHighlight(pendingHighlight.cfi, color);
      Storage.addBookmark(currentBookId, { cfi: pendingHighlight.cfi, text: pendingHighlight.text, date: Date.now(), type: 'highlight', color });
      pendingHighlight = null;
      els.hlBar.classList.add('hidden');
      renderBookmarks();
      showToast('已划线');
    });

    /* 数据备份 */
    els.btnExportBackup.addEventListener('click', exportBackup);
    els.btnImportBackup.addEventListener('click', () => els.backupFileInput.click());
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
      if (reader) reader.setFontSize(v);
    });
    els.lineHeightRange.addEventListener('input', () => {
      const v = parseFloat(els.lineHeightRange.value);
      els.lineHeightVal.textContent = v.toFixed(1);
      Storage.setSettings({ lineHeight: v });
      if (reader) reader.setLineHeight(v);
    });
    els.marginRange.addEventListener('input', () => {
      const v = parseInt(els.marginRange.value, 10);
      els.marginVal.textContent = v + '%';
      Storage.setSettings({ margin: v });
      if (reader) reader.setMargin(v);
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
        if (reader) reader.setFlow(v);
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
        if (Storage.getSettings().volumeKeyTurn) { e.preventDefault(); reader && reader.next(); }
      } else if (e.key === 'VolumeDown' || e.key === 'AudioVolumeDown') {
        if (Storage.getSettings().volumeKeyTurn) { e.preventDefault(); reader && reader.prev(); }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        togglePanel('searchPanel');
      } else if (e.key === 'Escape') {
        closeAllPanels();
      } else if (!els.topbar.classList.contains('hidden') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
          e.preventDefault();
          reader && reader.next();
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault();
          reader && reader.prev();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
        }
      }
    });

    /* 音量键翻页（Android：原生 MainActivity 拦截音量键后触发的事件） */
    document.addEventListener('volumeUp', () => {
      if (Storage.getSettings().volumeKeyTurn) { reader && reader.next(); }
    });
    document.addEventListener('volumeDown', () => {
      if (Storage.getSettings().volumeKeyTurn) { reader && reader.prev(); }
    });

    // 窗口尺寸变化由 reader 内部处理
  }

  document.addEventListener('DOMContentLoaded', init);
})();
