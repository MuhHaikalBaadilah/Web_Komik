# Proxy Voratoon (Cloudflare Worker)

Browser tidak boleh mengambil data langsung dari voratoon.com (CORS). Worker ini jadi perantaranya.

## Pasang (tanpa terminal, ±3 menit)
1. Buka https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker**.
2. Beri nama (mis. `komikunow-proxy`) → **Deploy**.
3. Klik **Edit code**, hapus isi bawaan, tempel seluruh isi `voratoon-proxy.js`, lalu **Deploy**.
4. Salin alamat Worker, mis. `https://komikunow-proxy.akunmu.workers.dev`.
5. Di `config.js` isi:
   `var VORATOON_PROXY = 'https://komikunow-proxy.akunmu.workers.dev/?url=';`
6. Commit dan push `config.js`.

## Keamanan
- `ALLOWED_HOSTS`: hanya `v1.voratoon.com`.
- `ALLOWED_ORIGINS`: hanya situs GitHub Pages Anda (dan localhost:8000 untuk uji). Ubah di file kalau domain berbeda.
- Paket gratis Cloudflare: 100.000 permintaan/hari; hasil di-cache 5 menit.
