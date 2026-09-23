# DESIGN.md — Komik Reader Website
### (Referensi gaya: Shinigami ID — dark theme, fokus manga/manhwa/manhua)

> **Catatan legal:** Desain ini murni membahas UI/UX, struktur data, dan arsitektur teknis untuk platform baca komik. Konten yang ditayangkan harus berupa karya milik sendiri, open-license, atau yang sudah memiliki izin resmi dari penerbit/author. Jangan menghosting scan komik berhak cipta tanpa lisensi.

---

## 1. Ringkasan Produk

**Nama kerja:** KomikuNow (ganti sesuai brand kamu)
**Tipe:** Web app (PWA) untuk membaca Manga, Manhwa, Manhua
**Target user:** Pembaca komik casual & heavy reader, mobile-first (Android/iOS browser)
**Value proposition:**
- Ribuan judul terorganisir rapi per genre/negara asal
- Reading experience cepat, minim gangguan (ads seminimal mungkin)
- Bisa dipasang sebagai PWA ("Add to Home Screen")
- Bookmark, riwayat baca, notifikasi chapter baru

---

## 2. Prinsip Desain

| Prinsip | Penjelasan |
|---|---|
| **Dark-first** | Default dark mode (nyaman baca lama), light mode opsional |
| **Content-first** | Cover & thumbnail besar, minim chrome/UI yang mengganggu |
| **Fast scan** | User bisa temukan komik baru dalam <10 detik dari homepage |
| **Continue reading** | Selalu tampilkan "lanjutkan baca" di posisi mencolok |
| **Low friction reader** | Reader page tanpa distraksi, swipe/scroll natural |

---

## 3. Palet Warna & Tipografi

```
--bg-primary:      #0F0F14   (hampir hitam, sedikit kebiruan)
--bg-secondary:    #1A1A22   (card / panel)
--bg-elevated:     #24242E   (modal, dropdown)
--accent-primary:  #6C5CE7   (ungu — CTA, highlight, badge "New")
--accent-secondary:#FF4757   (merah — badge "Hot", rating, notifikasi)
--text-primary:    #F5F5F7
--text-secondary:  #9A9AA8
--border:          #2E2E38
--success:         #2ED573   (badge "Completed")
--warning:         #FFA502   (badge "Ongoing")

Font heading:  "Poppins" / "Plus Jakarta Sans" (bold, 600-700)
Font body:     "Inter" / "Noto Sans" (400-500)
Font size base: 14-15px (mobile), 16px (desktop)
```

---

## 4. Struktur Navigasi (Sitemap)

```
/                       → Homepage
/genre                  → Daftar semua genre
/genre/[slug]           → List komik per genre
/search?q=              → Hasil pencarian
/komik/[slug]           → Detail komik (info + daftar chapter)
/komik/[slug]/[chapter] → Reader page
/bookmark               → Komik favorit user (butuh login)
/riwayat                → Riwayat baca terakhir
/latest                 → Update chapter terbaru (semua judul)
/login /register        → Auth
/profil                 → Setting akun & preferensi baca
```

---

## 5. Layout Halaman Utama

### 5.1 Homepage

```
┌─────────────────────────────────────────────┐
│ [Logo]   Search Bar        [Genre▾][Login]   │ ← Sticky Navbar
├─────────────────────────────────────────────┤
│  🎬 HERO CAROUSEL (3-5 komik unggulan)        │
│  Cover besar + judul + genre + tombol "Baca"  │
├─────────────────────────────────────────────┤
│  🔥 Update Terbaru               [Lihat semua]│
│  [Card][Card][Card][Card][Card][Card]         │  ← grid scroll horizontal (mobile)
├─────────────────────────────────────────────┤
│  📈 Populer Minggu Ini            [Lihat semua]│
│  [Card][Card][Card][Card][Card][Card]         │
├─────────────────────────────────────────────┤
│  🆕 Project Baru                  [Lihat semua]│
│  [Card][Card][Card][Card][Card][Card]         │
├─────────────────────────────────────────────┤
│  Genre pills: Action  Romance  Comedy  Isekai │
│               Fantasy  Drama  Horror  ...     │
├─────────────────────────────────────────────┤
│  Footer: Tentang | DMCA | Kontak | Discord    │
└─────────────────────────────────────────────┘
```

**Komponen Card Komik (thumbnail):**
```
┌───────────────┐
│               │
│   COVER IMG   │  ← rasio 2:3, rounded-lg, lazy-load, blur placeholder
│         [🔥Hot]│  ← badge sudut kanan-atas (Hot/New/Ongoing/Completed)
├───────────────┤
│ Judul Komik   │  ← 2 baris max, ellipsis
│ Ch. 142 · 2j  │  ← chapter terbaru + waktu update
│ ⭐ 8.7  Manhwa│  ← rating + tipe (badge kecil)
└───────────────┘
```

### 5.2 Halaman Detail Komik

```
┌─────────────────────────────────────────────┐
│ [Cover besar]   Judul Komik                  │
│                 Alt title (bahasa asing)     │
│                 ⭐4.8  👁2.3M  📌45K           │
│                 [Ongoing] Manhwa · Action     │
│                 [▶ Baca dari Ch.1] [+Bookmark]│
├─────────────────────────────────────────────┤
│ Sinopsis (expand/collapse "Baca selengkapnya")│
├─────────────────────────────────────────────┤
│ Genre: [Action][Fantasy][Isekai][Comedy]      │
│ Author: xxx   |  Status: Ongoing              │
├─────────────────────────────────────────────┤
│ Tab: [Daftar Chapter] [Komentar] [Rekomendasi]│
│ ┌───────────────────────────────────────┐    │
│ │ Chapter 142        Baru saja      [🔒]│    │ ← list scrollable
│ │ Chapter 141        2 hari lalu         │    │   sort: terbaru/terlama
│ │ Chapter 140        4 hari lalu         │    │
│ └───────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### 5.3 Reader Page (paling krusial)

```
┌─────────────────────────────────────────────┐
│ [←] Judul Komik – Ch.142        [☰][⚙]       │ ← auto-hide on scroll
├─────────────────────────────────────────────┤
│                                               │
│           [Gambar halaman komik]             │  ← full width, lazy load
│           (vertical scroll style,            │     next page prefetch
│            khas manhwa/webtoon)              │
│                                               │
├─────────────────────────────────────────────┤
│ [◀ Ch.141]   Ch.142   [Ch.143 ▶]             │ ← sticky bottom nav
└─────────────────────────────────────────────┘

Setting panel (⚙):
- Reading mode: Vertical scroll / Horizontal page / Webtoon
- Image quality: Data saver / HD
- Brightness overlay
- Auto scroll speed (opsional)
```

**Reader UX rules:**
- Preload 2-3 gambar ke depan agar scroll mulus
- Simpan posisi scroll terakhir → resume otomatis (progress bar tipis di top)
- Swipe kiri/kanan untuk ganti chapter (mode horizontal)
- Double-tap untuk zoom
- Auto-mark chapter "sudah dibaca" setelah user scroll >80%

---

## 6. Fitur Utama

| Fitur | Prioritas | Detail |
|---|---|---|
| Autentikasi (email/Google) | High | untuk bookmark & sync riwayat |
| Bookmark / Favorit | High | list komik yang diikuti |
| Riwayat baca | High | resume dari chapter/halaman terakhir |
| Notifikasi chapter baru | Medium | push notif / badge di navbar |
| Search + filter | High | filter genre, status, tipe (manga/manhwa/manhua), sort |
| Rating & komentar | Medium | per komik dan per chapter |
| Mode baca offline (PWA cache) | Medium | download chapter untuk offline |
| Dark/Light mode toggle | Low | default dark |
| Rekomendasi personalisasi | Low | berdasarkan genre yang sering dibaca |
| Multi-bahasa (ID/EN) | Low | i18n |

---

## 7. Struktur Data (skema dasar)

```
Comic {
  id, slug, title, alt_titles[],
  cover_url, synopsis,
  type: manga | manhwa | manhua,
  status: ongoing | completed | hiatus,
  genres: [genre_id],
  rating_avg, view_count, bookmark_count,
  created_at, updated_at
}

Chapter {
  id, comic_id, chapter_number, title,
  pages: [image_url],
  released_at, view_count
}

User {
  id, email, username, avatar,
  reading_history: [{comic_id, chapter_id, page, updated_at}],
  bookmarks: [comic_id]
}

Genre {
  id, name, slug
}
```

---

## 8. Tumpukan Teknologi (saran)

| Layer | Rekomendasi |
|---|---|
| Frontend | Next.js (React) + Tailwind CSS — SSR untuk SEO judul komik |
| State/data fetching | React Query / SWR |
| Backend | Node.js (NestJS/Express) atau Laravel |
| Database | PostgreSQL (relasi comic-chapter-genre) |
| Image storage/CDN | Cloudflare R2 / S3 + Cloudflare CDN (image resize on-the-fly) |
| Auth | NextAuth / Firebase Auth |
| Search | Meilisearch / Algolia (search cepat judul & genre) |
| PWA | next-pwa / Workbox (offline caching chapter) |
| Analytics | Plausible / GA4 |

---

## 9. Responsive Breakpoints

```
Mobile:  < 640px   → grid 2-3 kolom, navbar hamburger
Tablet:  640-1024  → grid 4 kolom
Desktop: > 1024px  → grid 5-6 kolom, sidebar filter genre di samping
```

---

## 10. SEO & Performance

- Setiap halaman komik & chapter punya meta title/description unik
- Structured data (schema.org `Book`/`Comic`) untuk rich snippet
- Lazy-load semua cover image, format WebP/AVIF
- Skeleton loading di grid saat fetch data
- Core Web Vitals: LCP < 2.5s (prioritaskan hero image), CLS minim (reserve aspect-ratio gambar)

---

## 11. Roadmap Bertahap

1. **MVP:** Homepage, detail komik, reader page, auth dasar
2. **v1.1:** Bookmark, riwayat baca, search + filter genre
3. **v1.2:** Komentar, rating, notifikasi chapter baru
4. **v1.3:** PWA offline mode, rekomendasi personalisasi
5. **v2.0:** Multi-bahasa, dashboard admin/uploader untuk manajemen konten

---

*Dokumen ini adalah blueprint desain & fitur. Untuk implementasi, pastikan seluruh konten komik yang ditayangkan memiliki hak edar/lisensi yang sah.*
