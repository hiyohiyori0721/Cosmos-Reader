/* ============================================================
 * utils.js — Cosmos-Reader 共享工具函数
 * 无状态纯工具（app.js / reader.js 共用），集中管理
 * ============================================================ */
(function (global) {
  'use strict';

  /** HTML 转义（拼接用户输入进 innerHTML 时防注入/破坏结构） */
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** 字节数格式化为可读大小 */
  function formatSize(bytes) {
    if (!bytes && bytes !== 0) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  /** 时间戳格式化为可读时间 */
  function formatTime(ts) {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (_) { return '—'; }
  }

  /** 正则转义（用户搜索词插入正则时防破坏） */
  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** 自定义字体 @font-face 中使用的字体族名（保证唯一、安全） */
  function customFontFamily(id) { return 'Custom-' + id; }

  global.CosmosUtils = { escapeHtml, formatSize, formatTime, escapeRegExp, customFontFamily };
})(window);
