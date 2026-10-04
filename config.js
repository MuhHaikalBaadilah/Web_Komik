// =============================================
// KomikuNow - Runtime Configuration
// Menentukan URL API secara otomatis:
//   - Local (localhost / 127.0.0.1) -> http://localhost:3000
//   - Production (di-host online)   -> PRODUCTION_API_BASE di bawah
//
// Bisa dioverride lewat query string:  ?api=https://xxx.vercel.app
// Nilai override akan disimpan di localStorage browser.
// =============================================
(function () {
    'use strict';

    // -----------------------------------------------------------------
    //  URL API produksi (hasil deploy).
    //  Kosongkan ('') bila frontend & API berada di domain yang sama.
    //
    //  ⚠️ Deployment saat ini memakai openpouch (preview gratis 72 jam).
    //     Setiap kali API di-redeploy, URL-nya berubah -> perbarui nilai ini.
    // -----------------------------------------------------------------
    var PRODUCTION_API_BASE = 'https://komikcast-scrapping-hx1kc0.openpouch.sh';

    var STORAGE_KEY = 'komikunow_api_base';
    var params = new URLSearchParams(window.location.search);
    var override = params.get('api');

    // Simpan override bila dikirim lewat query string (?api=...)
    if (override) {
        try { localStorage.setItem(STORAGE_KEY, override.replace(/\/+$/, '')); } catch (e) { /* ignore */ }
    }

    var stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { /* ignore */ }

    var isLocal = ['localhost', '127.0.0.1', ''].indexOf(window.location.hostname) !== -1;
    var fallback = isLocal
        ? 'http://localhost:3000'
        : (PRODUCTION_API_BASE || window.location.origin);

    var apiBase = (override || stored || fallback).replace(/\/+$/, '');

    if (!isLocal && !PRODUCTION_API_BASE && !override && !stored) {
        console.warn(
            '[KomikuNow] PRODUCTION_API_BASE belum diisi di config.js. ' +
            'Menggunakan same-origin (' + apiBase + '). ' +
            'Setel URL API agar aplikasi berfungsi, atau buka dengan ?api=https://url-api-kamu'
        );
    }

    window.KOMIKUNOW_CONFIG = {
        API_BASE: apiBase,
        // Provider default: mangadex (API resmi, bisa diakses dari cloud/datacenter).
        // Provider 'shinigami' sering diblokir Cloudflare saat API di-host di cloud.
        DEFAULT_PROVIDER: 'mangadex'
    };
})();
