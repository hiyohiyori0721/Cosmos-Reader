/* ============================================================
 * app-tools.js — 工具函数与弹窗（showToast/loadScript/ZipSlip/划线条）
 * 依赖：app-state.js（AppEls/AppState）、config.js、utils.js
 * ============================================================ */
(function () {
  'use strict';

  const els = AppEls;
  const s = AppState;


  function showInputModal(title, placeholder, initial) {
    return new Promise((resolve) => {
      s.inputResolve = resolve;
      els.inputModalTitle.textContent = title || t('input.title');
      els.inputField.placeholder = placeholder || t('common.input');
      els.inputField.value = initial || '';
      els.inputModal.classList.remove('hidden');
      setTimeout(() => { els.inputField.focus(); }, 50);
    });
  }

  function resolveInput(val) {
    els.inputModal.classList.add('hidden');
    if (s.inputResolve) { s.inputResolve(val); s.inputResolve = null; }
  }

  function confirmModal(text, okText) {
    return new Promise((resolve) => {
      s.confirmResolve = resolve;
      els.confirmText.textContent = text || t('confirm.areYouSure');
      els.btnConfirmOk.textContent = okText || t('common.ok');
      els.confirmModal.classList.remove('hidden');
    });
  }

  function resolveConfirm(val) {
    els.confirmModal.classList.add('hidden');
    if (s.confirmResolve) { s.confirmResolve(val); s.confirmResolve = null; }
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.remove('hidden');
    clearTimeout(s.toastTimer);
    s.toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 2400);
  }
/** 动态加载外部脚本（按需加载第三方库，避免首屏全量下载 epub/pdf/jszip） */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => { s.remove(); reject(new Error(t('reader.loadFail', { err: src }))); };
      document.head.appendChild(s);
    });
  }
/** Zip Slip 防护：拒绝绝对路径 / 上级目录穿越 / NUL 字符 */
  function isSafeZipPath(name) {
    if (!name || name.indexOf('\0') !== -1) return false;
    const norm = String(name).replace(/\\/g, '/');
    if (norm.charAt(0) === '/' || norm.indexOf('../') !== -1 || norm === '..') return false;
    return true;
  }
/** 展开/收起右下角悬浮按钮（带旋转与弹出动画） */
  function toggleFab(force) {
    const open = force === undefined ? !els.fabWrap.classList.contains('open') : !!force;
    els.fabWrap.classList.toggle('open', open);
  }
/** 阅读中选中文本（EPUB/TXT）回调：显示/隐藏划线操作条 */
  function onSelectedText(cfi, text, clear) {
    if (clear) { s.pendingHighlight = null; els.hlBar.classList.add('hidden'); return; }
    if (!cfi) return;
    s.pendingHighlight = { cfi, text };
    els.hlBar.classList.remove('hidden');
  }
/** 清除选中文字处的划线（划线条上的透明/清除按钮） */
  function clearPendingHighlight() {
    if (!s.pendingHighlight || !s.currentBookId) return;
    const cfi = s.pendingHighlight.cfi;
    const text = (s.pendingHighlight.text || '').trim();
    const bms = Storage.getBookmarks(s.currentBookId);
    // 先按 cfi 精确匹配，再按文本内容匹配（epub.js 选区 cfi 可能不同）
    let match = bms.find((b) => b.type === 'highlight' && b.cfi === cfi);
    if (!match && text) {
      match = bms.find((b) => b.type === 'highlight' && b.text && (text.indexOf(b.text) >= 0 || b.text.indexOf(text) >= 0));
    }
    s.pendingHighlight = null;
    els.hlBar.classList.add('hidden');
    if (!match) { showToast(t('toast.noHighlight')); return; }
    Storage.removeBookmark(s.currentBookId, match.cfi);
    if (s.reader) s.reader.removeHighlight(match.cfi);
    renderBookmarks();
    showToast(t('toast.highlightRemoved'));
  }
  Object.assign(globalThis, { clearPendingHighlight, confirmModal, isSafeZipPath, loadScript, onSelectedText, resolveConfirm, resolveInput, showInputModal, showToast, toggleFab });
})(window);
