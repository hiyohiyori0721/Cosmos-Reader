/* ============================================================
 * app-settings.js — 主题/字体/自定义颜色/设置UI/备份导出
 * 依赖：app-state.js（AppEls/AppState）、config.js、utils.js
 * ============================================================ */
(function () {
  'use strict';

  const els = AppEls;
  const s = AppState;
  const THEMES = CosmosConfig.THEMES;
  const CUSTOM_COLOR_FIELDS = CosmosConfig.CUSTOM_COLOR_FIELDS;
  const customFontFamily = CosmosUtils.customFontFamily;

/** 加载所有导入字体的 blob URL（供 Reader 注入 @font-face） */
  async function loadFontAssets() {
    const fonts = Storage.getFonts();
    for (const f of fonts) {
      try {
        const rec = await Storage.getFont(f.id);
        if (rec && rec.arrayBuffer) {
          s.fontBlobUrls[f.id] = URL.createObjectURL(new Blob([rec.arrayBuffer], { type: f.type || '' }));
        }
      } catch (_) {}
    }
  }
/** 供 Reader 查询自定义字体：返回 { family, url, format } 或 null */
  function getCustomFont(id) {
    if (!s.fontBlobUrls[id]) return null;
    const meta = Storage.getFonts().find((x) => x.id === id) || {};
    return { family: customFontFamily(id), url: s.fontBlobUrls[id], format: meta.format || 'truetype' };
  }
/** 字体值 → 显示名 */
  function fontLabelOf(val) {
    if (!val || val === 'default') return t('settings.followBook');
    const f = Storage.getFonts().find((x) => 'font:' + x.id === val);
    return f ? f.name : t('settings.followBook');
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
        bg: s.customBg || t.bg,
        text: s.customText || t.text,
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
    return t ? (CosmosI18n.t('theme.' + v) || t.label) : CosmosI18n.t('theme.light');
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
        if (s.reader) s.reader.setFontFamily(val);
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
      if (s.reader) { try { s.reader.setFontFamily('default'); } catch (_) {} }
    }
    updateFontPickerUI();
  }
/** 渲染设置面板的自定义字体列表 */
  function renderCustomFontList() {
    const fonts = Storage.getFonts();
    els.customFontList.innerHTML = '';
    if (!fonts.length) {
      els.customFontList.innerHTML = '<div class="font-list-empty">' + t('settings.noFont') + '</div>';
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
      del.textContent = t('common.delete');
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
      showToast(t('toast.fontTypeOnly'));
      return;
    }
    showToast(t('toast.importing'));
    try {
      const arrayBuffer = await file.arrayBuffer();
      const ext = (file.name.match(/\.([a-z0-9]+)$/i) || [])[1].toLowerCase();
      const format = ext === 'ttf' ? 'truetype' : ext === 'otf' ? 'opentype' : ext === 'woff' ? 'woff' : 'woff2';
      const base = file.name.replace(/\.[a-z0-9]+$/i, '').trim() || t('settings.customFont');
      const id = Storage.genId();
      await Storage.saveFont(id, arrayBuffer);
      Storage.upsertFontMeta({
        id, name: base, family: customFontFamily(id),
        type: file.type || '', format, size: arrayBuffer.byteLength, addedAt: Date.now(),
      });
      s.fontBlobUrls[id] = URL.createObjectURL(new Blob([arrayBuffer], { type: file.type || '' }));
      renderFontOptions();
      renderCustomFontList();
      showToast(t('toast.fontImported', { name: base }));
    } catch (e) {
      console.error(e);
      showToast(t('toast.fontImportFail'));
    }
  }
/** 删除自定义字体（若正在使用则回退为跟随书籍） */
  async function deleteCustomFont(id) {
    const f = Storage.getFonts().find((x) => x.id === id);
    const ok = await confirmModal(t('confirm.deleteFont', { name: f ? f.name : '' }), t('common.delete'));
    if (!ok) return;
    if (s.fontBlobUrls[id]) { try { URL.revokeObjectURL(s.fontBlobUrls[id]); } catch (_) {} delete s.fontBlobUrls[id]; }
    await Storage.deleteFont(id);
    Storage.removeFontMeta(id);
    if (Storage.getSettings().fontFamily === 'font:' + id) {
      Storage.setSettings({ fontFamily: 'default' });
    }
    renderFontOptions();
    renderCustomFontList();
    if (s.reader) s.reader.setFontFamily(Storage.getSettings().fontFamily);
    showToast(t('toast.fontDeleted'));
  }
/* ================= 数据备份 ================= */
  function exportBackup() {
    try {
      const data = Storage.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const name = 'epub-s.reader-backup-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.json';
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
      showToast(t('toast.backupExported'));
    } catch (e) {
      console.error(e);
      showToast(t('toast.exportFail'));
    }
  }
/** 导出全部书的书签与划线为 Markdown 读书笔记 */
  function exportNotes() {
    try {
      const books = Storage.getBooksMeta();
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const lines = [t('notes.title'), '', t('notes.exportTime') + d.toLocaleString('zh-CN'), ''];
      let count = 0;
      books.forEach((b) => {
        const bms = Storage.getBookmarks(b.id);
        if (!bms.length) return;
        lines.push('', '## 《' + (b.title || t('book.untitled')) + '》' + (b.author ? ' — ' + b.author : ''), '');
        bms.forEach((bm) => {
          const date = new Date(bm.date).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          const text = (bm.text || '').trim();
          if (bm.type === 'highlight') {
            lines.push('> ' + text, '', '> <sub>📌 ' + t('notes.highlight') + ' · ' + date + '</sub>', '');
          } else {
            lines.push('- ' + text, '', '  <sub>🔖 ' + t('notes.bookmark') + ' · ' + date + '</sub>', '');
          }
          count++;
        });
      });
      if (!count) { showToast(t('toast.noNotes')); return; }
      const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Cosmos-Reader-读书笔记-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.md';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
      showToast(t('toast.notesExported'));
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
      if (!data || data.app !== 'epub-s.reader') { showToast(t('toast.backupInvalid')); return; }
      const n = Array.isArray(data.books) ? data.books.length : 0;
      const ok = await confirmModal(t('confirm.overwriteBackup', { n: n }), t('common.import'));
      if (!ok) return;
      Storage.importData(data);
      // 刷新设置与字体资源
      const s = Storage.getSettings();
      document.body.className = 'theme-' + s.theme;
      renderFontOptions();
      renderCustomFontList();
      loadFontAssets();
      if (AppState.reader) { try { AppState.reader.destroy(); } catch (_) {} AppState.reader = null; }
      closeAllPanels();
      backToLibrary();
      showToast(t('toast.backupImported'));
    } catch (e) {
      console.error(e);
      showToast(t('toast.backupFail'));
    }
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
    syncCustomColorInputs(themeColorsOf(hasCustomColors() ? 'custom' : s.theme));
    updateThemePickerUI();
  }

  function applyTheme(theme) {
    if (theme === 'custom') {
      // 选择"自定义"主题：应用自定义颜色；未设置过则用当前主题默认色（可在输入框调整）
      const s = Storage.getSettings();
      const tc = themeColorsOf('custom');
      const patch = { theme: 'custom' };
      CUSTOM_COLOR_FIELDS.forEach(([sk, tk]) => { patch[sk] = tc[tk]; });
      Storage.setSettings(patch);
      document.body.className = 'theme-custom';
      if (AppState.reader) { try { AppState.reader.setCustomTheme(patch.customBg, patch.customText, patch.customAccent); } catch (_) {} }
      applyCustomTheme();
      showCustomColors(true); // 显示自定义颜色区（默认折叠）
      updateThemePickerUI();
      return;
    }
    document.body.className = 'theme-' + theme;
    // 切换预设主题时清空自定义颜色，确保主题完全生效（自定义色会覆盖主题色）
    const clearPatch = { theme };
    CUSTOM_COLOR_FIELDS.forEach(([sk]) => { clearPatch[sk] = null; });
    Storage.setSettings(clearPatch);
    if (AppState.reader) {
      try { AppState.reader.setTheme(theme); } catch (_) {}
      try { AppState.reader.setCustomTheme(null, null, null); } catch (_) {}
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
/** 语言切换（zh / en / ja）：更新高亮 + 全局应用 + 重渲染动态文案 */
  function bindLangPicker() {
    const cur = Storage.getSettings().lang || 'zh';
    els.langSeg.querySelectorAll('.seg-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.lang === cur);
      b.addEventListener('click', () => {
        CosmosI18n.setLang(b.dataset.lang);
        els.langSeg.querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('active', x === b));
        // 重渲染动态文案（书库 / 卡片 / 主题 / 多选计数等）
        renderLibrary();
        renderThemeOptions();
        updateThemePickerUI();
        renderCustomFontList();
        updateFontPickerUI();
        if (typeof updateSelectCount === 'function') updateSelectCount();
        if (typeof renderBookmarks === 'function') renderBookmarks();
      });
    });
  }
/** 自定义颜色区仅在选择"自定义"主题时显示；否则整个隐藏。显示时默认折叠 */
  function showCustomColors(visible) {
    els.customColorsSection.classList.toggle('hidden', !visible);
    if (visible) toggleCustomColors(false);
  }
/** 同步 5 个自定义颜色输入框（tc 为 themeColorsOf 结果，已含 fallback） */
  function syncCustomColorInputs(tc) {
    els.customBgInput.value = tc.bg;
    els.customTextInput.value = tc.text;
    els.customAccentInput.value = tc.accent;
    els.customBorderInput.value = tc.border;
    els.customTextDimInput.value = tc.textDim;
  }
/** 应用自定义背景/文字/强调/边框/次要文字颜色（设置面板颜色选择器） */
  function applyCustomTheme() {
    const s = Storage.getSettings();
    const hasCustom = hasCustomColors();
    const tc = themeColorsOf(hasCustom ? 'custom' : s.theme);
    syncCustomColorInputs(tc);
    // 自定义颜色同步更新主题色：在 body 上覆盖 CSS 变量（主题变量定义于 body.theme-xxx，
    // 需在 body 级 inline 覆盖才能让整个界面生效）；无自定义色时用主题默认色，有则用自定义色
    const b = document.body;
    b.style.setProperty('--bg', tc.bg);
    b.style.setProperty('--surface', tc.bg);
    if (hasCustom) {
      // 仅自定义主题时派生 secondary 背景与毛玻璃，避免残留深色主题的 --surface-2 造成深字深底
      b.style.setProperty('--surface-2', tc.bg);
      b.style.setProperty('--surface-glass', hexToRgba(tc.bg, 0.6));
    } else {
      // 预设主题：清除自定义主题残留的内联派生色，回退到 CSS 主题定义
      b.style.removeProperty('--surface-2');
      b.style.removeProperty('--surface-glass');
    }
    b.style.setProperty('--text', tc.text);
    b.style.setProperty('--accent', tc.accent);
    b.style.setProperty('--accent-soft', hexToRgba(tc.accent, 0.18));
    b.style.setProperty('--border', tc.border);
    b.style.setProperty('--text-dim', tc.textDim);
    if (AppState.reader) { try { AppState.reader.setCustomTheme(s.customBg, s.customText, s.customAccent); } catch (_) {} }
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
  Object.assign(globalThis, {bindLangPicker,  applyCustomTheme, applyTheme, deleteCustomFont, exportBackup, exportNotes, fontLabelOf, getCustomFont, hasCustomColors, importBackup, importFontFile, loadFontAssets, renderCustomFontList, renderFontOptions, renderThemeOptions, showCustomColors, syncCustomColorInputs, syncNativeVolumeKey, syncSettingsUI, themeColorsOf, themeLabelOf, toggleCustomColors, updateFlowSeg, updateFontPickerUI, updateThemePickerUI });
})(window);
