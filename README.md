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
├── api-manga/          # API server (clone dari KanekiCraynet/api-manga)
│   └── src/
│       └── server.js   # Main API server (port 3000)
├── index.html          # Halaman utama aplikasi
├── style.css           # Styling aplikasi
├── app.js              # Logika aplikasi & API integration
└── README.md           # Dokumentasi ini
```

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