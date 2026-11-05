# Laporan Hasil Pengerjaan: Fitur Live Photo Video Template, GIF Animasi & Penyimpanan Multi-Varian

Dokumen ini merupakan laporan teknis lengkap hasil pengerjaan fitur **Live Photo Video Template, GIF Animasi Satuan, dan Ekspor Multi-Varian** pada aplikasi **Teras Photobooth** sesuai dengan arahan pengguna dan standar arsitektur [PRD.md](file:///d:/teras-photobooth/docs/PRD.md) serta [GEMINI.md](file:///d:/teras-photobooth/GEMINI.md).

---

## 1. Ringkasan Fitur yang Diimplementasikan

Sesuai kebutuhan software photobooth kekinian (seperti tren photobooth Korea / Life4Cuts), sistem kini menghasilkan **6 kelompok aset digital** lengkap untuk setiap sesi transaksi:

| No | Tipe Aset | Format Berkas | Keterangan & Perilaku Teknis |
|---|---|---|---|
| 1 | **Komposit + Filter** (Siap Cetak) | `YYYYMMDD-HHMMSS-SSSS.jpg` | Foto komposit 4R 300 DPI dengan filter warna terpilih (default cetak). |
| 2 | **Komposit Tanpa Filter** | `YYYYMMDD-HHMMSS-SSSS-original.jpg` | Foto komposit 4R 300 DPI versi warna natural asli. |
| 3 | **Live Photo Video (Template)** | `YYYYMMDD-HHMMSS-SSSS-live.mp4` *(atau .webm)* | Video klip 2–3 detik berbingkai template penuh: seluruh slot foto bergerak hidup secara simultan. |
| 4 | **GIF Animasi Foto Satuan** | `YYYYMMDD-HHMMSS-SSSS-animation.gif` | Animasi stop-motion looping yang merangkai seluruh pose satuan. |
| 5 | **Raw Satuan Tanpa Filter** | `YYYYMMDD-HHMMSS-SSSS-raw-N.jpg` | Foto satuan mentah asli tiap pose ke-N (resolusi penuh). |
| 6 | **Raw Satuan Dengan Filter** | `YYYYMMDD-HHMMSS-SSSS-raw-N-filtered.jpg` | Foto satuan tiap pose ke-N dengan filter warna terpilih. |

Seluruh aset di atas otomatis:
1. Tersimpan secara permanen di penyimpanan lokal (`DATA_DIR/photos`).
2. Dicatat ke database SQLite (`data/photobooth.db`) pada tabel `photos`.
3. Dimasukkan ke antrean upload resilien (`upload_queue`) untuk disinkronisasi ke **Cloudflare R2**.
4. Disajikan di **Web Galeri HP (Vercel)** dengan antarmuka bertema StudioBlank, lengkap dengan pemutar Live Video, kartu GIF animasi, serta tombol switch filter (Dengan Efek vs Warna Asli).

---

## 2. Rincian Teknis & Arsitektur Codebase

### 2.1 Standardisasi Penamaan Berkas (`src/shared/filename.js`)
- Diperluas untuk mengenali dan menghasilkan varian baru:
  - `composite_original` &rarr; `YYYYMMDD-HHMMSS-SSSS-original.jpg`
  - `raw_filtered` &rarr; `YYYYMMDD-HHMMSS-SSSS-raw-N-filtered.jpg`
  - `animation` / `gif` &rarr; `YYYYMMDD-HHMMSS-SSSS-animation.gif`
  - `live` &rarr; `YYYYMMDD-HHMMSS-SSSS-live.mp4` (atau `.webm`)
- Fungsi `parsePhotoFilename()` diperbarui dengan regex pola terpadu sehingga mampu mem-parse semua tipe berkas kembali ke metadata sesi.
- Teruji di `tests/filename.test.js` (7 pengujian lulus).

### 2.2 Modul GIF Animasi (`src/shared/gif.js`)
- Menggunakan library `gifenc` murni JavaScript (zero C++/node-gyp rebuild, ukuran ~3KB).
- Menyediakan dua lapisan logika:
  1. `createGifFromRgbaFrames()`: Fungsi murni (pure logic) untuk merangkai array RGBA frame buffer menjadi berkas binary GIF89a. Berjalan baik di Node.js maupun Browser.
  2. `createGifFromImages()`: Fungsi pembuat GIF dari elemen gambar Canvas dengan cover-fit dan durasi per frame dapat diatur (default: 600ms, infinite loop).
- Teruji di `tests/gif.test.js` (2 pengujian lulus).

### 2.3 Modul Live Video Template Composer (`src/shared/video-composer.js`)
- Menggunakan Canvas offscreen berdimensi proporsional template (default: 800×1200 px untuk streaming lancar dan ukuran file efisien).
- Memutar rekaman video dari tiap slot foto secara simultan.
- Pada setiap siklus animasi:
  1. Menggambar video tiap slot ke dalam koordinat bounding box slot (`slot.x, slot.y, slot.w, slot.h`) dengan kalkulasi cover-fit tanpa distorsi aspek rasio.
  2. Menerapkan filter efek terpilih menggunakan `ctx.filter`.
  3. Menempelkan gambar template PNG transparan di atas seluruh slot video.
- Merekam canvas stream (`canvas.captureStream(30)`) menggunakan browser `MediaRecorder` ke format video modern (`video/mp4` dengan codec AVC1, atau fallback `video/webm`).
- Teruji di `tests/video-composer.test.js` (2 pengujian lulus).

### 2.4 Integrasi Layar Capture Kiosk (`src/kiosk/screens/capture.js`)
- Saat countdown hitungan mundur (3, 2, 1) berjalan, `MediaRecorder` otomatis merekam stream kamera aktif (`cameraService.getStream()`).
- Saat hitungan mencapai 0 dan shutter flash menyala, rekaman dihentikan tepat di durasi ~2.5–3 detik.
- **Dukungan Retake Penuh (PRD F-10):** Jika customer memilih tombol **Ulangi (Retake)**, video klip slot tersebut dibuang dan direkam ulang pada pengambilan berikutnya. Jika customer memilih **Lanjut (Continue)**, klip disimpan ke daftar `slotVideoBlobs`.
- Pada tahap `onComplete`, array foto dan video klip slot diserahkan bersamaan ke layar review.

### 2.5 Integrasi Layar Review Kiosk (`src/kiosk/screens/review.js` & `src/kiosk/main.js`)
- Ketika customer memilih salah satu dari 7 preset efek dan menekan tombol **Lanjut & Cetak Foto**:
  1. Merender komposit siap cetak dengan filter terpilih.
  2. Merender komposit original tanpa filter (warna natural).
  3. Mengaplikasikan filter terpilih pada seluruh foto mentah (raw shots).
  4. Merangkai foto-foto satuan menjadi animasi GIF looping.
  5. Menjalankan komposer Live Video Template dari klip-klip slot.
  6. Mengirimkan bundel 6 aset ke server melalui endpoint `POST /api/sessions/:id/save-photos`.

### 2.6 Backend Server & Database SQLite (`server/db.js` & `server/routes/photos.js`)
- **Migrasi Skema SQLite:** Menambahkan kolom `tipe TEXT DEFAULT 'photo'` pada tabel `photos` tanpa merusak data sesi lama.
- **Penyimpanan Berkas Multi-Varian:** Endpoint `save-photos` memproses seluruh varian berkas (komposit, komposit original, raw original, raw filtered, GIF, dan live video), menuliskannya ke folder event aktif atau `DATA_DIR/photos`, mencatat ke tabel `photos`, dan mendaftarkan semuanya ke antrean upload R2 (`upload_queue`).
- Teruji di `tests/save-photos.test.js` (seluruh berkas terverifikasi ada di disk dan tercatat di SQLite).

### 2.7 Sinkronisasi Cloudflare R2 (`server/storage/r2.js` & `server/routes/gallery.js`)
- Mendukung MIME types baru: `image/gif`, `video/mp4`, `video/webm`.
- Manifest sesi `meta.json` kini mencakup tautan ke:
  - `composite` (berfilter)
  - `compositeOriginal` (tanpa filter)
  - `gif` (animasi foto satuan)
  - `live` (video template bergerak)
  - `photos` (daftar foto satuan dengan properti `url` dan `filteredUrl`)
- Endpoint lokal `GET /api/gallery/:token` menyajikan struktur data JSON yang identik untuk pengujian offline di jaringan lokal booth.

### 2.8 Antarmuka Web Galeri Customer (`gallery/index.html`)
Diperbarui dengan tema StudioBlank yang responsif di smartphone:
1. **Header Sesi**: Nomor sesi dan tanggal pembuatan.
2. **Kartu Live Video Template**: Pemutar video HTML5 (`autoplay`, `loop`, `muted`, `playsinline`) yang menampilkan template bergerak hidup, disertai tombol unduh video MP4.
3. **Kartu Hasil Cetak 4R**: Komposit template dengan tombol switch "DENGAN EFEK" vs "WARNA ASLI" + tombol unduh 4R.
4. **Kartu GIF Animasi**: Pemutar GIF bergerak dari pose-pose foto + tombol unduh GIF.
5. **Koleksi Foto Satuan (Raw Shots)**: Grid foto satuan dengan tombol switch "EFEK" vs "ASLI" dan tombol unduh resolusi penuh per foto.

---

## 3. Hasil Pengujian & Verifikasi

### 3.1 Unit Testing (Vitest)
Seluruh 17 berkas test suite (114 unit test) lulus 100%:
- `tests/filename.test.js` &rarr; 7 passed
- `tests/gif.test.js` &rarr; 2 passed
- `tests/video-composer.test.js` &rarr; 2 passed
- `tests/save-photos.test.js` &rarr; 2 passed
- `tests/composite.test.js` &rarr; 10 passed
- `tests/capture-flow.test.js` &rarr; 12 passed
- `tests/camera-device.test.js` &rarr; 11 passed
- `tests/effects.test.js` &rarr; 7 passed
- `tests/r2-gallery.test.js` &rarr; 5 passed
- `tests/payment.test.js` &rarr; 14 passed
- `tests/admin.test.js` &rarr; 14 passed
- `tests/offline-recovery.test.js` &rarr; 4 passed
- `tests/slot-detector.test.js` &rarr; 4 passed
- `tests/session-state.test.js` &rarr; 6 passed
- `tests/instructions-and-idle.test.js` &rarr; 5 passed
- `tests/kiosk-transitions.test.js` &rarr; 4 passed
- `tests/admin-router.test.js` &rarr; 5 passed

### 3.2 Production Build (Vite)
Kompilasi produksi frontend (`npm run build`) berhasil tuntas dalam **254 ms** tanpa ada *error* atau *warning*:
- `dist/src/kiosk/index.html` (1.48 kB)
- `dist/src/admin/index.html` (1.34 kB)
- `dist/assets/kiosk-BgMeVNxE.js` (100.79 kB)
- `dist/assets/admin-DCjU9nWE.js` (73.18 kB)
- `dist/assets/styles-C-nJ_TP8.css` (50.92 kB)

---

## 4. Cara Pengujian Manual di Perangkat

1. **Jalankan Aplikasi:**
   ```bash
   npm run dev:web
   # atau untuk mode desktop Electron:
   npm start
   ```
2. **Uji Alur Kiosk Customer:**
   - Buka `http://localhost:5173/src/kiosk/` di browser.
   - Klik **Mulai Sesi** &rarr; selesaikan tata cara &rarr; bayar QRIS.
   - Pilih template &rarr; lakukan pemotretan N foto (perhatikan countdown dan preview).
   - Di layar **Pilih Efek**, pilih preset filter warna (misal: *Hitam Putih* atau *Vintage*).
   - Klik **Lanjut & Cetak Foto**.
3. **Periksa Hasil di Folder Penyimpanan Lokal:**
   - Buka folder `data/photos/` (atau folder event aktif jika dikonfigurasi).
   - Pastikan terdapat 6 kelompok file untuk nomor sesi tersebut:
     - `...jpg` (komposit berfilter)
     - `...-original.jpg` (komposit tanpa filter)
     - `...-raw-1.jpg`, `...-raw-2.jpg`, dst. (raw tanpa filter)
     - `...-raw-1-filtered.jpg`, dst. (raw berfilter)
     - `...-animation.gif` (GIF animasi)
     - `...-live.mp4` (video template bergerak)
4. **Periksa Tampilan Web Galeri:**
   - Buka layar Selesai (Done) atau buka `gallery/index.html?token=<session_token>`.
   - Pastikan Live Video template berputar mulus, GIF bergerak, dan tombol switch "Dengan Efek" / "Warna Asli" berfungsi normal saat diklik maupun saat diunduh.
