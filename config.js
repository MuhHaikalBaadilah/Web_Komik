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

    var STORAGE_KEY = 'komiku_api_v3';

    // Hapus SEMUA simpanan URL API versi lama supaya tidak ada URL basi yang dipakai.
    // (Fitur "ingat override ?api=" dihapus sengaja: URL API preview bisa berubah,
    //  nilai basi yang tersimpan justru bikin komik tidak muncul.)
    try {
        var obsolete = ['komikunow_api_base', 'komikunow_api_base_v2', STORAGE_KEY];
        for (var i = 0; i < obsolete.length; i++) localStorage.removeItem(obsolete[i]);
    } catch (e) { /* ignore */ }

    var params = new URLSearchParams(window.location.search);
    var override = params.get('api');

    var isLocal = ['localhost', '127.0.0.1', ''].indexOf(window.location.hostname) !== -1;
    var fallback = isLocal
        ? 'http://localhost:3000'
        : (PRODUCTION_API_BASE || window.location.origin);

    // Prioritas: default produksi DULU, override hanya bila eksplisit di URL.
    var apiBase = ((override || fallback) + '').replace(/\/+$/, '');

    if (!isLocal && !PRODUCTION_API_BASE && !override) {
        try {
            console.warn(
                '[KomikuNow] PRODUCTION_API_BASE belum diisi di config.js. ' +
                'Menggunakan same-origin (' + apiBase + ').'
            );
        } catch (e) { /* ignore */ }
    }

    window.KOMIKUNOW_CONFIG = {
        API_BASE: apiBase,
        DEFAULT_API_BASE: (fallback + '').replace(/\/+$/, ''),
        // Provider default: mangadex (API resmi, bisa diakses dari cloud/datacenter).
        // Provider 'shinigami' sering diblokir Cloudflare saat API di-host di cloud.
        DEFAULT_PROVIDER: 'mangadex'
    };
    try { console.info('[KomikuNow] API_BASE =', apiBase); } catch (e) { /* ignore */ }
})();
