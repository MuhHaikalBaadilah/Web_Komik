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
    //  ⚠️  GANTI nilai di bawah dengan URL hasil deploy API kamu.
    //      Contoh: 'https://komikunow-api.vercel.app'
    //      Kosongkan ('') bila frontend & API berada di domain yang sama.
    // -----------------------------------------------------------------
    var PRODUCTION_API_BASE = '';

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
        DEFAULT_PROVIDER: 'shinigami'
    };
})();
