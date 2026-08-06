/* ============================================================
 * storage.js — 本地存储管理
 *  - IndexedDB  : 存储书籍原始文件与封面（支持大文件）
 *  - localStorage: 存储书籍元数据、阅读进度、书签、设置
 * ============================================================ */
(function (global) {
  'use strict';

  const DB_NAME = 'epub-reader';
  const DB_VERSION = 2;
  const DB_STORE = 'books';
  const DB_STORE_FONTS = 'fonts';
  const LS_META = 'er:books';
  const LS_FOLDERS = 'er:folders';
  const LS_FONTS = 'er:fonts';
  const LS_PROGRESS_PREFIX = 'er:progress:';
  const LS_BOOKMARKS_PREFIX = 'er:bookmarks:';
  const LS_SETTINGS = 'er:settings';

  /* ---------- IndexedDB ---------- */
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(DB_STORE_FONTS)) {
          db.createObjectStore(DB_STORE_FONTS, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbPut(id, arrayBuffer, coverBlob) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put({ id, arrayBuffer, coverBlob });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function dbGet(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbDelete(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /* ---------- IndexedDB：自定义字体 ---------- */
  async function dbPutFont(id, arrayBuffer) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE_FONTS, 'readwrite');
      tx.objectStore(DB_STORE_FONTS).put({ id, arrayBuffer });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function dbGetFont(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE_FONTS, 'readonly');
      const req = tx.objectStore(DB_STORE_FONTS).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbDeleteFont(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE_FONTS, 'readwrite');
      tx.objectStore(DB_STORE_FONTS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /* ---------- localStorage 工具 ---------- */
  function lsGet(key, def) {
    try {
      const v = localStorage.getItem(key);
      return v === null || v === undefined ? def : JSON.parse(v);
    } catch (_) {
      return def;
    }
  }

  function lsSet(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.warn('localStorage 写入失败:', e);
    }
  }

  /* ---------- 工具 ---------- */
  /** TXT 解码：BOM 识别 + UTF-8 优先，非 UTF-8 在 GBK/Big5/Shift_JIS 间按 U+FFFD 择优（reader/app 共用） */
  function decodeTxt(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
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
      // UTF-8 fatal 失败可能因输入被截断（多字节字符尾部不完整）而非真非-UTF-8：
      // 非 fatal 解码，若替换符极少（≤2）说明实为 UTF-8（仅尾部截断丢字），直接返回
      const utf8Loose = new TextDecoder('utf-8').decode(bytes);
      if (countReplacement(utf8Loose) <= 2) return utf8Loose;
      const gbk = new TextDecoder('gbk').decode(bytes);
      const big5 = new TextDecoder('big5').decode(bytes);
      const sjis = new TextDecoder('shift_jis').decode(bytes);
      const gb = countReplacement(gbk);
      const b5 = countReplacement(big5);
      const sj = countReplacement(sjis);
      const min = Math.min(gb, b5, sj);
      const cands = [];
      if (gb === min) cands.push('gbk');
      if (b5 === min) cands.push('big5');
      if (sj === min) cands.push('sjis');
      if (cands.length === 1) {
        return cands[0] === 'gbk' ? gbk : cands[0] === 'big5' ? big5 : sjis;
      }
      if (cands.includes('sjis') && hasJapanese(sjis)) return sjis;
      if (cands.includes('big5') && isTraditional(big5)) return big5;
      return gbk;
    }
  }

  function countReplacement(s) {
    let n = 0;
    for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 0xFFFD) n++;
    return n;
  }

  function hasJapanese(s) {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c >= 0x3040 && c <= 0x30FF) return true;
    }
    return false;
  }

  function isTraditional(s) {
    const tradChars = '這個說裡時後與為無點書車裏來著國學聽較嗎問門開發長們兩師軍張讓當';
    const simpChars = '这个说里时候与为无点书车里来着国学听较吗问门开发长们两师军张让当';
    let t = 0, si = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (tradChars.includes(ch)) t++;
      if (simpChars.includes(ch)) si++;
    }
    return t > si;
  }

  /** 十六进制颜色 → rgba（reader 划线 / app 强调色派生共用；alpha 默认 0.45） */
  function hexToRgba(hex, alpha) {
    const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ', ' + (alpha == null ? 0.45 : alpha) + ')';
  }

  /* ---------- 公开 API ---------- */
  const Storage = {
    /* ---- 书籍文件（IndexedDB） ---- */
    saveBookFile(id, arrayBuffer, coverBlob) {
      return dbPut(id, arrayBuffer, coverBlob);
    },
    getBookFile(id) {
      return dbGet(id);
    },
    deleteBookFile(id) {
      return dbDelete(id);
    },

    /* ---- 书籍元数据列表 ---- */
    getBooksMeta() {
      return lsGet(LS_META, []);
    },
    upsertBookMeta(meta) {
      const list = lsGet(LS_META, []);
      const idx = list.findIndex((b) => b.id === meta.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...meta };
      else list.unshift(meta);
      lsSet(LS_META, list);
      return list;
    },
    removeBookMeta(id) {
      const list = lsGet(LS_META, []).filter((b) => b.id !== id);
      lsSet(LS_META, list);
      try { localStorage.removeItem(LS_PROGRESS_PREFIX + id); } catch (_) {}
      try { localStorage.removeItem(LS_BOOKMARKS_PREFIX + id); } catch (_) {}
      return list;
    },

    /* ---- 自定义字体（IndexedDB + localStorage 元数据） ---- */
    saveFont(id, arrayBuffer) {
      return dbPutFont(id, arrayBuffer);
    },
    getFont(id) {
      return dbGetFont(id);
    },
    deleteFont(id) {
      return dbDeleteFont(id);
    },
    getFonts() {
      return lsGet(LS_FONTS, []);
    },
    upsertFontMeta(meta) {
      const list = lsGet(LS_FONTS, []);
      const idx = list.findIndex((f) => f.id === meta.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...meta };
      else list.push(meta);
      lsSet(LS_FONTS, list);
      return list;
    },
    removeFontMeta(id) {
      const list = lsGet(LS_FONTS, []).filter((f) => f.id !== id);
      lsSet(LS_FONTS, list);
      return list;
    },

    /* ---- 文件夹 ---- */
    getFolders() {
      return lsGet(LS_FOLDERS, []);
    },
    createFolder(name) {
      const list = lsGet(LS_FOLDERS, []);
      const f = {
        id: 'fd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: String(name || '未命名文件夹').trim() || '未命名文件夹',
        createdAt: Date.now(),
      };
      list.push(f);
      lsSet(LS_FOLDERS, list);
      return f;
    },
    renameFolder(id, name) {
      const v = String(name || '').trim();
      const list = lsGet(LS_FOLDERS, []).map((f) =>
        f.id === id ? { ...f, name: v || f.name } : f
      );
      lsSet(LS_FOLDERS, list);
      return list;
    },
    deleteFolder(id) {
      lsSet(LS_FOLDERS, lsGet(LS_FOLDERS, []).filter((f) => f.id !== id));
      // 该文件夹下的书移回未分类
      const books = lsGet(LS_META, []);
      let changed = false;
      const next = books.map((b) => {
        if (b.folderId === id) { changed = true; return { ...b, folderId: null }; }
        return b;
      });
      if (changed) lsSet(LS_META, next);
      return next;
    },
    setBookFolder(id, folderId) {
      const list = lsGet(LS_META, []).map((b) =>
        b.id === id ? { ...b, folderId: folderId || null } : b
      );
      lsSet(LS_META, list);
      return list;
    },

    /* ---- 阅读进度 ---- */
    getProgress(id) {
      return lsGet(LS_PROGRESS_PREFIX + id, null);
    },
    setProgress(id, progress) {
      lsSet(LS_PROGRESS_PREFIX + id, {
        cfi: progress.cfi || null,
        percent: typeof progress.percent === 'number' ? progress.percent : 0,
        chapter: progress.chapter || null,
        updatedAt: Date.now(),
      });
    },

    /* ---- 书签 ---- */
    getBookmarks(id) {
      return lsGet(LS_BOOKMARKS_PREFIX + id, []);
    },
    addBookmark(id, bm) {
      const list = lsGet(LS_BOOKMARKS_PREFIX + id, []);
      if (list.some((x) => x.cfi === bm.cfi)) return list;
      list.push(bm);
      lsSet(LS_BOOKMARKS_PREFIX + id, list);
      return list;
    },
    removeBookmark(id, cfi) {
      const list = lsGet(LS_BOOKMARKS_PREFIX + id, []).filter((x) => x.cfi !== cfi);
      lsSet(LS_BOOKMARKS_PREFIX + id, list);
      return list;
    },

    /* ---- 设置 ---- */
    getSettings() {
      return Object.assign(
        {
          theme: 'light',
          fontSize: 18,
          lineHeight: 1.8,
          fontFamily: 'default',
          flow: 'paginated',
          margin: 4,
          volumeKeyTurn: true,
          bookSort: 'recent',
          lang: 'zh',
          customBg: null,
          customText: null,
          customAccent: null,
          customBorder: null,
          customTextDim: null,
        },
        lsGet(LS_SETTINGS, {})
      );
    },
    setSettings(patch) {
      const cur = Storage.getSettings();
      const next = { ...cur, ...patch };
      lsSet(LS_SETTINGS, next);
      return next;
    },

    /* ---- 备份 / 导出 ---- */
    exportData() {
      const books = lsGet(LS_META, []);
      const ids = books.map((b) => b.id);
      const progress = {};
      const bookmarks = {};
      ids.forEach((id) => {
        progress[id] = lsGet(LS_PROGRESS_PREFIX + id, null);
        bookmarks[id] = lsGet(LS_BOOKMARKS_PREFIX + id, []);
      });
      return {
        app: 'epub-reader',
        version: 1,
        exportedAt: Date.now(),
        settings: lsGet(LS_SETTINGS, {}),
        folders: lsGet(LS_FOLDERS, []),
        fonts: lsGet(LS_FONTS, []),
        books,
        progress,
        bookmarks,
      };
    },
    importData(data) {
      if (!data || typeof data !== 'object') return false;
      const books = Array.isArray(data.books) ? data.books : [];
      lsSet(LS_META, books);
      lsSet(LS_FOLDERS, Array.isArray(data.folders) ? data.folders : []);
      lsSet(LS_FONTS, Array.isArray(data.fonts) ? data.fonts : []);
      if (data.settings && typeof data.settings === 'object') lsSet(LS_SETTINGS, data.settings);
      const progress = data.progress || {};
      const bookmarks = data.bookmarks || {};
      books.forEach((b) => {
        if (progress[b.id] && typeof progress[b.id] === 'object') lsSet(LS_PROGRESS_PREFIX + b.id, progress[b.id]);
        if (Array.isArray(bookmarks[b.id])) lsSet(LS_BOOKMARKS_PREFIX + b.id, bookmarks[b.id]);
      });
      return true;
    },

    /* ---- 工具 ---- */
    genId() {
      return 'bk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },
  };

  global.Storage = Storage;
  global.hexToRgba = hexToRgba;
  global.decodeTxt = decodeTxt;
})(window);
