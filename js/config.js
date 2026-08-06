/* ============================================================
 * config.js — Cosmos-Reader 共享配置
 * 集中管理阅读器/应用共用的常量与主题配置（拆分后可统一维护）
 * ============================================================ */
(function (global) {
  'use strict';

  global.CosmosConfig = {
    /** cfi 前缀 */
    TXT_PREFIX: 'txt:',
    PDF_PREFIX: 'pdf:',

    /** TXT 段落总数超过该阈值启用虚拟化（避免超大文件一次性渲染卡死） */
    TXT_VIRTUAL_THRESHOLD: 50000,

    /** 划线颜色（reader.js 划线用；自定义颜色走 hexToRgba） */
    HL_COLORS: {
      yellow: 'rgba(255, 208, 0, 0.45)',
      green: 'rgba(76, 175, 80, 0.45)',
      blue: 'rgba(66, 133, 244, 0.45)',
    },

    /** 阅读内容区的默认背景/文字/强调色（_applyCustomColors 兜底用） */
    READER_THEME_COLORS: {
      light: { bg: '#ffffff', text: '#2c2c2c', accent: '#a97832' },
      sepia: { bg: '#f2e8d5', text: '#433422', accent: '#a97832' },
      dark: { bg: '#1c1c1e', text: '#d6d3cb', accent: '#d4a844' },
      green: { bg: '#e6efe2', text: '#2e3a2b', accent: '#4f8a43' },
      blue: { bg: '#e3ecf5', text: '#293846', accent: '#3577a8' },
      ink: { bg: '#121214', text: '#e4e1d9', accent: '#e0a94f' },
    },

    /** 应用主题（app.js 设置面板用） */
    THEMES: [
      { v: 'light', label: '白天', cls: 'light', bg: '#ffffff', text: '#2c2c2c', accent: '#b8860b', border: '#e4dfd3', textDim: '#8a8578' },
      { v: 'sepia', label: '护眼', cls: 'sepia', bg: '#f2e8d5', text: '#433422', accent: '#a97832', border: '#e0d2b4', textDim: '#9a8a6d' },
      { v: 'dark', label: '夜间', cls: 'dark', bg: '#1c1c1e', text: '#d6d3cb', accent: '#d4a844', border: '#38383c', textDim: '#7c7a72' },
      { v: 'green', label: '绿意', cls: 'green', bg: '#e6efe2', text: '#2e3a2b', accent: '#4f8a43', border: '#cfddc7', textDim: '#7d8f76' },
      { v: 'blue', label: '湛蓝', cls: 'blue', bg: '#e3ecf5', text: '#293846', accent: '#3577a8', border: '#cbdae6', textDim: '#7b8f9f' },
      { v: 'ink', label: '墨夜', cls: 'ink', bg: '#121214', text: '#e4e1d9', accent: '#e0a94f', border: '#333339', textDim: '#7d7b74' },
      { v: 'custom', label: '自定义', cls: 'custom' },
    ],

    /** 自定义主题可配置的颜色字段：[存储键, themeColorsOf 键] */
    CUSTOM_COLOR_FIELDS: [
      ['customBg', 'bg'],
      ['customText', 'text'],
      ['customAccent', 'accent'],
      ['customBorder', 'border'],
      ['customTextDim', 'textDim'],
    ],

    /** 书籍类型显示名（书籍信息预览用） */
    TYPE_LABELS: { epub: 'EPUB', txt: 'TXT', pdf: 'PDF' },
  };
})(window);
