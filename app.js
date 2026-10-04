// =============================================
// KomikuNow - Manga Scraper Application
// Menggunakan API KanekiCraynet/api-manga
// Desain berdasarkan DESCRIPTION.md
// =============================================

// Konfigurasi API
// Diambil dari config.js (otomatis menyesuaikan local vs production).
// Fallback ke localhost bila config.js tidak dimuat.
const API_BASE = (window.KOMIKUNOW_CONFIG && window.KOMIKUNOW_CONFIG.API_BASE)
    ? window.KOMIKUNOW_CONFIG.API_BASE
    : 'http://localhost:3000';
const DEFAULT_PROVIDER = (window.KOMIKUNOW_CONFIG && window.KOMIKUNOW_CONFIG.DEFAULT_PROVIDER)
    ? window.KOMIKUNOW_CONFIG.DEFAULT_PROVIDER
    : 'shinigami';
const BOOKMARK_STORAGE_KEY = 'komikunow_bookmarks';
const READING_HISTORY_KEY = 'komikunow_history';

// State Aplikasi
const state = {
    latestPage: 1,
    latestTotalPages: 1,
    searchResults: [],
    popularResults: [],
    recommendedResults: [],
    currentDetail: null,
    currentChapters: [],
    currentChapterIndex: 0,
    currentMangaUrl: null,
    currentProvider: DEFAULT_PROVIDER,
    currentSection: 'home',
    isReaderOpen: false,
    heroIndex: 0,
    heroData: [],
    heroInterval: null,
    lastScrollY: 0
};

// Toast controls
let toastTimeout = null;
let errorToastTimeout = null;

// =============================================
// Bookmark & History Functions
// =============================================

function getBookmarks() {
    try {
        return JSON.parse(localStorage.getItem(BOOKMARK_STORAGE_KEY)) || [];
    } catch (e) {
        console.error('Error loading bookmarks:', e);
        return [];
    }
}

function saveBookmarks(bookmarks) {
    try {
        localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(bookmarks));
    } catch (e) {
        console.error('Error saving bookmarks:', e);
    }
}

function isBookmarked(mangaId) {
    return getBookmarks().some(b => b.mangaId === mangaId);
}

function addBookmark(manga) {
    const bookmarks = getBookmarks();
    if (bookmarks.some(b => b.mangaId === manga.mangaId)) return false;

    const newBookmark = {
        mangaId: manga.mangaId,
        title: manga.title,
        thumbnail: manga.thumbnail || '',
        type: manga.type || 'Manga',
        status: manga.status || '',
        addedAt: Date.now(),
        lastChapterIndex: 0,
        lastChapterTitle: '',
        lastChapterId: '',
        totalChapters: 0,
        updatedAt: Date.now()
    };

    bookmarks.unshift(newBookmark);
    saveBookmarks(bookmarks);
    updateBookmarkBadge();
    renderBookmarks();
    return true;
}

function removeBookmark(mangaId) {
    const bookmarks = getBookmarks().filter(b => b.mangaId !== mangaId);
    saveBookmarks(bookmarks);
    updateBookmarkBadge();
    if (state.currentSection === 'bookmarksSection') renderBookmarks();
}

function toggleBookmark() {
    if (!state.currentDetail || !state.currentMangaUrl) return;

    if (isBookmarked(state.currentMangaUrl)) {
        removeBookmark(state.currentMangaUrl);
        showToast('Komik dihapus dari bookmark.');
    } else {
        const mangaInfo = {
            mangaId: state.currentMangaUrl,
            title: state.currentDetail.title,
            thumbnail: state.currentDetail.thumbnail,
            type: state.currentDetail.type,
            status: state.currentDetail.status
        };
        addBookmark(mangaInfo);
        showToast('Komik disimpan ke bookmark!');
    }
    updateBookmarkButton();
}

function updateBookmarkButton() {
    const btn = document.getElementById('detailBookmarkBtn');
    if (!btn) return;
    const isSaved = state.currentMangaUrl && isBookmarked(state.currentMangaUrl);
    btn.classList.toggle('active', isSaved);
    btn.innerHTML = isSaved
        ? '<i class="fas fa-bookmark"></i> Di Bookmark'
        : '<i class="fas fa-bookmark"></i> Bookmark';
}

function updateBookmarkProgress(mangaId, chapterIndex, chapter) {
    if (!mangaId || chapterIndex < 0) return;
    const bookmarks = getBookmarks();
    const bookmark = bookmarks.find(b => b.mangaId === mangaId);
    if (!bookmark) return;

    bookmark.lastChapterIndex = chapterIndex;
    bookmark.lastChapterTitle = chapter?.title || `Chapter ${chapterIndex + 1}`;
    bookmark.lastChapterId = chapter?.href ? getMangaIdFromHref(chapter.href) : '';
    bookmark.totalChapters = state.currentChapters?.length || bookmark.totalChapters;
    bookmark.updatedAt = Date.now();

    saveBookmarks(bookmarks);
    
    // Save reading history too
    const history = getReadingHistory();
    const existing = history.findIndex(h => h.mangaId === mangaId);
    const historyEntry = {
        mangaId,
        title: bookmark.title,
        thumbnail: bookmark.thumbnail,
        chapterIndex,
        chapterTitle: bookmark.lastChapterTitle,
        chapterId: bookmark.lastChapterId,
        updatedAt: Date.now()
    };
    if (existing >= 0) history.splice(existing, 1);
    history.unshift(historyEntry);
    localStorage.setItem(READING_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));

    if (state.currentSection === 'bookmarksSection') renderBookmarks();
}

function getReadingHistory() {
    try {
        return JSON.parse(localStorage.getItem(READING_HISTORY_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function getBookmarkById(mangaId) {
    return getBookmarks().find(b => b.mangaId === mangaId) || null;
}

// =============================================
// Bookmark UI
// =============================================

function updateBookmarkBadge() {
    const el = document.getElementById('bookmarkCount');
    if (el) el.textContent = getBookmarks().length;
}

function renderBookmarks() {
    const container = document.getElementById('bookmarksGrid');
    const bookmarks = getBookmarks();
    const clearBtn = document.getElementById('clearBookmarksBtn');

    if (clearBtn) clearBtn.style.display = bookmarks.length > 0 ? 'inline-flex' : 'none';
    if (!container) return;

    if (bookmarks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bookmark"></i>
                <p>Belum ada komik yang di-bookmark.</p>
                <p style="font-size:0.8rem; margin-top:0.4rem; color:var(--text-secondary);">
                    Klik tombol bookmark di halaman detail komik.
                </p>
            </div>`;
        return;
    }

    container.innerHTML = bookmarks.map((b, i) => {
        const progress = b.totalChapters > 0
            ? Math.min(100, Math.round(((b.lastChapterIndex + 1) / b.totalChapters) * 100))
            : 0;

        return `
            <div class="manga-card" style="animation-delay: ${i * 0.05}s">
                <div class="manga-cover" onclick="openDetail('/manga/${b.mangaId}')">
                    <span class="type-badge">${b.type || 'Manga'}</span>
                    <div class="bookmark-actions">
                        <button class="btn-card-action btn-card-resume" onclick="event.stopPropagation(); resumeBookmark('${b.mangaId}')" title="Lanjut baca">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="btn-card-action btn-card-remove" onclick="event.stopPropagation(); removeBookmark('${b.mangaId}')" title="Hapus">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    ${b.thumbnail
                        ? `<img src="${b.thumbnail}" alt="${b.title}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'no-image\\'><i class=\\'fas fa-book-open\\'></i></div>'">`
                        : `<div class="no-image"><i class="fas fa-book-open"></i></div>`}
                    ${progress > 0 ? `
                        <div class="bookmark-progress">
                            <i class="fas fa-book-open"></i>
                            <div class="progress-bar"><div class="progress-bar-fill" style="width:${progress}%"></div></div>
                        </div>` : ''}
                </div>
                <div class="manga-info">
                    <div class="manga-title" onclick="openDetail('/manga/${b.mangaId}')">${b.title}</div>
                    <div class="manga-meta">
                        <span class="manga-status ${getStatusClass(b.status)}">${b.status || 'Unknown'}</span>
                        <span>${b.lastChapterTitle || 'Belum dibaca'}</span>
                    </div>
                    <div class="bookmark-continue-btn" onclick="resumeBookmark('${b.mangaId}')">
                        <i class="fas fa-play"></i> Lanjut Baca
                    </div>
                </div>
            </div>`;
    }).join('');
}

function showBookmarks() {
    showSection('bookmarksSection');
    renderBookmarks();
    updateBookmarkBadge();
}

function clearAllBookmarks() {
    if (getBookmarks().length === 0) return;
    if (!confirm('Hapus semua bookmark?')) return;
    localStorage.removeItem(BOOKMARK_STORAGE_KEY);
    updateBookmarkBadge();
    renderBookmarks();
    showToast('Semua bookmark dihapus.');
}

async function resumeBookmark(mangaId) {
    const bookmark = getBookmarkById(mangaId);
    if (!bookmark) return;

    showLoading(true);
    try {
        const detail = await fetchDetail(mangaId, state.currentProvider);
        if (!detail || Object.keys(detail).length === 0) {
            showToast('Gagal memuat data komik.', true);
            return;
        }

        state.currentDetail = detail;
        state.currentMangaUrl = mangaId;
        state.currentChapters = detail.chapter || [];

        let resumeIndex = bookmark.lastChapterIndex;
        if (resumeIndex < 0 || resumeIndex >= state.currentChapters.length) {
            const lastId = bookmark.lastChapterId;
            const found = state.currentChapters.findIndex(ch => getMangaIdFromHref(ch.href) === lastId);
            resumeIndex = found >= 0 ? found : 0;
        }
        state.currentChapterIndex = resumeIndex;

        const chapter = state.currentChapters[resumeIndex];
        const chapterId = chapter?.href ? getMangaIdFromHref(chapter.href) : '';
        if (chapterId) {
            showModal('readerModal');
            state.isReaderOpen = true;
            const result = await fetchChapter(chapterId, state.currentProvider);
            renderReaderChapter(result);
            updateReaderNavButtons();
            updateReaderProgress();
            showToast(`Melanjutkan: ${result.title || chapter.title}`);
        } else {
            renderDetailModal(detail);
            showModal('detailModal');
        }
    } catch (err) {
        console.error('Resume error:', err);
        showToast('Gagal melanjutkan baca.', true);
    } finally {
        showLoading(false);
    }
}

// =============================================
// Utility
// =============================================

function showToast(message, isError = false) {
    const el = document.getElementById(isError ? 'errorToast' : 'toast');
    el.textContent = message;
    el.style.display = 'block';
    clearTimeout(isError ? toastTimeout : errorToastTimeout);
    const t = setTimeout(() => el.style.display = 'none', 3000);
    isError ? (errorToastTimeout = t) : (toastTimeout = t);
}

function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'flex' : 'none';
}

function safeText(text, fallback = '-') {
    if (!text) return fallback;
    return String(text);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getStatusClass(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('ongoing') || s.includes('on going')) return 'ongoing';
    if (s.includes('completed')) return 'completed';
    return '';
}

function getMangaIdFromHref(href) {
    if (!href) return '';
    const parts = String(href).split('/');
    return parts[parts.length - 1];
}

// =============================================
// API
// =============================================

async function apiFetch(endpoint) {
    const cfg = window.KOMIKUNOW_CONFIG || {};
    const base = cfg.API_BASE || API_BASE;
    const res = await fetch(`${base}${endpoint}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// Provider shinigami dipanggil LANGSUNG dari browser oleh shinigami.js
// (api.shngm.io memberi CORS `access-control-allow-origin: *`).
// Server API kita kena blokir Cloudflare utk shinigami dari IP cloud,
// jadi jangan lewat server utk provider ini.
function useShinigami(provider) {
    return (provider || state.currentProvider) === 'shinigami'
        && typeof window.SHINIGAMI !== 'undefined';
}

async function fetchLatest(page = 1) {
    if (useShinigami()) {
        const data = await SHINIGAMI.latest(page);
        if (data && Array.isArray(data.data)) {
            state.latestTotalPages = data.length_page || 1;
            return data.data;
        }
        return [];
    }
    const data = await apiFetch(`/terbaru?page=${page}&provider=${state.currentProvider}`);
    // /terbaru mengembalikan objek paginasi {current_page, length_page, data:[...]}
    // agar konsisten dengan fetch lain, kembalikan array + simpan info halaman.
    if (data && Array.isArray(data.data)) {
        state.latestTotalPages = data.length_page || 1;
        return data.data;
    }
    return data?.data || [];
}

async function searchManga(keyword) {
    if (useShinigami()) return SHINIGAMI.search(keyword);
    const data = await apiFetch(`/search?keyword=${encodeURIComponent(keyword)}&provider=${state.currentProvider}`);
    const d = data?.data;
    // /search bisa mengembalikan {data:[...]} atau {data:{data:[...]}}
    if (d && Array.isArray(d.data)) return d.data;
    return d || [];
}

async function fetchPopular() {
    if (useShinigami()) return SHINIGAMI.popular();
    const data = await apiFetch(`/popular?provider=${state.currentProvider}`);
    const d = data?.data;
    if (d && Array.isArray(d.data)) return d.data;
    return d || [];
}

async function fetchRecommended() {
    if (useShinigami()) return SHINIGAMI.recommended();
    const data = await apiFetch(`/recommended?provider=${state.currentProvider}`);
    const d = data?.data;
    if (d && Array.isArray(d.data)) return d.data;
    return d || [];
}

async function fetchDetail(mangaUrl, provider) {
    if (useShinigami(provider)) return SHINIGAMI.detail(mangaUrl);
    const data = await apiFetch(`/detail/${encodeURIComponent(mangaUrl)}?provider=${provider || state.currentProvider}`);
    return data?.data || {};
}

async function fetchChapter(chapterUrl, provider) {
    if (useShinigami(provider)) return SHINIGAMI.read(chapterUrl);
    const data = await apiFetch(`/read/${encodeURIComponent(chapterUrl)}?provider=${provider || state.currentProvider}`);
    const chapters = data?.data || [];
    return chapters[0] || { title: '', panel: [] };
}

// =============================================
// Rendering
// =============================================

function coverCandidates(manga, detail) {
    const src = detail || manga || {};
    // thumbnail (penuh) DULU — paling sering valid; varian kecil hanya cadangan.
    const list = [
        src.thumbnail,
        src.cover,
        manga && manga.thumbnail,
        detail && detail.thumbnail,
        src.coverThumb,
        src.cover_thumb,
        manga && manga.coverThumb,
        detail && detail.coverThumb,
    ].filter(u => typeof u === 'string' && u && !u.includes('nopicture'));
    // Tambah varian ukuran resmi MangaDex (.256.jpg): ganti ekstensi,
    // BUKAN ditempel (format "...png.256.jpg" salah dan 404 untuk sebagian file).
    const extra = [];
    for (const u of list) {
        if (u.includes('uploads.mangadex.org/covers/') && !u.endsWith('.256.jpg')) {
            extra.push(u.replace(/\.(jpe?g|png|gif|webp)$/i, '.256.jpg'));
        }
    }
    const seen = new Set();
    return list.concat(extra).filter(u => !seen.has(u) && seen.add(u));
}

function coverImgTag(manga, detail, title, cls, extraAttrs) {
    const cands = coverCandidates(manga, detail);
    const t = safeText(title, 'Unknown');
    if (!cands.length) return `<div class="no-image${cls ? ' ' + cls : ''}"><i class="fas fa-book-open"></i></div>`;
    const chain = JSON.stringify(cands).replace(/"/g, '&quot;');
    return `<img src="${cands[0]}" alt="${t}" loading="lazy" referrerpolicy="no-referrer" data-cands="${chain}" data-idx="0"${extraAttrs ? ' ' + extraAttrs : ''} onerror="coverImgFail(this)">`;
}

// Dipanggil saat <img> cover gagal dimuat: coba URL cadangan berikutnya,
// terakhir tampilkan placeholder bila semua gagal.
function coverImgFail(img) {
    try {
        const cands = JSON.parse((img.getAttribute('data-cands') || '').replace(/&quot;/g, '"') || '[]');
        const idx = parseInt(img.getAttribute('data-idx') || '0', 10) + 1;
        if (idx < cands.length) {
            img.setAttribute('data-idx', String(idx));
            img.src = cands[idx];
            return;
        }
    } catch (e) { /* abaikan, tampilkan placeholder */ }
    const cls = img.getAttribute('data-noimg-cls') || 'no-image';
    img.parentElement.innerHTML = `<div class="${cls}"><i class="fas fa-book-open"></i></div>`;
}
function createMangaCard(manga, index, showHot = false) {
    const title = safeText(manga.title, 'Unknown');
    const type = safeText(manga.type, 'Manga');
    const chapter = safeText(manga.chapter, '');
    const rating = manga.rating ? parseFloat(manga.rating).toFixed(1) : null;
    const status = safeText(manga.status, '');
    const href = manga.href || '';
    const year = manga.year || manga.released || '';

    const statusClass = getStatusClass(status);

    // Fallback berlapis: thumbnail -> coverThumb -> varian .256 MangaDex.
    const coverHtml = coverImgTag(manga, null, title, '');

    return `
        <div class="manga-card" onclick="openDetail('${encodeURIComponent(href)}')" style="animation-delay: ${index * 0.04}s">
            <div class="manga-cover">
                ${showHot ? '<span class="hot-badge">🔥 Hot</span>' : ''}
                ${type && type !== 'Manga' ? `<span class="type-badge">${type}</span>` : ''}
                ${rating ? `<span class="rating-badge">⭐ ${rating}</span>` : ''}
                ${coverHtml}
            </div>
            <div class="manga-info">
                <div class="manga-title">${title}</div>
                <div class="manga-meta">
                    ${statusClass ? `<span class="manga-status ${statusClass}">${status}</span>` : ''}
                    <span>${chapter || year || type}</span>
                </div>
            </div>
        </div>`;
}

function renderMangaGrid(containerId, items, showHot = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-book-open"></i><p>Tidak ada data.</p></div>`;
        return;
    }
    container.innerHTML = items.map((item, i) => createMangaCard(item, i, showHot)).join('');
}

// =============================================
// Hero Carousel
// =============================================

function renderHeroSlides() {
    const track = document.getElementById('heroTrack');
    const dots = document.getElementById('heroDots');
    if (!track || !state.heroData.length) return;

    track.innerHTML = state.heroData.map((manga, i) => {
        const title = safeText(manga.title, 'Unknown');
        const href = manga.href || '';
        const rating = manga.rating ? parseFloat(manga.rating).toFixed(1) : null;
        const type = safeText(manga.type, 'Manga');
        const genres = safeText(manga.genre, '');
        const heroImg = coverImgTag(manga, null, title, '');

        return `
            <div class="hero-slide" onclick="openDetail('${encodeURIComponent(href)}')">
                ${heroImg}
                <div class="hero-slide-content">
                    <div class="hero-slide-badges">
                        ${rating ? `<span class="hero-slide-badge rating">⭐ ${rating}</span>` : ''}
                        <span class="hero-slide-badge hot">🔥 Hot</span>
                        <span class="hero-slide-badge">${type}</span>
                    </div>
                    <h3>${title}</h3>
                    <div class="hero-slide-genres">${genres}</div>
                    <button class="btn-read" onclick="event.stopPropagation(); openDetail('${encodeURIComponent(href)}')">
                        <i class="fas fa-play"></i> Baca Sekarang
                    </button>
                </div>
            </div>`;
    }).join('');

    dots.innerHTML = state.heroData.map((_, i) =>
        `<button class="hero-dot ${i === state.heroIndex ? 'active' : ''}" onclick="gotoHeroSlide(${i})"></button>`
    ).join('');

    updateHeroPosition();
}

function updateHeroPosition() {
    const track = document.getElementById('heroTrack');
    if (!track) return;
    track.style.transform = `translateX(-${state.heroIndex * 100}%)`;
    document.querySelectorAll('.hero-dot').forEach((d, i) => {
        d.classList.toggle('active', i === state.heroIndex);
    });
}

function heroSlide(direction) {
    if (!state.heroData.length) return;
    state.heroIndex = (state.heroIndex + direction + state.heroData.length) % state.heroData.length;
    updateHeroPosition();
}

function gotoHeroSlide(index) {
    state.heroIndex = index;
    updateHeroPosition();
}

function startHeroAutoPlay() {
    if (state.heroInterval) clearInterval(state.heroInterval);
    state.heroInterval = setInterval(() => heroSlide(1), 5000);
}

// =============================================
// Navigation
// =============================================

function showSection(sectionName) {
    const sections = ['homeSection', 'latestSection', 'searchSection', 'popularSection', 'recommendedSection', 'bookmarksSection'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    const target = document.getElementById(sectionName);
    if (target) target.style.display = 'block';

    document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
    const navMap = { homeSection: 0, latestSection: 1, popularSection: 2, bookmarksSection: 3 };
    const idx = navMap[sectionName];
    if (idx !== undefined) {
        document.querySelectorAll('.nav-links a')[idx]?.classList.add('active');
    }

    state.currentSection = sectionName;
}

function showHome() {
    showSection('homeSection');
    document.getElementById('searchInput').value = '';
    if (state.heroInterval) clearInterval(state.heroInterval);
    startHeroAutoPlay();
}

function showLatest() {
    showSection('latestSection');
    loadLatestGrid();
}

function showPopular() {
    showSection('popularSection');
    loadPopularGrid();
}

function showRecommended() {
    showSection('recommendedSection');
    loadRecommendedGrid();
}

// =============================================
// Data Loading
// =============================================

async function loadHome() {
    showLoading(true);
    try {
        // Provider default: shinigami (dipanggil LANGSUNG dari browser lewat
        // shinigami.js, tanpa lewat server API kita yang kena blokir Cloudflare).
        // fetchLatest() sudah mengembalikan ARRAY.
        let items = [];
        try {
            items = await fetchLatest(1);
        } catch (e) {
            console.warn('[KomikuNow] fetchLatest gagal:', e?.message);
        }
        if (!items.length) {
            try { console.error('[KomikuNow] API_BASE yang dipakai =', (window.KOMIKUNOW_CONFIG && window.KOMIKUNOW_CONFIG.API_BASE)); } catch (e) {}
            showToast('Gagal memuat data home.', true);
            return;
        }
        // Hero = data terbaru paling top 5
        state.heroData = items.slice(0, 5);
        renderHeroSlides();
        startHeroAutoPlay();

        // Homepage grids (provider aktif saat ini)
        renderMangaGrid('latestGrid', items.slice(0, 12));

        let popular = [];
        try { popular = await fetchPopular(); } catch (e) { console.warn('[KomikuNow] popular gagal:', e?.message); }
        renderMangaGrid('popularGrid', popular.slice(0, 12), true);

        let recommended = [];
        try { recommended = await fetchRecommended(); } catch (e) { console.warn('[KomikuNow] recommended gagal:', e?.message); }
        renderMangaGrid('recommendedGrid', recommended.slice(0, 12));
    } catch (err) {
        console.error('Home load error:', err);
        console.error('[KomikuNow] API_BASE yang dipakai =', (window.KOMIKUNOW_CONFIG && window.KOMIKUNOW_CONFIG.API_BASE));
        showToast('Gagal memuat data home.', true);
    } finally {
        showLoading(false);
    }
}

async function loadLatestGrid() {
    showLoading(true);
    try {
        // fetchLatest() sudah mengembalikan ARRAY + mengisi state.latestTotalPages.
        const comics = await fetchLatest(state.latestPage);

        document.getElementById('pageInfo').textContent = `Hal ${state.latestPage} / ${state.latestTotalPages}`;
        document.getElementById('prevPage').disabled = state.latestPage <= 1;
        document.getElementById('nextPage').disabled = state.latestPage >= state.latestTotalPages;

        renderMangaGrid('latestFullGrid', comics);
    } catch (err) {
        console.error('Latest load error:', err);
        renderMangaGrid('latestFullGrid', []);
        showToast('Gagal memuat daftar terbaru.', true);
    } finally {
        showLoading(false);
    }
}

function changeLatestPage(direction) {
    const newPage = state.latestPage + direction;
    if (newPage < 1 || newPage > state.latestTotalPages) return;
    state.latestPage = newPage;
    loadLatestGrid();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleSearch(event) {
    event.preventDefault();
    const keyword = document.getElementById('searchInput').value.trim();
    if (!keyword) {
        showToast('Masukkan kata kunci pencarian.', true);
        return;
    }

    showLoading(true);
    try {
        const results = await searchManga(keyword);
        state.searchResults = results;
        document.getElementById('searchQueryLabel').textContent = `"${keyword}"`;
        showSection('searchSection');
        renderMangaGrid('searchGrid', results);

        if (results.length === 0) {
            showToast('Tidak ada hasil ditemukan.', true);
        } else {
            showToast(`${results.length} hasil untuk "${keyword}"`);
        }
    } catch (err) {
        console.error('Search error:', err);
        renderMangaGrid('searchGrid', []);
        showToast('Gagal melakukan pencarian.', true);
    } finally {
        showLoading(false);
    }
}

async function loadPopularGrid() {
    showLoading(true);
    try {
        const results = await fetchPopular();
        renderMangaGrid('popularFullGrid', results, true);
    } catch (err) {
        console.error('Popular load error:', err);
        renderMangaGrid('popularFullGrid', []);
        showToast('Gagal memuat komik populer.', true);
    } finally {
        showLoading(false);
    }
}

async function loadRecommendedGrid() {
    showLoading(true);
    try {
        const results = await fetchRecommended();
        renderMangaGrid('recommendedFullGrid', results);
    } catch (err) {
        console.error('Recommended load error:', err);
        renderMangaGrid('recommendedFullGrid', []);
        showToast('Gagal memuat komik rekomendasi.', true);
    } finally {
        showLoading(false);
    }
}

function searchByGenre(genre) {
    closeModal('detailModal');
    document.getElementById('searchInput').value = genre;
    handleSearch({ preventDefault: () => {} });
}

// =============================================
// Detail Modal
// =============================================

async function openDetail(encodedHref) {
    const href = decodeURIComponent(encodedHref);
    const mangaId = getMangaIdFromHref(href);
    if (!mangaId) {
        showToast('ID manga tidak valid.', true);
        return;
    }

    showLoading(true);
    try {
        const detail = await fetchDetail(mangaId, state.currentProvider);
        if (!detail || Object.keys(detail).length === 0) {
            showToast('Detail komik tidak ditemukan.', true);
            return;
        }

        state.currentDetail = detail;
        state.currentMangaUrl = mangaId;
        state.currentChapters = detail.chapter || [];
        state.currentChapterIndex = state.currentChapters.length > 0 ? 0 : -1;

        renderDetailModal(detail);
        showModal('detailModal');
    } catch (err) {
        console.error('Detail load error:', err);
        showToast('Gagal memuat detail komik.', true);
    } finally {
        showLoading(false);
    }
}

function renderDetailModal(detail) {
    const container = document.getElementById('detailContent');
    const title = safeText(detail.title, 'Unknown');
    const type = safeText(detail.type, '');
    const status = safeText(detail.status, '');
    const rating = detail.rating ? parseFloat(detail.rating).toFixed(1) : null;
    const author = safeText(detail.author, '');
    const released = safeText(detail.released, '');
    const description = safeText(detail.description, 'Tidak ada deskripsi.');
    const chapters = Array.isArray(detail.chapter) ? detail.chapter : [];

    const genres = Array.isArray(detail.genre) && detail.genre.length > 0
        ? detail.genre.map(g => typeof g === 'string' ? g : (g.title || '')).filter(Boolean)
        : [];

    const statusClass = getStatusClass(status);
    const statusBadge = statusClass
        ? `<span class="detail-badge ${statusClass}">${status}</span>`
        : status ? `<span class="detail-badge">${status}</span>` : '';

    const badges = `
        ${type ? `<span class="detail-badge primary">${type}</span>` : ''}
        ${statusBadge}
        ${rating ? `<span class="detail-badge warning">⭐ ${rating}</span>` : ''}
        ${author ? `<span class="detail-badge">✍️ ${author}</span>` : ''}
        ${released ? `<span class="detail-badge">📅 ${released}</span>` : ''}
    `;

    const genreTags = genres.length > 0 ? `
        <div class="detail-genres">
            ${genres.map(g => `<button class="genre-tag" onclick="searchByGenre('${g.replace(/'/g, "\\'")}')">${g}</button>`).join('')}
        </div>` : '';

    const chapterList = chapters.length > 0 ? `
        <div class="chapter-section">
            <h3><i class="fas fa-list"></i> Daftar Chapter (${chapters.length})</h3>
            <div class="chapter-list">
                ${chapters.map((ch, idx) => `
                    <div class="chapter-item" onclick="openReader('${encodeURIComponent(getMangaIdFromHref(ch.href))}', ${idx})">
                        <div class="chapter-info">
                            <span class="chapter-number">${ch.number != null ? `#${ch.number}` : `Ch. ${idx + 1}`}</span>
                            <span class="chapter-title">${safeText(ch.title, '')}</span>
                        </div>
                        <span class="chapter-date">${formatDate(ch.date)}</span>
                    </div>`).join('')}
            </div>
        </div>` : `<div class="empty-state"><p>Belum ada chapter.</p></div>`;

    let coverHtml = coverImgTag(state.currentDetail || null, detail, title, 'detail-no-image');
    coverHtml = coverHtml.replace('data-idx="0"', 'data-idx="0" data-noimg-cls="no-image detail-no-image"');

    container.innerHTML = `
        <div class="detail-header">
            <div class="detail-cover">${coverHtml}</div>
            <div class="detail-info">
                <h2>${title}</h2>
                <button class="btn-bookmark" id="detailBookmarkBtn" onclick="toggleBookmark()">
                    <i class="fas fa-bookmark"></i> Bookmark
                </button>
                <div class="detail-badges">${badges}</div>
                ${genreTags}
                <div class="detail-description">${description}</div>
            </div>
        </div>
        ${chapterList}
    `;

    updateBookmarkButton();
}

// =============================================
// Reader
// =============================================

async function openReader(chapterId, chapterIndex) {
    if (chapterIndex >= 0) state.currentChapterIndex = chapterIndex;
    if (!chapterId) {
        showToast('ID chapter tidak valid.', true);
        return;
    }

    state.isReaderOpen = true;
    showModal('readerModal');
    showLoading(true);

    try {
        const chapter = await fetchChapter(chapterId, state.currentProvider);
        renderReaderChapter(chapter);
        updateReaderNavButtons();
        updateReaderProgress();

        // Auto-save bookmark & history
        const mangaId = state.currentMangaUrl;
        if (mangaId && isBookmarked(mangaId)) {
            updateBookmarkProgress(mangaId, state.currentChapterIndex, chapter);
        }
    } catch (err) {
        console.error('Reader error:', err);
        showToast('Gagal memuat chapter.', true);
    } finally {
        showLoading(false);
    }
}

function renderReaderChapter(chapter) {
    const title = safeText(chapter.title, 'Chapter');
    const panels = Array.isArray(chapter.panel) ? chapter.panel : [];

    document.getElementById('readerTitle').textContent = title;
    
    const label = document.getElementById('readerChapterLabel');
    if (label) {
        label.textContent = state.currentChapters[state.currentChapterIndex]?.number != null
            ? `Ch. ${state.currentChapters[state.currentChapterIndex].number}`
            : `Ch. ${state.currentChapterIndex + 1}`;
    }

    const panelContainer = document.getElementById('readerPanels');

    if (panels.length === 0) {
        panelContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-image"></i>
                <p>Gambar tidak tersedia untuk chapter ini.</p>
                <p style="font-size:0.78rem; margin-top:0.4rem; color:var(--text-secondary);">
                    Coba provider lain atau refresh halaman.
                </p>
            </div>`;
        return;
    }

    panelContainer.innerHTML = panels.map((url, i) =>
        `<img src="${url}" alt="Page ${i + 1}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'">`
    ).join('');

    const reader = document.querySelector('.reader-content');
    if (reader) reader.scrollTo({ top: 0 });

    resetReaderProgress();
}

function updateReaderNavButtons() {
    const buttons = document.querySelectorAll('.reader-footer .btn-secondary');
    if (buttons[0]) buttons[0].disabled = state.currentChapterIndex <= 0;
    if (buttons[1]) buttons[1].disabled = state.currentChapterIndex >= state.currentChapters.length - 1;
}

function resetReaderProgress() {
    const fill = document.getElementById('readerProgressFill');
    if (fill) fill.style.width = '0%';
}

function updateReaderProgress() {
    const reader = document.querySelector('.reader-content');
    const fill = document.getElementById('readerProgressFill');
    if (!reader || !fill) return;

    const max = reader.scrollHeight - reader.clientHeight;
    if (max <= 0) return;
    const percent = Math.min(100, (reader.scrollTop / max) * 100);
    fill.style.width = `${percent}%`;
}

function changeChapter(direction) {
    if (!state.currentChapters?.length) {
        showToast('Tidak ada chapter.', true);
        return;
    }

    const newIndex = state.currentChapterIndex + direction;
    if (newIndex < 0 || newIndex >= state.currentChapters.length) {
        showToast(direction > 0 ? 'Ini chapter terakhir.' : 'Ini chapter pertama.', true);
        return;
    }

    state.currentChapterIndex = newIndex;
    const chapter = state.currentChapters[newIndex];
    const chapterId = getMangaIdFromHref(chapter.href);
    if (!chapterId) {
        showToast('ID chapter tidak valid.', true);
        return;
    }

    showLoading(true);
    fetchChapter(chapterId, state.currentProvider)
        .then(ch => {
            renderReaderChapter(ch);
            updateReaderNavButtons();
            resetReaderProgress();

            const mangaId = state.currentMangaUrl;
            if (mangaId && isBookmarked(mangaId)) {
                updateBookmarkProgress(mangaId, state.currentChapterIndex, ch);
            }
        })
        .catch(err => {
            console.error('Chapter change error:', err);
            showToast('Gagal memuat chapter.', true);
        })
        .finally(() => showLoading(false));
}

// =============================================
// Modal
// =============================================

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    if (modalId === 'readerModal') state.isReaderOpen = false;
    if (!document.querySelector('.modal-overlay[style*="flex"]')) {
        document.body.style.overflow = '';
    }
}

// =============================================
// Init
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    // Modal clicks
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', e => {
            if (e.target === overlay) closeModal(overlay.id);
        });
    });

    // Esc key
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay[style*="flex"]').forEach(o => closeModal(o.id));
        }
    });

    // Reader scroll progress
    document.querySelector('.reader-content')?.addEventListener('scroll', () => {
        updateReaderProgress();
        // Auto-hide header on scroll down
        const header = document.getElementById('readerHeader');
        const footer = document.querySelector('.reader-footer');
        const reader = document.querySelector('.reader-content');
        if (header && reader) {
            if (reader.scrollTop > 150 && reader.scrollTop > state.lastScrollY) {
                header.classList.add('hidden');
                if (footer) footer.style.transform = 'translateY(100%)';
            } else {
                header.classList.remove('hidden');
                if (footer) footer.style.transform = '';
            }
            state.lastScrollY = reader.scrollTop;
        }
    });

    // Load home
    loadHome();
    updateBookmarkBadge();
});