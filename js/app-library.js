/* ============================================================
 * app-library.js — 书库/文件夹/多选/导入/打开书籍
 * 依赖：app-state.js（AppEls/AppState）、config.js、utils.js
 * ============================================================ */
(function () {
  'use strict';

  const els = AppEls;
  const s = AppState;
  const TYPE_LABELS = CosmosConfig.TYPE_LABELS;
  const formatSize = CosmosUtils.formatSize;
  const formatTime = CosmosUtils.formatTime;
  const escapeHtml = CosmosUtils.escapeHtml;


  async function extractMeta(arrayBuffer) {
    let title = t('book.untitled'), author = '';
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
        const titleEls = oDoc.getElementsByTagNameNS('*', 'title');
        if (titleEls && titleEls.length && titleEls[0].textContent) title = titleEls[0].textContent.trim() || t('book.untitled');
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
      if (href.indexOf('../') !== -1) return null; // Zip Slip 防护：拒绝路径穿越
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

  async function extractTxtMeta(arrayBuffer) {
    // 用全局 decodeTxt（BOM + UTF-8/GBK/Big5/Shift_JIS 择优）解码头部字节提取标题
    const head = arrayBuffer.slice(0, Math.min(arrayBuffer.byteLength, 8192));
    const text = decodeTxt(head);
    const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    let title = lines[0] || '';
    // 去掉常见章节前缀，取正文标题
    title = title.replace(/^第[零一二三四五六七八九十百千万两0-9]{1,5}[章节回卷部篇集][\s：:、.．\-—]*/, '').trim();
    title = title.slice(0, 30) || t('book.untitled');
    return { title, author: '' };
  }
/** 渲染顶部文件夹条（书库主页显示，横向可滚动） */
  function renderFolderBar() {
    const folders = Storage.getFolders();
    if (!folders.length) { els.folderBar.classList.add('hidden'); els.folderBar.innerHTML = ''; return; }
    els.folderBar.classList.remove('hidden');
    els.folderBar.innerHTML = '';
    const allBooks = Storage.getBooksMeta();
    folders.forEach((f) => {
      const chip = document.createElement('button');
      chip.className = 'folder-chip' + (f.id === s.currentFolderId ? ' active' : '');
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
    if (!s.currentFolderId) { els.folderNav.classList.add('hidden'); return; }
    const f = Storage.getFolders().find((x) => x.id === s.currentFolderId);
    els.folderNav.classList.remove('hidden');
    els.folderName.textContent = f ? f.name : t('folder.title');
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
    let books = s.currentFolderId
      ? list.filter((b) => b.folderId === s.currentFolderId)
      : list.filter((b) => !b.folderId);
    // 书库搜索：按书名 / 作者过滤
    const q = s.librarySearch.trim().toLowerCase();
    if (q) books = books.filter((b) => (b.title || '').toLowerCase().includes(q) || (b.author || '').toLowerCase().includes(q));
    if (!books.length) {
      els.emptyHint.classList.remove('hidden');
      if (q) {
        els.emptyHint.innerHTML = '<div class="empty-icon">🔍</div><p>' + t('library.searchEmpty', { q: escapeHtml(q) }) + '</p><p class="empty-sub">' + t('library.searchEmptySub') + '</p>';
      } else if (s.currentFolderId) {
        els.emptyHint.innerHTML = '<div class="empty-icon">📁</div><p>' + t('library.folderEmpty') + '</p><p class="empty-sub">' + t('library.folderEmptySub') + '</p>';
      } else {
        els.emptyHint.innerHTML = '<div class="empty-icon">📚</div><p>' + t('library.empty') + '</p><p class="empty-sub">' + t('library.dropSub') + '</p><p class="empty-sub">' + t('library.dropSub2') + '</p>';
      }
    } else {
      els.emptyHint.classList.add('hidden');
    }
    els.bookGrid.innerHTML = '';

    for (const book of books) {
      const card = document.createElement('button');
      card.className = 'book-card';
      card.dataset.id = book.id;
      if (s.selectMode) card.classList.add('selectable');
      if (s.selectedIds.has(book.id)) card.classList.add('selected');

      const coverEl = document.createElement('div');
      coverEl.className = 'book-cover';

      // 多选复选标记（仅多选模式显示）
      const check = document.createElement('span');
      check.className = 'select-check';
      check.textContent = '✓';
      coverEl.appendChild(check);

      const fallback = document.createElement('div');
      fallback.className = 'cover-fallback';
      fallback.textContent = (book.title || t('book.defaultTitle')).slice(0, 2);
      coverEl.appendChild(fallback);

      // 异步加载封面（blob URL 复用缓存：重复渲染不重复读 IndexedDB / 建 URL）
      if (s.coverUrls.has(book.id)) {
        const url = s.coverUrls.get(book.id);
        const img = document.createElement('img');
        img.src = url;
        img.onload = () => { img.style.display = 'block'; fallback.style.display = 'none'; };
        coverEl.insertBefore(img, fallback);
      } else {
        Storage.getBookFile(book.id).then((file) => {
          const cover = file && file.coverBlob;
          const type = cover ? (cover.type || '') : '';
          // type 为空也尝试渲染（旧数据/无 MIME 的 blob），加载失败由 onerror 兜底
          if (cover && cover.size > 0 && (type === '' || type.indexOf('image/') === 0)) {
            const url = URL.createObjectURL(cover);
            s.coverUrls.set(book.id, url);
            const img = document.createElement('img');
            img.src = url;
            img.onload = () => { img.style.display = 'block'; fallback.style.display = 'none'; };
            img.onerror = () => { try { URL.revokeObjectURL(url); } catch (_) {} s.coverUrls.delete(book.id); };
            coverEl.insertBefore(img, fallback);
          }
        });
      }

      const pct = Math.round((book.progress || 0) * 100);
      if (pct > 0 && pct < 99) {
        const badge = document.createElement('div');
        badge.className = 'progress-badge';
        badge.textContent = pct + '%';
        coverEl.appendChild(badge);
      }

      const meta = document.createElement('div');
      meta.className = 'book-meta';
      const titleEl = document.createElement('div');
      titleEl.className = 'b-title';
      titleEl.textContent = book.title;
      const a = document.createElement('div');
      a.className = 'b-author';
      a.textContent = book.author || t('book.unknownAuthor');
      const bar = document.createElement('div');
      bar.className = 'b-progress-bar';
      const fill = document.createElement('div');
      fill.className = 'b-progress-fill';
      fill.style.width = pct + '%';
      bar.appendChild(fill);
      meta.appendChild(titleEl);
      meta.appendChild(a);
      meta.appendChild(bar);

      card.appendChild(coverEl);
      card.appendChild(meta);

      // 长按卡片：弹出操作菜单（删除 / 移动）
      let pressTimer = null;
      let pressTriggered = false;
      card.addEventListener('pointerdown', () => {
        if (s.selectMode) return; // 多选模式下长按不弹单本菜单
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
        if (s.selectMode) { toggleSelect(book.id); return; }
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
/** 当前视图可见书籍（文件夹过滤 + 当前排序） */
  function getVisibleBooks() {
    const list = sortBooks(Storage.getBooksMeta());
    return s.currentFolderId
      ? list.filter((b) => b.folderId === s.currentFolderId)
      : list.filter((b) => !b.folderId);
  }

  function enterSelectMode() {
    if (!getVisibleBooks().length) { showToast(t('toast.noSelection')); return; }
    s.selectMode = true;
    s.selectedIds.clear();
    els.selectBar.classList.remove('hidden');
    els.fabWrap.classList.add('hidden');
    updateSelectUI();
    renderBookGrid();
  }

  function exitSelectMode() {
    s.selectMode = false;
    s.selectedIds.clear();
    els.selectBar.classList.add('hidden');
    els.fabWrap.classList.remove('hidden');
    renderBookGrid();
  }

  function toggleSelect(id) {
    if (s.selectedIds.has(id)) s.selectedIds.delete(id);
    else s.selectedIds.add(id);
    const card = els.bookGrid.querySelector('.book-card[data-id="' + id + '"]');
    if (card) card.classList.toggle('selected', s.selectedIds.has(id));
    updateSelectUI();
  }

  function updateSelectUI() {
    const n = s.selectedIds.size;
    els.selectCount.textContent = t('select.count', { n: n });
    const all = getVisibleBooks();
    const allSelected = all.length > 0 && all.every((b) => s.selectedIds.has(b.id));
    els.selectAll.textContent = allSelected ? t('select.cancelAll') : t('select.all');
  }

  function toggleSelectAll() {
    const all = getVisibleBooks();
    const allSelected = all.length > 0 && all.every((b) => s.selectedIds.has(b.id));
    if (allSelected) { all.forEach((b) => s.selectedIds.delete(b.id)); }
    else { all.forEach((b) => s.selectedIds.add(b.id)); }
    updateSelectUI();
    renderBookGrid(); // 重渲染更新选中态
  }

  function selectBatchMove() {
    if (!s.selectedIds.size) { showToast(t('toast.noSelection')); return; }
    openMoveModalFor(Array.from(s.selectedIds));
  }

  async function selectBatchDelete() {
    const ids = Array.from(s.selectedIds);
    if (!ids.length) { showToast(t('toast.noSelection')); return; }
    const ok = await confirmModal(t('confirm.deleteSelected', { n: ids.length }), t('common.delete'));
    if (!ok) return;
    for (const id of ids) {
      if (s.coverUrls.has(id)) { try { URL.revokeObjectURL(s.coverUrls.get(id)); } catch (_) {} s.coverUrls.delete(id); }
      try { await Storage.deleteBookFile(id); } catch (_) {}
      Storage.removeBookMeta(id);
    }
    exitSelectMode();
    renderLibrary();
    showToast(t('toast.deletedCount', { n: ids.length }));
  }
/* ================= 文件夹操作 ================= */
  function openFolder(id) {
    if (s.selectMode) exitSelectMode();
    s.currentFolderId = id;
    renderLibrary();
    els.libraryView.scrollTop = 0;
  }

  function backToLibraryRoot() {
    if (s.selectMode) exitSelectMode();
    s.currentFolderId = null;
    renderLibrary();
    els.libraryView.scrollTop = 0;
  }
/** 打开移动弹窗（支持单本或批量） */
  function openMoveModalFor(ids) {
    s.moveBookIds = ids || [];
    const folders = Storage.getFolders();
    els.moveList.innerHTML = '';
    const mk = (label, folderId) => {
      const btn = document.createElement('button');
      btn.className = 'move-item';
      btn.innerHTML = '<span class="move-icon">' + (folderId ? '📁' : '🗂') + '</span>' + label;
      btn.addEventListener('click', () => {
        s.moveBookIds.forEach((id) => Storage.setBookFolder(id, folderId));
        s.moveBookIds = null;
        els.moveModal.classList.add('hidden');
        if (s.selectMode) exitSelectMode();
        renderLibrary();
        showToast(t('toast.moved'));
      });
      els.moveList.appendChild(btn);
    };
    mk(t('book.uncategorized'), null);
    folders.forEach((f) => mk(f.name, f.id));
    els.moveModal.classList.remove('hidden');
  }

  function openMoveModal(bookId) {
    openMoveModalFor([bookId]);
  }

  function closeMoveModal() {
    s.moveBookIds = null;
    els.moveModal.classList.add('hidden');
  }
/* ================= 长按卡片操作菜单 ================= */
  function openCardMenu(bookId) {
    s.cardMenuBookId = bookId;
    const book = Storage.getBooksMeta().find((b) => b.id === bookId);
    els.cardMenuTitle.textContent = book ? book.title : '';
    els.cardMenu.classList.remove('hidden');
  }

  function closeCardMenu() {
    s.cardMenuBookId = null;
    els.cardMenu.classList.add('hidden');
  }
/** 打开书籍信息预览弹窗（封面 + 基本信息） */
  async function openBookInfo(bookId) {
    const book = Storage.getBooksMeta().find((b) => b.id === bookId);
    if (!book) return;
    s.bookInfoId = bookId;
    els.biTitle.textContent = book.title || t('book.untitled');
    els.biAuthor.textContent = book.author || t('book.unknownAuthor');
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
    s.bookInfoId = null;
    els.bookInfoModal.classList.add('hidden');
  }
/** 删除书籍（统一入口：确认、删文件、删元数据、刷新） */
  async function deleteBook(bookId) {
    const book = Storage.getBooksMeta().find((b) => b.id === bookId);
    if (!book) return;
    const ok = await confirmModal(t('confirm.deleteBook', { title: book.title }), t('common.delete'));
    if (!ok) return;
    if (s.coverUrls.has(bookId)) { try { URL.revokeObjectURL(s.coverUrls.get(bookId)); } catch (_) {} s.coverUrls.delete(bookId); }
    await Storage.deleteBookFile(bookId);
    Storage.removeBookMeta(bookId);
    renderLibrary();
    showToast(t('toast.deleted'));
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
    if (!silent) showToast(t('toast.onlySupport'));
    return false;
  }

  async function importEpub(file, silent) {
    if (!silent) showToast(t('toast.importing'));
    try {
      await loadScript('lib/jszip.min.js'); // 元数据提取依赖 JSZip
      const arrayBuffer = await file.arrayBuffer();
      const { title, author, coverBlob } = await extractMeta(arrayBuffer);
      const id = Storage.genId();
      await Storage.saveBookFile(id, arrayBuffer, coverBlob);
      Storage.upsertBookMeta({ id, title, author, type: 'epub', folderId: s.currentFolderId, addedAt: Date.now(), progress: 0 });
      if (!silent) { renderLibrary(); showToast(t('toast.imported', { title: title })); }
      return true;
    } catch (e) {
      console.error(e);
      if (!silent) showToast(t('toast.importFail'));
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
      Storage.upsertBookMeta({ id, title, author, type: 'txt', folderId: s.currentFolderId, addedAt: Date.now(), progress: 0 });
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
      const base = (file.name.replace(/\.pdf$/i, '') || t('book.untitledPdf')).trim();
      const id = Storage.genId();
      await Storage.saveBookFile(id, arrayBuffer, null);
      Storage.upsertBookMeta({ id, title: base, author: '', type: 'pdf', folderId: s.currentFolderId, addedAt: Date.now(), progress: 0 });
      if (!silent) { renderLibrary(); showToast(t('toast.imported', { title: base })); }
      return true;
    } catch (e) {
      console.error(e);
      if (!silent) showToast('导入失败：文件可能已损坏');
      return false;
    }
  }
/** 解压 zip 并自动识别其中的电子书（epub / txt / pdf）批量导入 */
  async function importZip(file) {
    showToast(t('toast.extracting'));
    try {
      await loadScript('lib/jszip.min.js'); // 解压依赖 JSZip
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const candidates = [];
      zip.forEach((path, entry) => {
        if (entry.dir) return;
        if (!isSafeZipPath(entry.name)) return; // Zip Slip 防护：跳过路径穿越条目
        if (/\.(epub|txt|pdf)$/i.test(entry.name)) candidates.push(entry);
      });
      if (!candidates.length) { showToast(t('toast.zipEmpty')); return; }
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
      showToast(fail ? t('toast.zipImported', { ok: ok, fail: fail }) : t('toast.importedCount', { n: ok }));
    } catch (e) {
      console.error(e);
      showToast(t('toast.zipFail'));
    }
  }
/* ================= 打开书籍 ================= */
  async function openBook(id) {
    const meta = Storage.getBooksMeta().find((b) => b.id === id);
    const file = await Storage.getBookFile(id);
    if (!file || !file.arrayBuffer) {
      showToast(t('toast.noBookData'));
      return;
    }
    s.currentBookId = id;
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

    els.bookTitle.textContent = meta ? meta.title : t('book.untitled');
    els.bookAuthor.textContent = meta && meta.author ? meta.author : '';

    if (!s.reader) {
      s.reader = new Reader({
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
    // 按需加载对应引擎（epub.js 依赖 JSZip；pdf.js 独立）
    try {
      if (type === 'epub') { await loadScript('lib/jszip.min.js'); await loadScript('lib/epub.min.js'); }
      else if (type === 'pdf') { await loadScript('lib/pdf.min.js'); }
    } catch (e) {
      showToast(t('toast.engineFail'));
      return;
    }
    // 引擎加载期间用户可能已返回（s.reader 被重置 / s.currentBookId 被清空），放弃本次打开
    if (!s.reader || s.currentBookId !== id) return;
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
      await s.reader.open(file.arrayBuffer, openOpts);
    } catch (_) {
      try { await s.reader.open(file.arrayBuffer, { type }); } catch (e) { console.error(e); }
    }

    // 打开过程中用户可能已返回（s.reader 被重置 / s.currentBookId 被清空），放弃后续步骤
    if (!s.reader || s.currentBookId !== id) return;
    // 目录
    s.currentToc = await s.reader.getToc();
    renderToc();

    // 恢复书签列表
    renderBookmarks();

    // 渲染已有划线高亮（EPUB/TXT）
    try {
      s.reader.setHighlights(Storage.getBookmarks(s.currentBookId).filter((b) => b.type === 'highlight'));
    } catch (_) {}

    // 恢复设置 UI 状态
    syncSettingsUI();
    showToast(t('status.reading'));

    // 5 秒后自动进入沉浸模式
    scheduleAutoHide();
  }

  function onProgress({ cfi, percent }) {
    els.progressText.textContent = Math.round(percent) + '%';
    // 翻页/滚动后隐藏划线操作条
    if (s.pendingHighlight) { s.pendingHighlight = null; els.hlBar.classList.add('hidden'); }
    const now = Date.now();
    if (now - s.lastProgressSave > 800) {
      s.lastProgressSave = now;
      Storage.setProgress(s.currentBookId, { cfi, percent: percent / 100 });
      Storage.upsertBookMeta({ id: s.currentBookId, progress: percent / 100, lastReadAt: now });
    }
  }

  function onChapter({ label }) {
    // 可选：顶部显示章节名
  }
  Object.assign(globalThis, { backToLibraryRoot, closeBookInfo, closeCardMenu, closeMoveModal, closeSortMenu, deleteBook, enterSelectMode, exitSelectMode, extractCoverFromOpf, extractMeta, extractTxtMeta, getVisibleBooks, importBookFile, importEpub, importFile, importPdf, importTxt, importZip, onChapter, onProgress, openBook, openBookInfo, openCardMenu, openFolder, openMoveModal, openMoveModalFor, openSortMenu, renderBookGrid, renderFolderBar, renderFolderNav, renderLibrary, selectBatchDelete, selectBatchMove, sortBooks, toggleSelect, toggleSelectAll, updateSelectUI });
})(window);
