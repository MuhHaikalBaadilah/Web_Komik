// =============================================
// KomikuNow - Voratoon Client (versi browser)
// Port dari scraper Node.js "voratoon.js" (Claidex / Alfi) ke JavaScript browser:
// tanpa import / node-fetch, memakai fetch() bawaan browser.
//
// PENTING: voratoon.com tidak mengirim header CORS, jadi browser tidak bisa
// mengambilnya langsung. Isi VORATOON_PROXY di config.js dengan awalan URL proxy
// (mis. Cloudflare Worker milik sendiri) yang menerima ?url=<alamat-target> dan
// mengembalikan HTML-nya + header access-control-allow-origin. Kosong = fitur nonaktif.
//
// Bentuk item disamakan dengan SHINIGAMI.mapItem (title, href, thumbnail, type,
// chapter, rating, genre, status, description, updatedAt) supaya kartu yang sama bisa dipakai.
// =============================================
(function (global) {
    'use strict';

    var BASE = 'https://v1.voratoon.com';
    // Alamat sebenarnya setelah pengalihan (dilaporkan Worker lewat header x-final-url).
    var resolvedBase = '';

    function siteBase() { return resolvedBase || BASE; }

    function proxyBase() {
        var c = global.KOMIKUNOW_CONFIG || {};
        return String(c.VORATOON_PROXY || '').trim();
    }

    function sanitize(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[<>]/g, '').trim();
    }

    // Slug hanya boleh huruf/angka/tanda hubung/garis bawah (mencegah path aneh ke proxy).
    function cleanSlug(slug) {
        var s = String(slug || '').replace(/^https?:\/\/[^/]+\/series\//i, '').replace(/^\/+|\/+$/g, '');
        if (!/^[A-Za-z0-9._-]+$/.test(s)) throw new Error('Slug tidak valid.');
        return s;
    }

    async function fetchHtml(url) {
        var proxy = proxyBase();
        if (!proxy) throw new Error('VORATOON_PROXY belum diisi di config.js');
        var ctrl = new AbortController();
        var timer = setTimeout(function () { ctrl.abort(); }, 15000);
        try {
            var res = await fetch(proxy + encodeURIComponent(url), { signal: ctrl.signal });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            try {
                var fin = new URL(res.headers.get('x-final-url') || '');
                if (fin.protocol === 'https:' && (fin.hostname === 'voratoon.com' || /\.voratoon\.com$/.test(fin.hostname))) resolvedBase = fin.origin;
            } catch (e) { /* header tidak ada: pakai BASE */ }
            return await res.text();
        } finally {
            clearTimeout(timer);
        }
    }

    // Ambil kurung seimbang mulai dari posisi `start` (karakter pembuka `open`).
    function balanced(raw, start, open, close) {
        var depth = 0;
        for (var i = start; i < raw.length; i++) {
            var ch = raw[i];
            if (ch === open) depth++;
            else if (ch === close) {
                depth--;
                if (depth === 0) return raw.slice(start, i + 1);
            }
        }
        return null;
    }

    // Ekstrak payload RSC Next.js (self.__next_f.push) -> objek detail ATAU array daftar.
    function parseRSC(html) {
        var re = /self\.__next_f\.push\(/g, m, starts = [];
        while ((m = re.exec(html)) !== null) starts.push(m.index);

        var inner = '';
        for (var j = 0; j < starts.length; j++) {
            var end = j + 1 < starts.length ? starts[j + 1] : html.length;
            var chunk = html.slice(starts[j], end);
            if (chunk.indexOf('initialData') !== -1) {
                var s = chunk.indexOf('[1,"');
                var e = chunk.lastIndexOf('"]');
                if (s !== -1 && e !== -1) inner = chunk.slice(s + 4, e);
                break;
            }
        }
        if (!inner) return [];

        var raw = inner
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '')
            .replace(/[\x00-\x1f]/g, '');

        // initialData berbentuk objek (halaman detail seri)
        var objIdx = raw.indexOf('"initialData":{');
        if (objIdx !== -1) {
            var objText = balanced(raw, objIdx + '"initialData":'.length, '{', '}');
            if (objText) {
                try {
                    var obj = JSON.parse(objText);
                    var first = obj.series && obj.series[0];
                    if (first) {
                        var chapters = (obj.chapters || []).map(function (ch) {
                            return { chapterIndex: (ch.data && ch.data.index) || ch.chapterIndex, id: ch.id, data: ch.data };
                        });
                        return [{ id: first.id, data: first.data, chapters: chapters, updatedAt: first.updatedAt }];
                    }
                } catch (err) { /* lanjut coba bentuk array */ }
            }
        }

        // initialData berbentuk array (halaman updates / search)
        var arrIdx = raw.indexOf('"initialData":[');
        if (arrIdx === -1) return [];
        var arrText = balanced(raw, arrIdx + '"initialData":'.length, '[', ']');
        if (!arrText) return [];
        try { return JSON.parse(arrText); } catch (err) { return []; }
    }

    function chapterIndex(ch) {
        return ch.chapterIndex || (ch.data && ch.data.index) || '';
    }

    function mapItem(item) {
        var d = item.data || {};
        var chapters = item.chapters || [];
        var latest = chapters[0];
        var latestIdx = latest ? chapterIndex(latest) : '';
        var slug = d.slug || '';
        var genres = (d.genres || []).map(function (g) { return (g.data && g.data.name) || g.name; })
            .filter(Boolean).join(', ');
        var fmt = String(d.format || 'manga').toLowerCase();
        return {
            source: 'voratoon',
            title: sanitize(d.title || 'Untitled'),
            href: slug ? '/series/' + slug : '',
            thumbnail: d.coverImage || d.backgroundImage || '',
            coverThumb: d.coverImage || '',
            type: fmt === 'manhwa' ? 'Manhwa' : fmt === 'manhua' ? 'Manhua' : 'Manga',
            chapter: latestIdx ? 'Chapter ' + latestIdx : '',
            rating: parseFloat(d.rating) || 0,
            genre: genres || 'General',
            year: '',
            status: String(d.status || 'ongoing').toLowerCase() === 'completed' ? 'Completed' : 'Ongoing',
            author: sanitize(d.author || ''),
            released: '',
            description: sanitize(d.synopsis ? String(d.synopsis).replace(/\r\n/g, '\n') : ''),
            updatedAt: item.updatedAt || '',
            // Hanya ada di detail:
            chapters: chapters.map(function (ch) {
                var idx = chapterIndex(ch);
                return { index: idx, id: ch.id, title: 'Chapter ' + idx, url: siteBase() + '/series/' + encodeURIComponent(slug) + '/chapter/' + encodeURIComponent(idx) };
            }),
            nativeTitle: sanitize(d.nativeTitle || '')
        };
    }

    var Voratoon = {
        enabled: function () { return !!proxyBase(); },

        // opts: { page: 1 } | { pages: [1,2] } | { all: true } (maks 10 halaman)
        async updates(opts) {
            opts = opts || {};
            var pages = opts.all ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : (opts.pages || [opts.page || 1]);
            var all = [];
            for (var i = 0; i < pages.length; i++) {
                var p = pages[i];
                var items = parseRSC(await fetchHtml(p === 1 ? BASE + '/updates' : BASE + '/updates?page=' + encodeURIComponent(p)));
                if (!items.length) break;
                all = all.concat(items);
                if (pages.length > 1) await new Promise(function (r) { setTimeout(r, 300); });
            }
            var seen = {};
            return all.filter(function (it) {
                var slug = it.data && it.data.slug;
                if (!slug || seen[slug]) return false;
                seen[slug] = true;
                return true;
            }).map(mapItem);
        },

        async detail(slug) {
            var s = cleanSlug(slug);
            var items = parseRSC(await fetchHtml(BASE + '/series/' + s));
            if (!items.length) throw new Error('Manga "' + s + '" tidak ditemukan.');
            return mapItem(items[0]);
        },

        // Terbuka untuk pengujian.
        _parseRSC: parseRSC
    };

    global.VORATOON = Voratoon;
})(typeof window !== 'undefined' ? window : globalThis);
