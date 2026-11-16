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
    heroPrefetchTimer: null,
    heroTab: 'rec',
    heroSets: {},
    heroPaused: false,
    heroLoadToken: 0,
    fetchCache: {},
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

// Escape untuk disisipkan ke HTML (teks maupun atribut).
function escapeHtml(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Satu permintaan per kunci (hasilnya dipakai ulang oleh hero & grid beranda).
function once(key, fn) {
    if (!state.fetchCache[key]) {
        state.fetchCache[key] = fn().catch(err => {
            delete state.fetchCache[key];
            throw err;
        });
    }
    return state.fetchCache[key];
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

// Bungkus URL cover lewat proxy resize (WebP, lebar w). URL asli tetap dipakai
// sebagai cadangan di rantai onerror bila proxy gagal / dimatikan.
function proxiedCover(url, w) {
    const base = (window.KOMIKUNOW_CONFIG && window.KOMIKUNOW_CONFIG.IMG_PROXY) || '';
    if (!base || !w || !/^https?:\/\//i.test(url) || url.indexOf(base) === 0) return url;
    return `${base}?url=${encodeURIComponent(url)}&w=${w}&output=webp&q=72&we=1`;
}

// Lebar gambar hero mengikuti layar: slide aktif ~88% lebar layar
// (dibulatkan ke kelipatan 160, maks 1280).
function heroImageWidth() {
    const px = Math.min(1280, (window.innerWidth || 412) * 0.88 * Math.min(window.devicePixelRatio || 1, 2));
    return Math.ceil(px / 160) * 160;
}

// opts.priority: 'high'  -> gambar LCP (jangan lazy, fetchpriority=high)
//                'defer' -> jangan diunduh dulu (src diisi nanti lewat hydrateHeroSlide)
//                (kosong) -> lazy loading biasa
// opts.portrait: true    -> utamakan varian potret (lebih cocok utk kartu 2:3)
// opts.w:        lebar (px) gambar yang diminta ke proxy resize
function coverImgTag(manga, detail, title, cls, extraAttrs, opts) {
    opts = opts || {};
    let cands = coverCandidates(manga, detail);
    const t = safeText(title, 'Unknown');
    if (!cands.length) return `<div class="no-image${cls ? ' ' + cls : ''}"><i class="fas fa-book-open"></i></div>`;
    if (opts.portrait) {
        const s0 = detail || manga || {};
        const portrait = [s0.coverThumb, s0.cover_thumb, manga && manga.coverThumb]
            .filter(u => typeof u === 'string' && u && !u.includes('nopicture'));
        if (portrait.length) {
            const seenP = new Set();
            cands = portrait.concat(cands).filter(u => !seenP.has(u) && seenP.add(u));
        }
    }
    if (opts.w) {
        const first = proxiedCover(cands[0], opts.w);
        if (first !== cands[0]) cands = [first].concat(cands);
    }
    const chain = JSON.stringify(cands).replace(/"/g, '&quot;');
    let loadAttrs;
    if (opts.priority === 'high') loadAttrs = `src="${cands[0]}" fetchpriority="high" decoding="async"`;
    else if (opts.priority === 'defer') loadAttrs = `data-src="${cands[0]}" decoding="async"`;
    else loadAttrs = `src="${cands[0]}" loading="lazy" decoding="async"`;
    return `<img ${loadAttrs} alt="${escapeHtml(t)}" referrerpolicy="no-referrer" data-cands="${chain}" data-idx="0"${extraAttrs ? ' ' + extraAttrs : ''} onerror="coverImgFail(this)">`;
}

// Isi src untuk gambar hero yang sengaja ditunda (hanya saat slide itu akan dilihat).
function hydrateHeroSlide(index) {
    const slide = document.querySelectorAll('#heroTrack .hero-slide')[index];
    const img = slide && slide.querySelector('img[data-src]');
    if (img) {
        img.src = img.getAttribute('data-src');
        img.removeAttribute('data-src');
    }
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
    const coverHtml = coverImgTag(manga, null, title, '', '', { portrait: true, w: 400 });

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
// Slide aktif di tengah, slide kiri/kanan mengintip (diredupkan). Posisi dihitung
// melingkar lewat variabel CSS --off (-2..2), jadi tetangga selalu ada di kedua sisi,
// termasuk saat berputar dari slide terakhir ke pertama.

const HERO_MAX = 8;
const HERO_AUTOPLAY_MS = 6000;
const NOTICE_KEY = 'komikunow_notice_v1';

function heroOffset(i, active, n) {
    const half = Math.floor(n / 2);
    return ((i - active + n + half) % n) - half;
}

function heroTagsHtml(manga) {
    const list = String(manga.genre || '').split(',').map(g => g.trim()).filter(Boolean);
    if (!list.length && manga.type) list.push(manga.type);
    return list.slice(0, 3)
        .map((g, i) => `<span class="hero-tag hero-tag-${i % 4}">${escapeHtml(g)}</span>`)
        .join('');
}

function renderHeroSlides() {
    const track = document.getElementById('heroTrack');
    const dots = document.getElementById('heroDots');
    if (!track || !dots) return;
    const data = state.heroData;
    const n = data.length;
    if (!n) {
        track.textContent = '';
        dots.textContent = '';
        return;
    }
    if (state.heroIndex >= n) state.heroIndex = 0;
    const imgW = heroImageWidth();

    track.innerHTML = data.map((manga, i) => {
        const title = safeText(manga.title, 'Unknown');
        const desc = safeText(manga.description, '').trim();
        const off = heroOffset(i, state.heroIndex, n);
        const active = off === 0;
        const cls = active ? 'is-active' : (Math.abs(off) === 1 ? 'is-near' : 'is-far');
        const img = coverImgTag(manga, null, title, '', '', { priority: active ? 'high' : 'defer', w: imgW });
        return `
            <div class="hero-slide ${cls}" style="--off:${off}" role="group" aria-roledescription="slide" aria-label="${i + 1} dari ${n}"${active ? '' : ' aria-hidden="true"'} onclick="heroSlideClick(${i})">
                ${img}
                <div class="hero-slide-content">
                    <h2 class="hero-slide-title"><a href="#" class="hero-slide-link"${active ? '' : ' tabindex="-1"'} onclick="event.preventDefault(); event.stopPropagation(); heroSlideClick(${i})">${escapeHtml(title)}</a></h2>
                    ${desc ? `<p class="hero-slide-desc">${escapeHtml(desc)}</p>` : ''}
                    <div class="hero-tags">${heroTagsHtml(manga)}</div>
                </div>
            </div>`;
    }).join('');

    dots.innerHTML = data.map((_, i) =>
        `<button type="button" class="hero-dot${i === state.heroIndex ? ' active' : ''}" onclick="gotoHeroSlide(${i})" aria-label="Slide ${i + 1}"${i === state.heroIndex ? ' aria-current="true"' : ''}></button>`
    ).join('');

    // fade-in halus saat isi carousel diganti (ganti tab / data baru tiba)
    track.classList.remove('is-entering');
    void track.offsetWidth;
    track.classList.add('is-entering');

    hydrateHeroNeighbors();
}

// Slide tetangga ikut terlihat (mengintip), jadi gambarnya dimuat juga, tetapi baru
// setelah gambar slide aktif (LCP) selesai agar tidak berebut bandwidth.
function hydrateHeroNeighbors() {
    clearTimeout(state.heroPrefetchTimer);
    const n = state.heroData.length;
    if (n < 2) return;
    const run = () => {
        state.heroPrefetchTimer = setTimeout(() => {
            hydrateHeroSlide((state.heroIndex + 1) % n);
            hydrateHeroSlide((state.heroIndex - 1 + n) % n);
        }, 150);
    };
    const active = document.querySelectorAll('#heroTrack .hero-slide')[state.heroIndex];
    const img = active && active.querySelector('img');
    if (!img || img.complete) { run(); return; }
    let done = false;
    const go = () => { if (!done) { done = true; run(); } };
    img.addEventListener('load', go, { once: true });
    img.addEventListener('error', go, { once: true });
    state.heroPrefetchTimer = setTimeout(go, 2500);
}

function updateHeroPosition() {
    const slides = document.querySelectorAll('#heroTrack .hero-slide');
    const n = slides.length;
    if (!n) return;
    slides.forEach((el, i) => {
        const off = heroOffset(i, state.heroIndex, n);
        const active = off === 0;
        el.style.setProperty('--off', off);
        el.classList.toggle('is-active', active);
        el.classList.toggle('is-near', Math.abs(off) === 1);
        el.classList.toggle('is-far', Math.abs(off) > 1);
        if (active) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', 'true');
        const link = el.querySelector('.hero-slide-link');
        if (link) link.tabIndex = active ? 0 : -1;
    });
    hydrateHeroSlide(state.heroIndex);
    hydrateHeroNeighbors();
    document.querySelectorAll('.hero-dot').forEach((d, i) => {
        const on = i === state.heroIndex;
        d.classList.toggle('active', on);
        if (on) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
    });
}

function heroSlide(direction, auto) {
    const n = state.heroData.length;
    if (!n) return;
    state.heroIndex = (state.heroIndex + direction + n) % n;
    updateHeroPosition();
    if (!auto) startHeroAutoPlay();   // interaksi manual -> mulai hitung ulang
}

function gotoHeroSlide(index) {
    if (index < 0 || index >= state.heroData.length) return;
    state.heroIndex = index;
    updateHeroPosition();
    startHeroAutoPlay();
}

// Klik slide: slide samping -> jadikan aktif; slide aktif -> buka detail komik.
function heroSlideClick(index) {
    const manga = state.heroData[index];
    if (!manga) return;
    if (index !== state.heroIndex) { gotoHeroSlide(index); return; }
    openDetail(encodeURIComponent(manga.href || ''));
}

function heroHomeVisible() {
    const el = document.getElementById('homeSection');
    return !!el && el.style.display !== 'none';
}

function startHeroAutoPlay() {
    if (state.heroInterval) clearInterval(state.heroInterval);
    state.heroInterval = null;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    state.heroInterval = setInterval(() => {
        if (state.heroPaused || document.hidden || !heroHomeVisible()) return;
        heroSlide(1, true);
    }, HERO_AUTOPLAY_MS);
}

// ----- Tab Rekomendasi / Pilihan Admin -----

function updateHeroTabsUI() {
    document.querySelectorAll('.hero-tab').forEach(btn => {
        const on = btn.getAttribute('data-tab') === state.heroTab;
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
        btn.tabIndex = on ? 0 : -1;
        if (on) {
            const panel = document.getElementById('heroPanel');
            if (panel) panel.setAttribute('aria-labelledby', btn.id);
        }
    });
}

async function loadHeroSet(tab) {
    if (state.heroSets[tab] && state.heroSets[tab].length) return state.heroSets[tab];
    const provider = state.currentProvider;
    let items = [];
    if (tab === 'rec') {
        items = useShinigami()
            ? await once('hero:' + provider, () => SHINIGAMI.hero())
            : await once('recommended:' + provider, fetchRecommended);
    } else {
        const picks = ((window.KOMIKUNOW_CONFIG || {}).ADMIN_PICKS) || [];
        if (picks.length && useShinigami()) {
            try { items = await SHINIGAMI.byIds(picks); } catch (e) { items = []; }
        }
        if (!items.length) items = await once('popular:' + provider, fetchPopular);
    }
    items = (items || []).filter(m => m && m.title).slice(0, HERO_MAX);
    if (items.length) state.heroSets[tab] = items;
    return items;
}

async function setHeroTab(tab) {
    if (tab === state.heroTab) return;
    const previous = state.heroTab;
    const token = ++state.heroLoadToken;
    state.heroTab = tab;
    updateHeroTabsUI();
    let items = [];
    try { items = await loadHeroSet(tab); } catch (e) { console.warn('[KomikuNow] hero tab gagal:', e && e.message); }
    if (token !== state.heroLoadToken) return;      // pengguna sudah pindah tab lagi
    if (!items.length) {
        state.heroTab = previous;
        updateHeroTabsUI();
        showToast('Gagal memuat daftar komik.', true);
        return;
    }
    state.heroData = items;
    state.heroIndex = 0;
    renderHeroSlides();
    startHeroAutoPlay();
}

// ----- Inisialisasi (tab, jeda saat disentuh/diarahkan, swipe, bar pengumuman) -----

function initHero() {
    const tabs = Array.from(document.querySelectorAll('.hero-tab'));
    tabs.forEach((btn, idx) => {
        btn.addEventListener('click', () => setHeroTab(btn.getAttribute('data-tab')));
        btn.addEventListener('keydown', e => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            const next = tabs[(idx + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
            next.focus();
            setHeroTab(next.getAttribute('data-tab'));
        });
    });

    const box = document.getElementById('heroCarousel');
    if (box) {
        const pause = () => { state.heroPaused = true; };
        const resume = () => { state.heroPaused = false; };
        box.addEventListener('mouseenter', pause);
        box.addEventListener('mouseleave', resume);
        box.addEventListener('focusin', pause);
        box.addEventListener('focusout', resume);

        let sx = 0, sy = 0, tracking = false;
        box.addEventListener('touchstart', e => {
            const t = e.touches[0];
            sx = t.clientX; sy = t.clientY; tracking = true;
            pause();
        }, { passive: true });
        box.addEventListener('touchend', e => {
            resume();
            if (!tracking) return;
            tracking = false;
            const t = e.changedTouches[0];
            const dx = t.clientX - sx, dy = t.clientY - sy;
            if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) heroSlide(dx < 0 ? 1 : -1);
        }, { passive: true });
        box.addEventListener('touchcancel', () => { tracking = false; resume(); }, { passive: true });
        box.addEventListener('keydown', e => {
            if (e.key === 'ArrowLeft') heroSlide(-1);
            else if (e.key === 'ArrowRight') heroSlide(1);
        });
    }

    const bar = document.getElementById('noticeBar');
    const close = document.getElementById('noticeClose');
    if (bar && close) {
        close.addEventListener('click', () => {
            bar.hidden = true;
            try { localStorage.setItem(NOTICE_KEY, '1'); } catch (e) { /* ignore */ }
        });
    }
}

document.addEventListener('DOMContentLoaded', initHero);

// =============================================
// Navigation
// =============================================

function showSection(sectionName) {
    const sections = ['homeSection', 'latestSection', 'searchSection', 'popularSection', 'recommendedSection', 'filterSection', 'bookmarksSection'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    const target = document.getElementById(sectionName);
    if (target) target.style.display = 'block';

    document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
    const navMap = { homeSection: 0, latestSection: 1, popularSection: 2, filterSection: 3, bookmarksSection: 4 };
    const idx = navMap[sectionName];
    if (idx !== undefined) {
        document.querySelectorAll('.nav-links a')[idx]?.classList.add('active');
    }

    state.currentSection = sectionName;

    // Keluar dari halaman filter -> bersihkan hash #filter dari URL.
    if (sectionName !== 'filterSection' && /^#filter/.test(location.hash)) {
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    }
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
        // Hero (rekomendasi, payload kecil) dan "Update Terbaru" diminta bersamaan.
        // Provider default: shinigami dipanggil LANGSUNG dari browser lewat shinigami.js,
        // tanpa lewat server API kita yang kena blokir Cloudflare.
        const latestP = fetchLatest(1).catch(e => {
            console.warn('[KomikuNow] fetchLatest gagal:', e?.message);
            return [];
        });
        let heroItems = await loadHeroSet('rec').catch(e => {
            console.warn('[KomikuNow] hero gagal:', e?.message);
            return [];
        });
        if (!heroItems.length) {
            // Cadangan: 5 judul terbaru, supaya carousel tidak pernah kosong.
            heroItems = (await latestP).slice(0, 5);
            if (heroItems.length) state.heroSets.rec = heroItems;
        }
        if (heroItems.length) {
            state.heroData = heroItems;
            renderHeroSlides();
            startHeroAutoPlay();
        }

        const items = await latestP;
        if (!items.length && !heroItems.length) {
            try { console.error('[KomikuNow] API_BASE yang dipakai =', (window.KOMIKUNOW_CONFIG && window.KOMIKUNOW_CONFIG.API_BASE)); } catch (e) {}
            showToast('Gagal memuat data home.', true);
            return;
        }
        renderMangaGrid('latestGrid', items.slice(0, 12));

        const provider = state.currentProvider;
        const [popular, recommended] = await Promise.all([
            once('popular:' + provider, fetchPopular).catch(e => { console.warn('[KomikuNow] popular gagal:', e?.message); return []; }),
            once('recommended:' + provider, fetchRecommended).catch(e => { console.warn('[KomikuNow] recommended gagal:', e?.message); return []; })
        ]);
        renderMangaGrid('popularGrid', popular.slice(0, 12), true);
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

// =============================================
// Filter Genre
// =============================================
// Penyaringan dilakukan di browser dari "kolam" judul yang dimuat sekali
// (terbaru + terpopuler, sekitar 250 judul), sehingga tidak bergantung pada
// parameter filter API yang tidak terdokumentasi. Pilihan filter disimpan di
// hash URL (#filter?genre=Action,Romance&type=Manhwa) agar bisa dibagikan.

const FILTER_PAGE_SIZE = 24;
const FILTER_VISIBLE_CHIPS = 16;
const FILTER_DEFAULT_GENRES = ['Action', 'Romance', 'Comedy', 'Fantasy', 'Drama', 'Adventure',
    'Horror', 'Martial Arts', 'School Life', 'Sci-Fi', 'Mystery', 'Sports'];
const FILTER_DEFAULT_TYPES = ['Manga', 'Manhwa', 'Manhua'];
const FILTER_SORTS = ['latest', 'popular', 'rating'];
const FILTER_FAR = 1e9; // urutan "tidak ada" (taruh paling akhir)

const filterState = {
    genres: [],
    type: '',
    status: '',
    sort: 'latest',
    mode: 'all',
    shown: FILTER_PAGE_SIZE,
    showAllChips: false,
    pool: null,
    poolPromise: null,
    uiReady: false
};

function normKey(s) {
    return String(s || '').trim().toLowerCase();
}

function itemGenres(m) {
    const g = m && m.genre;
    const arr = Array.isArray(g)
        ? g.map(x => typeof x === 'string' ? x : ((x && (x.title || x.name)) || ''))
        : String(g || '').split(',');
    return arr.map(x => x.trim()).filter(Boolean);
}

async function loadFilterPool() {
    if (filterState.pool) return filterState.pool;
    if (!filterState.poolPromise) {
        filterState.poolPromise = (async () => {
            const jobs = [];
            if (useShinigami()) {
                for (let p = 1; p <= 3; p++) {
                    jobs.push({ kind: 'l', page: p, req: SHINIGAMI.list(`page=${p}&page_size=50&sort=latest&sort_order=desc`) });
                }
                for (let p = 1; p <= 2; p++) {
                    jobs.push({ kind: 'p', page: p, req: SHINIGAMI.list(`page=${p}&page_size=50&sort=rank&sort_order=asc`) });
                }
            } else {
                jobs.push({ kind: 'l', page: 1, req: fetchLatest(1) });
                jobs.push({ kind: 'p', page: 1, req: fetchPopular() });
            }
            const results = await Promise.all(jobs.map(j => j.req.then(r => r, () => null)));

            const map = new Map();
            results.forEach((list, k) => {
                if (!Array.isArray(list)) return;
                const job = jobs[k];
                const base = (job.page - 1) * 50;
                list.forEach((m, i) => {
                    const key = m.href || m.title;
                    if (!key) return;
                    let cur = map.get(key);
                    if (!cur) {
                        cur = Object.assign({}, m, { _l: FILTER_FAR, _p: FILTER_FAR });
                        map.set(key, cur);
                    }
                    const idx = base + i;
                    if (job.kind === 'l') cur._l = Math.min(cur._l, idx);
                    else cur._p = Math.min(cur._p, idx);
                });
            });
            if (map.size === 0) throw new Error('Kolam judul kosong');
            filterState.pool = Array.from(map.values());
            return filterState.pool;
        })().catch(err => {
            filterState.poolPromise = null; // izinkan coba lagi
            throw err;
        });
    }
    return filterState.poolPromise;
}

function getFilterFacets() {
    const pool = filterState.pool || [];
    const genreMap = new Map();
    const typeMap = new Map(FILTER_DEFAULT_TYPES.map(t => [normKey(t), t]));
    pool.forEach(m => {
        itemGenres(m).forEach(name => {
            const k = normKey(name);
            const e = genreMap.get(k);
            if (e) e.count++;
            else genreMap.set(k, { name, count: 1 });
        });
        if (m.type && !typeMap.has(normKey(m.type))) typeMap.set(normKey(m.type), m.type);
    });
    let genres = Array.from(genreMap.values())
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    if (!genres.length) genres = FILTER_DEFAULT_GENRES.map(name => ({ name, count: 0 }));
    return { genres, types: Array.from(typeMap.values()) };
}

function getFilteredItems() {
    const f = filterState;
    const sel = f.genres.map(normKey);
    const items = (f.pool || []).filter(m => {
        if (sel.length) {
            const have = itemGenres(m).map(normKey);
            const ok = f.mode === 'any'
                ? sel.some(s => have.includes(s))
                : sel.every(s => have.includes(s));
            if (!ok) return false;
        }
        if (f.type && normKey(m.type) !== normKey(f.type)) return false;
        if (f.status && !normKey(m.status).includes(normKey(f.status))) return false;
        return true;
    });
    if (f.sort === 'rating') {
        items.sort((a, b) => (b.rating || 0) - (a.rating || 0) || a._l - b._l);
    } else if (f.sort === 'popular') {
        items.sort((a, b) => a._p - b._p || a._l - b._l);
    } else {
        items.sort((a, b) => a._l - b._l || a._p - b._p);
    }
    return items;
}

// ----- URL hash -----

function filterToHash() {
    const f = filterState;
    const p = new URLSearchParams();
    if (f.genres.length) p.set('genre', f.genres.join(','));
    if (f.type) p.set('type', f.type);
    if (f.status) p.set('status', f.status);
    if (f.sort !== 'latest') p.set('sort', f.sort);
    if (f.mode !== 'all') p.set('mode', f.mode);
    const qs = p.toString();
    return '#filter' + (qs ? '?' + qs : '');
}

function syncFilterHash() {
    if (state.currentSection !== 'filterSection') return;
    try { history.replaceState(null, '', location.pathname + location.search + filterToHash()); } catch (e) { /* ignore */ }
}

function applyFilterHash(hash) {
    if (!/^#filter/.test(hash || '')) return false;
    const p = new URLSearchParams((hash.split('?')[1]) || '');
    const f = filterState;
    f.genres = (p.get('genre') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 8);
    f.type = (p.get('type') || '').slice(0, 30);
    f.status = ['ongoing', 'completed'].includes(p.get('status')) ? p.get('status') : '';
    f.sort = FILTER_SORTS.includes(p.get('sort')) ? p.get('sort') : 'latest';
    f.mode = p.get('mode') === 'any' ? 'any' : 'all';
    return true;
}

// ----- Render -----

function renderFilterChips() {
    const box = document.getElementById('filterChips');
    if (!box) return;
    const { genres } = getFilterFacets();
    const list = genres.slice();
    filterState.genres.forEach(n => {
        if (!list.some(g => normKey(g.name) === normKey(n))) list.push({ name: n, count: 0 });
    });
    const selected = new Set(filterState.genres.map(normKey));
    const visible = filterState.showAllChips
        ? list
        : list.filter((g, i) => i < FILTER_VISIBLE_CHIPS || selected.has(normKey(g.name)));

    box.textContent = '';
    visible.forEach(g => {
        const on = selected.has(normKey(g.name));
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'filter-chip' + (on ? ' active' : '');
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.setAttribute('data-genre', g.name);
        b.appendChild(document.createTextNode(g.name));
        if (g.count) {
            const c = document.createElement('span');
            c.className = 'filter-chip-count';
            c.textContent = g.count;
            b.appendChild(c);
        }
        box.appendChild(b);
    });

    const more = document.getElementById('filterMore');
    if (more) {
        const hidden = list.length - visible.length;
        more.hidden = !(filterState.showAllChips || hidden > 0);
        more.textContent = filterState.showAllChips ? 'Tampilkan lebih sedikit' : `Tampilkan semua genre (${list.length})`;
        more.setAttribute('aria-expanded', filterState.showAllChips ? 'true' : 'false');
    }
}

function syncFilterControls() {
    const f = filterState;
    const typeSel = document.getElementById('filterType');
    if (typeSel) {
        const { types } = getFilterFacets();
        const opts = types.slice();
        if (f.type && !opts.some(t => normKey(t) === normKey(f.type))) opts.push(f.type);
        typeSel.textContent = '';
        const all = document.createElement('option');
        all.value = '';
        all.textContent = 'Semua';
        typeSel.appendChild(all);
        opts.forEach(t => {
            const o = document.createElement('option');
            o.value = t;
            o.textContent = t;
            typeSel.appendChild(o);
        });
        const match = opts.find(t => normKey(t) === normKey(f.type));
        typeSel.value = match || '';
    }
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('filterStatus', f.status);
    set('filterSort', f.sort);
    set('filterMode', f.mode);

    const modeField = document.getElementById('filterMode');
    if (modeField) modeField.disabled = f.genres.length < 2;
    const reset = document.getElementById('filterReset');
    if (reset) reset.hidden = !(f.genres.length || f.type || f.status || f.sort !== 'latest' || f.mode !== 'all');
}

function renderFilterResults(append) {
    const grid = document.getElementById('filterGrid');
    const summary = document.getElementById('filterSummary');
    const note = document.getElementById('filterNote');
    const moreBtn = document.getElementById('filterLoadMore');
    if (!grid) return;

    const items = getFilteredItems();
    const f = filterState;

    if (summary) {
        const parts = [];
        if (f.genres.length) parts.push(f.genres.join(f.mode === 'any' ? ' atau ' : ' + '));
        if (f.type) parts.push(f.type);
        if (f.status) parts.push(f.status === 'ongoing' ? 'Ongoing' : 'Completed');
        summary.textContent = `${items.length} judul ditemukan` + (parts.length ? ` untuk ${parts.join(' · ')}` : '');
    }
    if (note) {
        const n = (f.pool || []).length;
        note.textContent = `Disaring dari ${n} judul terbaru dan terpopuler. Tidak menemukan yang dicari? Pakai kolom pencarian di atas.`;
    }

    if (!items.length) {
        grid.textContent = '';
        const box = document.createElement('div');
        box.className = 'empty-state';
        box.innerHTML = '<i class="fas fa-filter-circle-xmark"></i>';
        const p = document.createElement('p');
        p.textContent = 'Tidak ada judul yang cocok dengan kombinasi filter ini.';
        box.appendChild(p);
        if (f.genres.length) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-secondary filter-empty-btn';
            btn.textContent = `Cari "${f.genres.join(' ')}" dengan kata kunci`;
            btn.addEventListener('click', searchFromFilter);
            box.appendChild(btn);
        }
        grid.appendChild(box);
        if (moreBtn) moreBtn.hidden = true;
        return;
    }

    const shown = Math.min(f.shown, items.length);
    if (append) {
        const from = grid.querySelectorAll('.manga-card').length;
        grid.insertAdjacentHTML('beforeend',
            items.slice(from, shown).map((m, i) => createMangaCard(m, i)).join(''));
    } else {
        grid.innerHTML = items.slice(0, shown).map((m, i) => createMangaCard(m, i % FILTER_PAGE_SIZE)).join('');
    }
    if (moreBtn) {
        const left = items.length - shown;
        moreBtn.hidden = left <= 0;
        moreBtn.textContent = `Muat lebih banyak (${left} lagi)`;
    }
}

function renderFilterStatus(kind) {
    const grid = document.getElementById('filterGrid');
    const summary = document.getElementById('filterSummary');
    const moreBtn = document.getElementById('filterLoadMore');
    if (moreBtn) moreBtn.hidden = true;
    if (summary) summary.textContent = '';
    if (!grid) return;
    if (kind === 'loading') {
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memuat daftar judul…</p></div>';
    } else {
        grid.textContent = '';
        const box = document.createElement('div');
        box.className = 'empty-state';
        box.innerHTML = '<i class="fas fa-triangle-exclamation"></i>';
        const p = document.createElement('p');
        p.textContent = 'Gagal memuat daftar judul. Periksa koneksi lalu coba lagi.';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-secondary filter-empty-btn';
        btn.textContent = 'Coba lagi';
        btn.addEventListener('click', showFilter);
        box.appendChild(p);
        box.appendChild(btn);
        grid.appendChild(box);
    }
}

function applyFilter(opts) {
    opts = opts || {};
    if (!opts.keepShown) filterState.shown = FILTER_PAGE_SIZE;
    syncFilterHash();
    renderFilterChips();
    syncFilterControls();
    renderFilterResults(false);
}

// ----- Aksi -----

function initFilterUI() {
    if (filterState.uiReady) return;
    filterState.uiReady = true;

    const chips = document.getElementById('filterChips');
    if (chips) {
        chips.addEventListener('click', e => {
            const btn = e.target.closest('.filter-chip');
            if (!btn) return;
            const name = btn.getAttribute('data-genre');
            const idx = filterState.genres.findIndex(g => normKey(g) === normKey(name));
            if (idx >= 0) filterState.genres.splice(idx, 1);
            else filterState.genres.push(name);
            applyFilter();
            // pertahankan fokus pada chip yang sama setelah dirender ulang
            const again = Array.from(chips.querySelectorAll('.filter-chip'))
                .find(b => normKey(b.getAttribute('data-genre')) === normKey(name));
            if (again) again.focus({ preventScroll: true });
        });
    }

    const bind = (id, key) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => { filterState[key] = el.value; applyFilter(); });
    };
    bind('filterMode', 'mode');
    bind('filterType', 'type');
    bind('filterStatus', 'status');
    bind('filterSort', 'sort');

    const more = document.getElementById('filterMore');
    if (more) more.addEventListener('click', () => {
        filterState.showAllChips = !filterState.showAllChips;
        renderFilterChips();
    });

    const loadMore = document.getElementById('filterLoadMore');
    if (loadMore) loadMore.addEventListener('click', () => {
        filterState.shown += FILTER_PAGE_SIZE;
        renderFilterResults(true);
    });

    const reset = document.getElementById('filterReset');
    if (reset) reset.addEventListener('click', resetFilter);
}

function resetFilter() {
    Object.assign(filterState, { genres: [], type: '', status: '', sort: 'latest', mode: 'all', shown: FILTER_PAGE_SIZE });
    applyFilter();
}

async function showFilter(e) {
    // Dipanggil dari <a href="#" onclick="showFilter()">: cegah lompat ke atas / hash "#".
    const ev = e || window.event;
    if (ev && ev.preventDefault) ev.preventDefault();
    initFilterUI();
    showSection('filterSection');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    syncFilterHash();
    syncFilterControls();
    if (!filterState.pool) {
        renderFilterChips();
        renderFilterStatus('loading');
        try {
            await loadFilterPool();
        } catch (err) {
            console.error('Filter pool error:', err);
            renderFilterStatus('error');
            return;
        }
    }
    applyFilter({ keepShown: true });
}

function searchFromFilter() {
    const keyword = filterState.genres.join(' ').trim();
    if (!keyword) return;
    document.getElementById('searchInput').value = keyword;
    handleSearch({ preventDefault: () => {} });
}

// Genre pill / tag genre di detail komik sekarang membuka filter genre sungguhan
// (bukan lagi sekadar pencarian kata kunci).
function searchByGenre(genre) {
    closeModal('detailModal');
    Object.assign(filterState, { genres: [genre], type: '', status: '', shown: FILTER_PAGE_SIZE, showAllChips: false });
    showFilter();
}

document.addEventListener('DOMContentLoaded', () => {
    // Tautan langsung, mis. https://.../Web_Komik/#filter?genre=Action,Romance
    if (applyFilterHash(location.hash)) showFilter();
});

// Hash diubah manual / tombol back-forward saat halaman sudah terbuka.
window.addEventListener('hashchange', () => {
    if (!/^#filter/.test(location.hash)) return;
    if (location.hash === filterToHash() && state.currentSection === 'filterSection') return;
    if (applyFilterHash(location.hash)) showFilter();
});

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
        `<img src="${url}" alt="Page ${i + 1}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.style.display='none'">`
    ).join('');

    const reader = document.querySelector('.reader-content');
    if (reader) reader.scrollTo({ top: 0 });

    resetReaderProgress();
}

function updateReaderNavButtons() {
    const buttons = document.querySelectorAll('.reader-footer .btn-secondary');
    const exitBtn = document.getElementById('readerBtnExit');
    const nextBtn = document.getElementById('readerBtnNext');

    // Chapters diurutkan descending (index 0 = chapter tertinggi).
    // Tombol "Sebelumnya" (index++) berarti menuju chapter nomor lebih rendah.
    if (buttons[0]) buttons[0].disabled = state.currentChapterIndex >= state.currentChapters.length - 1;
    if (buttons[1]) buttons[1].disabled = state.currentChapterIndex <= 0;

    // Tombol "Keluar Baca" muncul saat berada di chapter terakhir (index 0 = chapter tertinggi)
    if (exitBtn && nextBtn) {
        const isLast = state.currentChapterIndex <= 0;
        if (isLast) {
            nextBtn.style.display = 'none';
            exitBtn.style.display = 'inline-block';
            exitBtn.disabled = false;
        } else {
            nextBtn.style.display = 'inline-block';
            exitBtn.style.display = 'none';
        }
    }
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
        showToast(direction > 0 ? 'Ini chapter pertama.' : 'Ini chapter terakhir.', true);
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

function exitReader() {
    closeModal('readerModal');
    showToast('Terima kasih telah membaca!');
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