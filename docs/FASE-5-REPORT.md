# Laporan Teknis: FASE 5 — Penyimpanan File, Modul Cetak Senyap & Layar Selesai

Dokumen ini mendokumentasikan implementasi teknis untuk **Fase 5: Penyimpanan File, Modul Cetak Senyap & Layar Selesai** pada aplikasi Teras Photobooth sesuai dengan spesifikasi PRD (F-12, F-17, F-18, F-19, F-20) dan panduan desain RawBlock ([`docs/DESIGN.md`](./DESIGN.md)).

---

## 1. Ringkasan Fitur & Keputusan Arsitektur

### 1.1 Penyimpanan File Sebelum Cetak (*Save-Before-Print*)
Sesuai kebutuhan non-fungsional PRD Bagian 7:
> *"Foto wajib tersimpan ke disk sebelum instruksi cetak dikirimkan untuk mencegah kehilangan data jika printer macet atau kertas habis."*

Alur penyimpanan foto:
1. Customer mengonfirmasi foto di layar Review (`src/kiosk/screens/review.js`).
2. Kiosk mengirim payload base64 foto komposit final dan foto mentah ke endpoint backend `POST /api/sessions/:id/save-photos`.
3. Server menulis file fisik ke direktori `OUTPUT_FOLDER` (`./data/photos` atau folder yang disinkronkan Google Drive for desktop).
4. Server mencatat record ke tabel `photos` di database SQLite.
5. Server mengembalikan metadata nomor sesi resmi (`sessionNo`, misal `#0001`).
6. Kiosk baru melanjutkan ke modul pencetakan (`initPrintingScreen`).

---

## 2. Struktur Modul & Detail Implementasi

### 2.1 Generator Nama File (`src/shared/filename.js`)
- **Pola Penamaan PRD F-17:**
  - Foto Komposit: `YYYYMMDD-HHMMSS-<session-no>.jpg` (contoh: `20261012-143022-0042.jpg`)
  - Foto Mentah (opsional): `YYYYMMDD-HHMMSS-<session-no>-raw-<index>.jpg`
- **Fungsi Utama:**
  - `formatSessionNumber(sessionNo)`: Memformat ID urutan sesi menjadi string 4 digit dengan *zero-padding* (`0001`, `0042`).
  - `formatTimestampWib(date)`: Menghasilkan string timestamp lokal WIB `YYYYMMDD-HHMMSS`.
  - `generatePhotoFilename({ date, sessionNo, type, rawIndex })`: Pure function pembuat nama file.
  - `parsePhotoFilename(filename)`: Parser nama file kembali ke komponen tanggal, waktu, nomor sesi, dan jenis foto.

### 2.2 Rute Backend Penyimpanan Foto (`server/routes/photos.js`)
- **Endpoint:**
  - `POST /api/sessions/:id/save-photos`:
    - Membaca folder output dari tabel `settings` (`output_folder`).
    - Mengonversi dataURL base64 ke binary buffer dan menulis ke disk dengan `fs.writeFileSync`.
    - Mencatat record komposit dengan `urutan = 0` dan foto mentah dengan `urutan = 1..N` ke tabel `photos`.
  - `GET /api/sessions/:id/photos`:
    - Mengambil daftar foto tersimpan untuk sesi tertentu (digunakan oleh panel admin riwayat & cetak ulang).
- **Static Hosting Foto:**
  - Di `server/index.js`, direktori output diekspos melalui `app.use('/photos', express.static(...))` agar file dapat diakses langsung oleh browser atau printer.

### 2.3 Modul Pencetakan 4R & Salinan (`src/kiosk/screens/printing.js`)
- **CSS Layout Cetak (`src/styles.css`):**
  - Menggunakan CSS `@media print` dengan ukuran baku `@page { size: 4in 6in; margin: 0; }`.
  - Menyembunyikan seluruh UI kiosk saat mencetak (`body > * { display: none !important; }`).
  - Merender `#photobooth-print-container` dengan N `.print-page` yang memiliki `page-break-after: always`.
- **Eksekusi Silent Print:**
  - Di Electron: memanggil API native `window.photobooth.printSilent({ copies })` melalui IPC tanpa menampilkan dialog printer.
  - Di Browser/Web: fallback otomatis menggunakan `window.print()`.
- **UI Kiosk RawBlock Brutalism:**
  - Header: `STATUS PERANGKAT: MENCETAK`.
  - Judul: `SEDANG MENCETAK HASIL FOTOMU!`.
  - Indikator: `UKURAN 4R (300 DPI) • JUMLAH SALINAN: N LEMBAR`.
  - Progress bar brutalist hitam-putih animasi pulsa.

### 2.4 Layar Selesai (`src/kiosk/screens/done.js`)
- **Fitur PRD F-19 & F-20:**
  - Menampilkan nomor sesi customer (`#0042`) agar customer mudah mencari file di Google Drive.
  - Instruksi pemindaian QR code yang tercetak di kertas foto untuk mengunduh soft file digital.
  - Hitung mundur otomatis 10 detik (`TIMEOUTS.DONE_SCREEN_SECONDS`) sebelum otomatis reset ke Welcome screen.
  - Tombol manual `SELESAI SEKARANG` jika customer ingin segera menyelesaikan sesi.

---

## 3. Unit Testing & Verifikasi

Seluruh pengujian otomatis dijalankan menggunakan **Vitest**:
- `tests/filename.test.js`: Menguji *padding* nomor sesi, format timestamp WIB, pembuatan nama file komposit/raw, dan parsing nama file.
- `tests/save-photos.test.js`: Menguji integrasi HTTP `POST /api/sessions/:id/save-photos`, penulisan file biner ke disk, dan pencatatan record ke database SQLite.
- **Hasil:**
  - **30/30 tests passed** (100% lulus pada 6 test suites).
  - Build produksi `vite build` berhasil mengompilasi seluruh modul (21 modules) tanpa peringatan.
