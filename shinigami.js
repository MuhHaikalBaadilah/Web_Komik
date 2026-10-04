// =============================================
// KomikuNow - Shinigami Direct Client
// Memanggil API Shinigami (https://api.shngm.io/v1) LANGSUNG dari browser.
//
// Alasan: server API kita (openpouch) di-host di IP cloud yang kena blokir
//   Cloudflare untuk Shinigami (challenge page -> PARSE_ERROR), sedangkan
//   browser pengguna (IP rumahan) mendapat respons JSON normal + header
//   `access-control-allow-origin: *` dari api.shngm.io, jadi aman dipanggil
//   langsung tanpa perantara server.
//
// Bentuk data yang dikembalikan DISAMAKAN dengan respons API kita
// (/terbaru, /search, /popular, /recommended, /detail/:id, /read/:id)
// supaya app.js cukup menukar pemanggilan fetch-nya saja.
// =============================================
(function (global) {
    'use strict';

    var API_BASE = 'https://api.shngm.io/v1';
    var BASE_URL = 'https://08.shinigami.asia';

    // Samakan dengan sanitizeString() di server (anti-XSS untuk sisipan HTML).
    function sanitize(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[<>]/g, '').trim();
    }

    // Samakan dengan normalizeRating() di server: angka 0-10.
    function normalizeRating(rating) {
        if (!rating) return 0;
        var num = parseFloat(String(rating).trim().replace(/[^\d.]/g, ''));
        if (isNaN(num)) return 0;
        return Math.max(0, Math.min(10, num));
    }

    // Samakan dengan normalizeUrl() di server: relatif terhadap BASE_URL.
    function normalizeUrl(url) {
        if (!url) return '';
        var u = String(url).trim();
        if (u.indexOf(BASE_URL) !== -1) u = u.replace(BASE_URL, '');
        u = u.replace(/^\/+|\/+$/g, '');
        return u ? '/' + u : '';
    }

    function taxName(taxonomy, key) {
        var arr = taxonomy && taxonomy[key];
        return (arr && arr[0] && arr[0].name) || '';
    }

    async function getJSON(path) {
        var ctrl = new AbortController();
        var timer = setTimeout(function () { ctrl.abort(); }, 20000);
        try {
            var res = await fetch(API_BASE + path, {
                signal: ctrl.signal,
                headers: { 'Accept': 'application/json' }
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            var json = await res.json();
            if (json.retcode !== 0) throw new Error('API retcode ' + json.retcode);
            return json;
        } finally {
            clearTimeout(timer);
        }
    }

    // Samakan dengan normalizeComicItem() di server.
    function mapItem(item) {
        return {
            title: sanitize(item.title || ''),
            href: normalizeUrl('/series/' + item.manga_id),
            thumbnail: item.cover_image_url || item.cover_portrait_url || '',
            coverThumb: '',
            type: sanitize(taxName(item.taxonomy, 'Format')),
            chapter: item.latest_chapter_number ? 'Chapter ' + item.latest_chapter_number : '',
            rating: normalizeRating(item.user_rate || item.rank || ''),
            genre: (item.taxonomy && item.taxonomy.Genre ? item.taxonomy.Genre : [])
                .map(function (g) { return g.name; }).join(', '),
            year: item.release_year || '',
            status: item.status === 1 ? 'Ongoing' : 'Completed',
            author: sanitize(taxName(item.taxonomy, 'Author')),
            released: item.release_year || '',
            description: sanitize(item.description || '')
        };
    }

    var Shinigami = {
        // latest() mengembalikan objek paginasi persis seperti GET /terbaru.
        async latest(page) {
            var p = page || 1;
            var json = await getJSON('/manga/list?page=' + p + '&page_size=24&sort=latest&sort_order=desc');
            var meta = json.meta || {};
            var current = meta.page || p;
            var total = meta.total_page || 1;
            return {
                current_page: current,
                length_page: total,
                has_next: current < total,
                has_prev: current > 1,
                data: (json.data || []).map(mapItem)
            };
        },

        async list(query) {
            var json = await getJSON('/manga/list?' + query);
            return (json.data || []).map(mapItem);
        },

        popular: function () {
            return this.list('page=1&page_size=50&sort=rank&sort_order=asc');
        },

        recommended: function () {
            return this.list('page=1&page_size=50&is_recommended=true');
        },

        search: function (keyword) {
            return this.list('page=1&page_size=50&q=' + encodeURIComponent(keyword));
        },

        // detail() mengembalikan objek persis seperti GET /detail/:id (data).
        async detail(mangaId) {
            var id = String(mangaId || '').split('/').pop().replace(/\/$/, '');
            var json = await getJSON('/manga/detail/' + id);
            var item = json.data || {};

            var chapters = [];
            try {
                var cj = await getJSON('/chapter/' + id + '/list?page=1&page_size=100&sort_by=chapter_number&sort_order=desc');
                chapters = (cj.data || []).map(function (ch) {
                    var raw = ch.chapter_title || ('Chapter ' + ch.chapter_number);
                    var title = String(raw).replace(/^Chapter\s*/i, '').trim();
                    var num = parseFloat(ch.chapter_number);
                    return {
                        title: title || String(raw),
                        number: isNaN(num) ? 0 : num,
                        href: normalizeUrl('/chapter/' + ch.chapter_id),
                        date: ch.release_date || ''
                    };
                });
            } catch (e) {
                console.warn('[Shinigami] daftar chapter gagal dimuat:', e && e.message);
            }

            return {
                title: item.title || '',
                rating: normalizeRating(item.user_rate || item.rank || '0'),
                status: item.status === 1 ? 'Ongoing' : 'Completed',
                type: taxName(item.taxonomy, 'Format'),
                released: item.release_year || '',
                author: taxName(item.taxonomy, 'Author'),
                genre: (item.taxonomy && item.taxonomy.Genre ? item.taxonomy.Genre : [])
                    .map(function (g) { return { title: g.name || '', href: '' }; }),
                description: item.description || '',
                thumbnail: item.cover_image_url || item.cover_portrait_url || '',
                chapter: chapters
            };
        },

        // read() mengembalikan {title, panel:[...]} persis seperti GET /read/:id.
        async read(chapterId) {
            var id = String(chapterId || '').split('/').pop().replace(/\/$/, '');
            var json = await getJSON('/chapter/detail/' + id);
            var item = json.data || {};
            var panels = [];
            if (item.chapter && Array.isArray(item.chapter.data)) {
                var base = item.base_url || 'https://delivery.shngm.id';
                var path = item.chapter.path || '';
                panels = item.chapter.data.map(function (f) { return base + path + f; });
            }
            return {
                title: item.chapter_title || ('Chapter ' + (item.chapter_number || '')),
                panel: panels
            };
        }
    };

    global.SHINIGAMI = Shinigami;
})(typeof window !== 'undefined' ? window : globalThis);


