# MangaVerse - Manga Scraper Web App 📖

Aplikasi web scraping manga berbasis JavaScript yang menggunakan API dari **[KanekiCraynet/api-manga](https://github.com/KanekiCraynet/api-manga)**.

## ✨ Fitur

- 🔍 **Pencarian manga** - Cari manga, manhwa, manhua berdasarkan kata kunci
- 🔥 **Komik Terbaru** - Lihat komik terbaru dengan pagination (42+ halaman)
- ⭐ **Komik Populer** - Daftar komik paling populer
- 👍 **Komik Rekomendasi** - Rekomendasi komik terbaik
- 📖 **Baca Chapter** - Baca manga langsung di browser dengan gambar full
- 🔄 **Navigasi Chapter** - Pindah antar chapter dengan mudah
- 🏷️ **Detail Lengkap** - Rating, status, genre, author, deskripsi, dan daftar chapter
- 🎨 **UI Modern** - Dark theme dengan animasi halus
- 📱 **Responsive** - Support desktop & mobile

## 📋 Prasyarat

- Node.js (v22+ disarankan)
- Python 3 (untuk static server)
- Koneksi internet (untuk scraping dari sumber manga)

## 🚀 Cara Menjalankan

### 1. Install dependencies API

```bash
npm --prefix c:\SCRAPER\api-manga install
```

### 2. Start API server

Buka terminal pertama:

```bash
node c:\SCRAPER\api-manga\src\server.js
```

Server berjalan di `http://localhost:3000`

### 3. Start static server untuk aplikasi

Buka terminal kedua:

```bash
cd c:\SCRAPER
python -m http.server 8080
```

### 4. Buka aplikasi

Buka browser dan akses:

```
http://localhost:8080
```

## 🗂️ Struktur Project

```
SCRAPER/
├── api-manga/                    # API server (fork dari KanekiCraynet/api-manga)
│   ├── src/server.js             # Main API server (port 3000)
│   └── vercel.json               # Konfigurasi deploy Vercel
├── .github/workflows/
│   └── deploy-frontend-pages.yml # Auto-deploy frontend ke GitHub Pages
├── index.html                    # Halaman utama aplikasi
├── style.css                     # Styling aplikasi
├── app.js                        # Logika aplikasi & API integration
├── config.js                     # Runtime config (URL API local/production)
├── render.yaml                   # (Opsional) deploy API ke Render free tier
└── README.md                     # Dokumentasi ini
```

## 🌐 Hosting Gratis (Deploy Online)

> **Status deploy (100% gratis):**
> - ✅ **Frontend LIVE** → <https://muhhaikalbaadilah.github.io/Web_Komik/> (GitHub Pages, otomatis dari branch `gh-pages`)
> - ✅ **API LIVE** → <https://komikcast-scrapping-hx1kc0.openpouch.sh> (openpouch — tanpa akun/CC)
>   - ⚠️ Ini **preview gratis 72 jam** → kedaluwarsa **2026-10-07 12:51 UTC**.
>   - Perpanjang **7 hari** (1 klik) lewat *claim link*, atau pakai akun gratis openpouch agar hidup selama masih dipakai.
>   - Untuk **permanen**, deploy ke Render/Vercel (Langkah 1) lalu isi URL-nya (Langkah 2).
> - ℹ️ Provider default diubah ke **mangadex** karena `shinigami` diblokir Cloudflare saat API berjalan di cloud/datacenter (mangadex = API resmi, jalan mulus dari cloud & punya gambar chapter).

Ada 2 bagian yang perlu di-host: **frontend** (statis) dan **API** (Node.js). Berikut skema gratis yang sudah disiapkan di repo ini:

| Bagian | Platform | Biaya | Kenapa |
|--------|----------|-------|--------|
| Frontend (`index.html`, `style.css`, `app.js`, `config.js`) | **GitHub Pages** | Gratis | Statis, auto-deploy via GitHub Actions (sudah ada workflow-nya) |
| API (`api-manga/`) | **Vercel** (utama) atau **Render** (alternatif) | Gratis | Node/Express, `vercel.json` & `render.yaml` sudah disiapkan |

### Langkah 1 — Deploy API (opsional: untuk hosting permanen)

**Opsi A: Vercel (direkomendasikan, gratis & cepat)**

```bash
npm install -g vercel      # sekali saja
cd api-manga
vercel --prod              # ikuti proses login, root directory = api-manga
```

Catat URL yang muncul, mis. `https://komikunow-api.vercel.app`. Cek:

```bash
curl "https://komikunow-api.vercel.app/health"
```

**Opsi B: Render (gratis, tapi service "tidur" setelah 15 menit idle)**

1. Push repo ini ke GitHub.
2. Buka <https://dashboard.render.com/blueprints> → **New Blueprint Instance**.
3. Pilih repo ini → Render otomatis membaca `render.yaml` dan membuat web service `komikunow-api`.

### Langkah 2 — Setel URL API di frontend

Buka `config.js` dan isi `PRODUCTION_API_BASE` dengan URL API dari Langkah 1:

```js
var PRODUCTION_API_BASE = 'https://komikunow-api.vercel.app';
```

> Tanpa mengubah file pun bisa: buka frontend dengan `?api=https://komikunow-api.vercel.app` (nilainya disimpan di localStorage).

### Langkah 3 — Deploy Frontend ke GitHub Pages (sudah otomatis)

GitHub Pages repo ini sudah **aktif** dengan sumber **branch `gh-pages`**. Setiap kali file frontend (`index.html`, `style.css`, `app.js`, `config.js`) berubah di branch `main`, workflow `.github/workflows/deploy-frontend-pages.yml` otomatis mem-publish ulang isinya ke branch `gh-pages`.

- Situs live: <https://muhhaikalbaadilah.github.io/Web_Komik/>
- Ganti URL API tanpa mengubah/men-deploy ulang kode: buka
  `https://muhhaikalbaadilah.github.io/Web_Komik/?api=https://URL-API-KAMU`
  (nilainya disimpan di localStorage browser).

> Catatan: sumber Pages disetel ke **branch `gh-pages`**, bukan "GitHub Actions", karena pengaturan Pages repo ini tidak bisa diubah via API oleh token yang tersedia. Karena itu workflow memakai `peaceiris/actions-gh-pages` untuk menulis ke branch tersebut.

### Menjalankan lokal

Saat diakses dari `localhost`, `config.js` otomatis memakai `http://localhost:3000`, jadi alur pengembangan lokal seperti biasa (lihat bagian **Cara Menjalankan** di atas).

---

## 🔌 API Endpoints yang Digunakan

| Endpoint | Keterangan |
|----------|------------|
| `/terbaru?page=1&provider=shinigami` | Komik terbaru dengan pagination |
| `/search?keyword=<query>&provider=shinigami` | Pencarian komik |
| `/popular?provider=shinigami` | Komik populer |
| `/recommended?provider=shinigami` | Komik rekomendasi |
| `/detail/:id?provider=shinigami` | Detail komik & daftar chapter |
| `/read/:chapterId?provider=shinigami` | Gambar-gambar chapter |

## 🏭 Provider yang Didukung

| Provider | Method | Catatan |
|----------|--------|---------|
| **Shinigami** | Internal API | Paling stabil, punya gambar chapter |
| **MangaDex** | Official API | Database terbesar, tapi gambar chapter kosong |
| **Komikcast** | HTML Scraping | Perlu akses internet, kadang gagal |
| **Aquareader** | HTML Scraping | Perlu akses internet |

Aplikasi otomatis memilih provider `shinigami` sebagai default karena paling stabil dan menyediakan gambar chapter lengkap.

## 🛠️ Teknologi

- **HTML/CSS/JavaScript** - Frontend murni tanpa framework
- **KanekiCraynet/api-manga** - API provider untuk scraping
- **Express.js** - Backend API server
- **Font Awesome** - Icons
- **Google Fonts** - Typography Inter

## ⚠️ Catatan

1. API server harus **berjalan** di port `3000` agar aplikasi berfungsi
2. Jika provider `shinigami` gagal, aplikasi otomatis fallback ke `mangadex`
3. Untuk provider `mangadex`, beberapa chapter mungkin tidak memiliki gambar karena keterbatasan MangaDex API
4. Koneksi internet diperlukan untuk scraping data dari sumber manga

## 📝 Lisensi

MIT License - Bebas digunakan untuk pembelajaran dan pengembangan.