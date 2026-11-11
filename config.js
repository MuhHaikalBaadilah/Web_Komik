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
    var PRODUCTION_API_BASE = 'https://komikcast-scrapping-r05irz.openpouch.sh';

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

    // -----------------------------------------------------------------
    //  Proxy resize gambar (WebP + ukuran sesuai tampilan) untuk cover.
    //  Cover asli dari API berukuran besar (beberapa MB total) dan bukan
    //  file milik kita, jadi tidak bisa dikompres di repo. Bila proxy gagal,
    //  gambar otomatis jatuh ke URL asli. Kosongkan ('') untuk mematikan.
    // -----------------------------------------------------------------
    var IMG_PROXY = 'https://wsrv.nl/';

    // -----------------------------------------------------------------
    //  Login Google + sinkron bookmark/riwayat (Firebase). Nilai ini BUKAN
    //  rahasia (identitas proyek web), aman ada di repo publik. Selama kosong,
    //  tombol login disembunyikan. Cara mengisi: lihat README bagian
    //  "Login Google (Firebase)".
    // -----------------------------------------------------------------
    var FIREBASE_CONFIG = {
        apiKey: 'AIzaSyCDi0aZUGBXQRQCZslMInooieDG0YvoJPw',
        authDomain: 'webkomik-844bd.firebaseapp.com',
        projectId: 'webkomik-844bd',
        appId: '1:687938490743:web:c4f38fad07337715709172'
    };

    window.KOMIKUNOW_CONFIG = {
        FIREBASE_CONFIG: FIREBASE_CONFIG,
        IMG_PROXY: IMG_PROXY,
        API_BASE: apiBase,
        DEFAULT_API_BASE: (fallback + '').replace(/\/+$/, ''),
        // Provider default: shinigami (cover lengkap, komik Indonesia).
        // Bisa dioverride lewat query string: ?api=https://xxx.vercel.app
        DEFAULT_PROVIDER: 'shinigami',
        // Provider tambahan yang sudah terdaftar di api-manga
        ADDITIONAL_PROVIDERS: {
          doujindesu: 'DoujinDesu - Hentai manga with Indonesian translation'
        }
    };
    try { console.info('[KomikuNow] API_BASE =', apiBase); } catch (e) { /* ignore */ }
})();
