# Rencana Kerja Produksi (PLAN.md) — Teras Photobooth

Dokumen ini adalah instruksi kerja bertahap (*step-by-step master plan*) yang disusun secara presisi untuk developer junior maupun AI coding assistant berikutnya. Setiap tugas dirancang modular, terisolasi, memiliki kriteria verifikasi yang jelas, dan merujuk langsung ke requirement ID di [docs/PRD.md](file:///d:/teras-photobooth/docs/PRD.md) serta standar desain [docs/DESIGN.md](file:///d:/teras-photobooth/docs/DESIGN.md).

> **PANDUAN EKSEKUSI UNTUK AI / DEVELOPER:**
> 1. **Dilarang melompati tahapan.** Kerjakan hanya satu tugas dalam satu waktu.
> 2. **Wajib patuhi gaya desain:** RawBlock Brutalism (tanpa sudut bulat `0px radius`, tanpa bayangan `shadow-none`, border 3px/5px, font `Archivo Black`, `Work Sans`, `Space Mono`).
> 3. **Wajib uji sebelum mencentang:** Jalankan unit test (`npm run test`) dan build (`npm run build`).
> 4. **Beri tanda `[x]`** pada checkbox tugas yang sudah selesai dan terverifikasi.

---

## 📌 Ringkasan Milestone

- [x] **Fase 0: Fondasi & Boilerplate Proyek** *(Selesai)*
- [x] **Fase 1: Modul Kamera, Capture & Komposit Canvas (4R 300 DPI)** *(Selesai)*
- [x] **Fase 2: Manajemen Template & Algoritma Deteksi Slot Otomatis** *(Selesai)*
- [x] **Fase 3: Layar Kiosk Pemilihan Template, Review & Retake Foto** *(Selesai)*
- [ ] **Fase 4: Integrasi Pembayaran QRIS Dinamis (Mayar.id)**
- [ ] **Fase 5: Penyimpanan File Soft File, Modul Cetak Senyap & Layar Selesai**
- [ ] **Fase 6: Panel Admin Lengkap (PIN, Riwayat, Cetak Ulang, Laporan CSV)**
- [ ] **Fase 7: Hardening Offline, Penanganan Error & Packaging Produksi**

---

## 🚀 FASE 1: Modul Kamera, Capture & Komposit Canvas

Fase ini membangun fondasi visual utama: menangkap video kamera eksternal dan menggabungkan foto dengan overlay cetak.

### Task 1.1: Service Kamera & Live Preview (F-08)
- **Tujuan:** Mengakses kamera eksternal (UVC webcam / HDMI capture card) dengan mode mirror dan aspect ratio optimal.
- **File Target:**
  - `src/shared/camera.js` (Modul helper native Web API `navigator.mediaDevices`)
  - `src/kiosk/screens/capture.js` (Layar kiosk penampil live feed kamera)
- **Instruksi Kerja:**
  1. Buat helper `getOptimalCamera()` di `src/shared/camera.js`:
     - Panggil `navigator.mediaDevices.enumerateDevices()` untuk mendeteksi `videoinput`.
     - Prioritaskan kamera eksternal (abaikan built-in jika ada perangkat video kedua).
     - Minta stream dengan resolusi tertinggi (ideal 1080p: `{ width: { ideal: 1920 }, height: { ideal: 1080 } }`).
  2. Di `src/kiosk/screens/capture.js`, buat elemen `<video autoplay playsinline>` dengan transformasi CSS `scaleX(-1)` (mirror feed).
  3. Pastikan fungsi `unmount()` mematikan semua track stream (`track.stop()`) agar lampu kamera mati saat keluar layar.
- **Batasan:** Jangan menambahkan library kamera pihak ketiga. Gunakan Web API standar.
- **Verifikasi:**
  - Buka layar capture di Chrome: video kamera muncul tanpa lag dan terbalik secara mirror.
  - Saat berpindah layar, pastikan stream kamera berhenti.
- [x] **Status:** Selesai (`src/shared/camera.js`, `src/kiosk/screens/capture.js`)

---

### Task 1.2: Hitung Mundur (Countdown 3-2-1) & Visual Flash (F-09)
- **Tujuan:** Memberikan hitung mundur visual 3-2-1 dan efek flash layar sesaat saat shutter mengambil foto.
- **File Target:**
  - `src/kiosk/screens/capture.js`
- **Instruksi Kerja:**
  1. Buat overlay countdown besar di tengah video menggunakan font `Archivo Black` ukuran 120px, warna putih dengan border/kontras hitam.
  2. Implementasikan interval 1 detik (3 -> 2 -> 1 -> Shutter).
  3. Buat efek visual flash: flash putih 100ms menutupi layar menggunakan elemen div putih saat frame foto diambil.
  4. Ambil frame foto dari video menggunakan elemen `<canvas>` off-screen dengan ukuran native video stream dan konversi ke dataURL/Blob JPEG.
- **Verifikasi:**
  - Klik tombol "Ambil Foto", angka 3, 2, 1 berganti tiap detik, diikuti kilatan flash putih dan data gambar tersimpan di memori.
- [x] **Status:** Selesai (`src/kiosk/screens/capture.js`)

---

### Task 1.3: Mesin Komposit Canvas 300 DPI (F-11, F-06)
- **Tujuan:** Menggabungkan N foto pengguna ke dalam lubang slot template dan menimpa overlay PNG template dengan ukuran 1200×1800 px (4R 300 DPI).
- **File Target:**
  - `src/shared/composite.js` (Pure logic komposit gambar)
  - `tests/composite.test.js` (Unit test komposit canvas)
- **Instruksi Kerja:**
  1. Buat fungsi `renderComposite({ templateImage, templateConfig, photoImages })`:
     - Buat canvas ukuran persis 1200×1800 px (`CANVAS_SPECS.WIDTH` & `CANVAS_SPECS.HEIGHT`).
     - Gambar background putih.
     - Iterasi setiap slot pada `templateConfig.slots`:
       - Ambil foto urutan terkait.
       - Hitung skala *cover-fit* (pusat foto terpotong rapi tanpa distorsi aspect ratio).
       - Gambar foto pada koordinat `{ x, y, w, h }` slot.
     - Gambar `templateImage` (PNG transparan) tepat di atas seluruh canvas (`0, 0, 1200, 1800`).
     - Kembalikan canvas atau Blob JPEG kualitas 0.95.
  2. Buat unit test dengan canvas mock untuk memastikan perhitungan koordinat dan *aspect ratio cover-fit* presisi.
- **Verifikasi:**
  - Jalankan `npm run test` -> test komposit lolos.
  - Gambar hasil komposit berukuran tepat 1200×1800 px.
- [x] **Status:** Selesai (`src/shared/composite.js`, `tests/composite.test.js`)

---

## 🚀 FASE 2: Manajemen Template & Algoritma Deteksi Slot Otomatis

Fase ini menangani template cetak photobooth, upload admin, dan pembacaan lubang transparan otomatis.

### Task 2.1: Algoritma Deteksi Lubang Transparan Otomatis (F-07)
- **Tujuan:** Membaca channel alpha (transparansi) dari file PNG template 1200×1800 px untuk mendeteksi koordinat slot foto secara otomatis.
- **File Target:**
  - `src/shared/slot-detector.js`
  - `tests/slot-detector.test.js`
- **Instruksi Kerja:**
  1. Implementasikan algoritma deteksi area transparan:
     - Baca pixel data dari canvas context: `ctx.getImageData(0, 0, 1200, 1800).data`.
     - Cari pixel dengan nilai alpha < 128 (transparan).
     - Gunakan algoritma *Connected Component Labeling* (atau grid flood fill/bounding box traversal) untuk mengelompokkan pixel transparan yang berdekatan.
     - Abaikan area kecil (< 2% dari total kanvas) untuk membuang noise/dekorasi kecil.
     - Hitung *bounding box* `{ x, y, w, h }` untuk setiap lubang yang terdeteksi.
     - Urutkan kotak dari atas ke bawah, lalu dari kiri ke kanan.
  2. Kembalikan array slot: `[{ x, y, w, h }, ...]`.
- **Verifikasi:**
  - Unit test pada template strip 4 lubang mengembalikan tepat 4 slot dengan urutan vertikal yang benar.
- [x] **Status:** Selesai (`src/shared/slot-detector.js`, `tests/slot-detector.test.js`)

---

### Task 2.2: Backend API Upload & Pengelolaan Template (F-05, F-23)
- **Tujuan:** Menyimpan file PNG template ke folder `templates/` dan mencatat metadata JSON ke database SQLite.
- **File Target:**
  - `server/routes/templates.js`
  - `server/db.js`
- **Instruksi Kerja:**
  1. Tambahkan endpoint `POST /api/templates`:
     - Menerima payload: file PNG (base64/multipart), nama template, dan array `slots`.
     - Simpan file ke direktori `templates/<id>.png`.
     - Simpan baris baru ke tabel `templates` (`id`, `nama`, `file_png`, `jumlah_slot`, `aktif`, `slots_json`).
  2. Tambahkan endpoint `PATCH /api/templates/:id` untuk mengubah status aktif/non-aktif (`aktif = 0 | 1`) dan koreksi koordinat slot.
  3. Tambahkan endpoint `DELETE /api/templates/:id` untuk menghapus template yang tidak dipakai.
- **Verifikasi:**
  - Kirim request POST -> file PNG tersimpan di folder `templates/` dan data masuk ke SQLite.
- [x] **Status:** Selesai (`server/routes/templates.js`, `server/db.js`)

---

### Task 2.3: Admin UI: Editor Visual Template & Koreksi Slot (F-07, F-22)
- **Tujuan:** Layar admin untuk mengunggah template, melihat kotak slot bernomor, serta menggeser/mengubah ukuran slot jika deteksi otomatis meleset.
- **File Target:**
  - `src/admin/screens/template-editor.js`
  - `src/admin/main.js`
- **Instruksi Kerja:**
  1. Buat antarmuka upload template dengan tombol RawBlock:
     - Tombol "Unggah Template PNG" (border 3px, font Archivo Black).
     - Tampilkan kanvas preview interaktif dari PNG yang diunggah.
  2. Jalankan `slotDetector` pada gambar yang diunggah. Gambar kotak bernomor (Slot 1, Slot 2, dst.) di atas preview.
  3. Berikan kontrol visual untuk setiap slot:
     - Input angka atau handle drag untuk koordinat X, Y, Lebar (W), Tinggi (H).
     - Tombol tambah slot manual dan hapus slot.
  4. Tombol "Simpan Template" untuk mengirim data ke `POST /api/templates`.
- **Verifikasi:**
  - Unggah PNG template -> kotak bernomor otomatis muncul di area lubang transparan -> simpan -> template muncul di daftar aktif.
- [x] **Status:** Selesai (`src/admin/screens/template-editor.js`, `src/admin/main.js`)

---

## 🚀 FASE 3: Alur Kiosk Pemilihan Template, Pengambilan Foto & Review

Fase ini menghubungkan pemilihan template customer dengan alur foto dan mekanisme retake.

### Task 3.1: Layar Kiosk Pemilihan Template (F-06, F-23)
- **Tujuan:** Menampilkan galeri template yang aktif dan meminta customer memilih salah satu sebelum sesi foto dimulai.
- **File Target:**
  - `src/kiosk/screens/choose-template.js`
  - `src/kiosk/main.js`
- **Instruksi Kerja:**
  1. Buat modul layar `createChooseTemplateScreen({ onSelectTemplate })`.
  2. Fetch daftar template dari `api.getTemplates()`.
  3. Render grid kartu RawBlock (`card-raw` dengan border 3px/5px, inversi saat dipilih):
     - Gambar thumbnail template.
     - Nama template (`font-headline uppercase`).
     - Badge jumlah foto (`chip-raw`: "3 FOTO", "4 FOTO").
  4. Saat dipilih, perbarui status sesi di server menjadi `capturing` dan simpan `template_id` terpilih.
- **Verifikasi:**
  - Hanya template berstatus `aktif = 1` yang tampil.
  - Memilih template mengarahkan kiosk ke layar pengambilan foto dengan jumlah foto yang sesuai.
- [x] **Status:** Selesai (`src/kiosk/screens/choose-template.js`, `src/kiosk/main.js`)

---

### Task 3.2: Alur Siklus Pengambilan Foto Berurutan (F-06, F-09)
- **Tujuan:** Mengambil foto secara berurutan sebanyak jumlah slot template terpilih ("Foto 1 dari 4", "Foto 2 dari 4", dst.).
- **File Target:**
  - `src/kiosk/screens/capture.js`
- **Instruksi Kerja:**
  1. Terima parameter `template` pada modul capture.
  2. Tampilkan indikator status di pojok layar: `FOTO 1 DARI N` (font `Archivo Black`, style brutalist).
  3. Alur per foto:
     - Mulai countdown 3 detik.
     - Shutter flash dan simpan frame foto ke array `capturedPhotos`.
     - Jeda 1.5 detik pratinjau hasil foto yang baru saja diambil.
     - Lanjutkan ke foto berikutnya sampai seluruh slot terpenuhi.
  4. Setelah foto terakhir selesai, transisikan state sesi ke `reviewing`.
- **Verifikasi:**
  - Jika template memiliki 3 slot, sistem otomatis mengambil tepat 3 foto secara berurutan lalu masuk ke layar review.
- [x] **Status:** Selesai (`src/kiosk/screens/capture.js`)

---

### Task 3.3: Layar Review & Mekanisme Retake Maksimal 1x (F-10)
- **Tujuan:** Customer dapat melihat pratinjau hasil komposit foto dan memiliki kesempatan mengulang (retake) maksimal 1x per slot.
- **File Target:**
  - `src/kiosk/screens/review.js`
  - `src/shared/constants.js`
- **Instruksi Kerja:**
  1. Buat modul `createReviewScreen({ template, photos, onConfirm, onRetake })`.
  2. Tampilkan hasil pratinjau komposit di bagian tengah.
  3. Tampilkan baris thumbnail tiap foto di samping/bawah:
     - Setiap foto memiliki tombol "Ulang Foto Ini" (`btn-raw-secondary`).
     - Catat kuota retake per foto (`retakeCount = 0`). Jika sudah 1x retake, nonaktifkan tombol ("Sudah Diulang").
  4. Jika customer memilih retake:
     - Kembali ke layar capture hanya untuk indeks foto tersebut.
     - Ganti foto lama dengan foto baru di array `photos`.
     - Kembali ke layar review.
  5. Tombol "Cetak Foto Sekarang" (`btn-raw-primary` min-h-16) untuk melanjutkan ke proses pencetakan.
- **Verifikasi:**
  - Customer hanya bisa mengulang foto yang sama sebanyak 1 kali. Tombol retake dinonaktifkan setelah kuota habis.
- [x] **Status:** Selesai (`src/kiosk/screens/review.js`, `src/shared/constants.js`)

---

## 🚀 FASE 4: Integrasi Pembayaran QRIS Dinamis (Mayar.id)

Fase ini menangani integrasi gerbang pembayaran, polling server-side, dan verifikasi manual staff.

### Task 4.1: Service Backend Pembayaran Mayar.id (F-01, F-02, F-03)
- **Tujuan:** Menghasilkan QRIS dinamis via API Mayar.id dan melakukan polling status pembayaran di server.
- **File Target:**
  - `server/payment/mayar.js` (Klien API Mayar)
  - `server/routes/payments.js`
- **Instruksi Kerja:**
  1. Implementasikan request pembuatan QRIS dinamis di `server/payment/mayar.js`:
     - Baca `MAYAR_API_KEY` dan `MAYAR_BASE_URL` dari `.env`.
     - Panggil endpoint Mayar untuk membuat invoice/QR dinamis dengan nominal sesuai pengaturan `session_price`.
     - Tangkap QR string / URL gambar QR dari respon gateway.
     - Catat transaksi ke tabel `payments` (`id`, `session_id`, `nominal`, `status = 'pending'`, `qris_string`).
  2. Implementasikan *polling worker* server-side:
     - Jalankan interval polling tiap 2.5 detik (`TIMEOUTS.PAYMENT_POLL_INTERVAL_MS`).
     - Cek status transaksi ke gateway.
     - Jika status berubah menjadi `PAID`:
       - Update status payment ke `paid`.
       - Update status session ke `choosing_template`.
       - Siarkan event SSE `payment_paid` ke client.
       - Hentikan interval polling.
     - Jika mencapai batas 180 detik (3 menit):
       - Update status menjadi `expired`.
       - Siarkan event SSE `payment_expired`.
- **Batasan:** Jangan pernah mengekspos API key Mayar ke frontend. Polling wajib dilakukan oleh server Node.js.
- **Verifikasi:**
  - Uji dengan mock/sandbox Mayar: saat invoice lunas, status DB berubah menjadi `paid` dan SSE mengirim event.
- [ ] **Status:** Belum dikerjakan

---

### Task 4.2: Layar Kiosk Pembayaran QRIS (F-01, F-02)
- **Tujuan:** Menampilkan QRIS dinamis, nominal pembayaran dalam Rupiah, dan hitung mundur kedaluwarsa 3 menit.
- **File Target:**
  - `src/kiosk/screens/payment.js`
  - `src/kiosk/main.js`
- **Instruksi Kerja:**
  1. Buat modul `createPaymentScreen({ sessionId, onPaid, onExpired })`.
  2. Tampilkan:
     - Gambar QR code QRIS di dalam bingkai brutalist `card-raw` tebal 5px.
     - Nominal tagihan: `RP 25.000` (`font-headline text-4xl text-black`).
     - Countdown timer 3 menit (`MM:SS`) menggunakan font `Space Mono`.
  3. Hubungkan ke stream SSE (`/events`):
     - Saat menerima event `payment_paid`: mainkan efek sukses dan transisi ke `choosing_template`.
     - Saat menerima event `payment_expired` atau timer habis: tampilkan pesan "WAKTU PEMBAYARAN HABIS" dan otomatis kembali ke Welcome screen setelah 5 detik.
- **Verifikasi:**
  - Timer menghitung mundur dari 03:00 ke 00:00.
  - Simulasi pembayaran lunas langsung memicu perpindahan layar secara otomatis.
- [ ] **Status:** Belum dikerjakan

---

### Task 4.3: Cadangan Konfirmasi Manual oleh Staff (F-04)
- **Tujuan:** Staff dapat memverifikasi pembayaran secara manual dari panel admin jika ada gangguan koneksi ke payment gateway.
- **File Target:**
  - `src/admin/main.js`
  - `server/routes/payments.js`
- **Instruksi Kerja:**
  1. Di panel admin, tambahkan widget "Sesi Menunggu Pembayaran":
     - Menampilkan ID sesi dan nominal.
     - Tombol "Konfirmasi Pembayaran Manual" (`btn-raw-primary` dengan konfirmasi modal PIN).
  2. Saat diklik, panggil `POST /api/payments/:sessionId/confirm-manual`:
     - Server memvalidasi bahwa sesi berstatus `waiting_payment`.
     - Server menandai status lunas dan menyiarkan event SSE.
     - Kiosk otomatis melanjutkan ke layar pemilihan template.
- **Verifikasi:**
  - Tekan tombol konfirmasi manual di admin -> layar kiosk customer langsung berpindah ke pemilihan template tanpa menunggu gateway.
- [ ] **Status:** Belum dikerjakan

---

## 🚀 FASE 5: Penyimpanan File, Modul Cetak Senyap & Layar Selesai

Fase ini menyelesaikan alur akhir transaksi: menyimpan foto ke disk sebelum mencetak dan menjalankan silent print.

### Task 5.1: Penyimpanan Foto Lokal & Pola Penamaan (F-17, F-18)
- **Tujuan:** Menyimpan file komposit dan foto mentah ke folder output sebelum mencetak dengan format nama standar.
- **File Target:**
  - `server/routes/photos.js`
  - `src/shared/filename.js`
  - `tests/filename.test.js`
- **Instruksi Kerja:**
  1. Buat pure function generator nama file di `src/shared/filename.js`:
     - Format: `YYYYMMDD-HHMMSS-<session-no>.jpg` (contoh: `20261011-143022-0042.jpg`).
     - Timestamp menggunakan waktu lokal WIB.
  2. Buat endpoint backend `POST /api/sessions/:id/save-photos`:
     - Menerima file foto final komposit dan foto-foto mentah.
     - Simpan file ke direktori `OUTPUT_FOLDER` (folder yang disinkronkan ke Google Drive for desktop).
     - Catat record ke tabel `photos` di database SQLite.
- **Batasan Penting:** Sesuai PRD, foto **wajib tersimpan di disk sebelum instruksi cetak dikirimkan** untuk mencegah kehilangan data jika printer macet.
- **Verifikasi:**
  - File JPG tersimpan dengan format nama yang benar di folder output dan dapat dibuka tanpa korup.
- [ ] **Status:** Belum dikerjakan

---

### Task 5.2: Modul Pencetakan Otomatis 4R & Jumlah Salinan (F-12)
- **Tujuan:** Mencetak hasil komposit ke printer default sistem dalam ukuran kertas 4R tanpa memunculkan dialog print.
- **File Target:**
  - `src/kiosk/screens/printing.js`
  - `electron/main.js` (IPC silent print)
  - `src/styles.css` (CSS cetak `@page` & N-copies)
- **Instruksi Kerja:**
  1. Buat CSS print layout di `src/styles.css`:
     ```css
     @media print {
       @page { size: 4in 6in; margin: 0; }
       body { margin: 0; padding: 0; }
       .print-page { page-break-after: always; width: 4in; height: 6in; }
     }
     ```
  2. Di `src/kiosk/screens/printing.js`:
     - Render elemen halaman cetak sejumlah `copies_per_session` (diatur admin, misal 2 lembar).
     - Kirim instruksi cetak senyap:
       - Di Electron: panggil `window.photobooth.printSilent()`.
       - Di Web: panggil fallback `window.print()`.
     - Tampilkan animasi visual brutalist: `SEDANG MENCETAK HASIL FOTOMU...`.
  3. Setelah perintah print terkirim, transisikan state sesi ke `done`.
- **Verifikasi:**
  - CSS print merender tepat N halaman sesuai pengaturan salinan tanpa margin putih yang memotong gambar.
- [ ] **Status:** Belum dikerjakan

---

### Task 5.3: Layar Selesai (Soft File & QR Drive) (F-20, F-19)
- **Tujuan:** Menampilkan pesan terima kasih dan instruksi unduh soft file dari QR code yang tercetak di kertas.
- **File Target:**
  - `src/kiosk/screens/done.js`
  - `src/kiosk/main.js`
- **Instruksi Kerja:**
  1. Buat modul `createDoneScreen({ sessionNo })`.
  2. Tampilkan teks RawBlock:
     - `AMBIL HASIL CETAKANMU DI PRINTER!` (`font-headline text-4xl text-black`).
     - `SCAN QR CODE DI CETAKAN UNTUK MENGUNDUH SOFT FILE`.
     - Tampilkan nomor sesi kecil di layar untuk referensi file customer.
  3. Pasang countdown otomatis 10 detik (`TIMEOUTS.DONE_SCREEN_SECONDS`).
  4. Saat timer habis, update status sesi ke `done` dan otomatis kembali ke Welcome screen.
- **Verifikasi:**
  - Layar selesai tampil selama 10 detik, lalu booth kembali ke layar awal siap untuk customer berikutnya.
- [ ] **Status:** Belum dikerjakan

---

## 🚀 FASE 6: Panel Admin Lengkap, Riwayat & Laporan

Fase ini melengkapi fungsionalitas pengawasan dan manajerial staff photobooth.

### Task 6.1: Proteksi Keamanan Panel Admin dengan PIN (F-14)
- **Tujuan:** Melindungi halaman `/admin` agar tidak bisa diakses oleh customer umum.
- **File Target:**
  - `src/admin/screens/pin-modal.js`
  - `src/admin/main.js`
  - `server/routes/settings.js`
- **Instruksi Kerja:**
  1. Buat modal keypad angka RawBlock untuk input 4-digit PIN staff.
  2. Verifikasi PIN ke endpoint server `POST /api/settings/verify-pin`:
     - PIN dicocokkan dengan nilai di tabel `settings` (default: `1234`).
  3. Jika benar, simpan token sesi lokal dan buka dashboard admin.
  4. Berikan fitur ubah PIN di pengaturan.
- **Verifikasi:**
  - Membuka halaman admin meminta PIN. Input PIN yang salah ditolak dengan pesan error RawBlock.
- [ ] **Status:** Belum dikerjakan

---

### Task 6.2: Riwayat Transaksi & Fitur Cetak Ulang (Reprint) (F-13)
- **Tujuan:** Staff dapat melihat daftar sesi yang telah selesai dan mencetak ulang foto jika printer sebelumnya macet/kehabisan kertas.
- **File Target:**
  - `src/admin/screens/history.js`
  - `server/routes/sessions.js`
- **Instruksi Kerja:**
  1. Buat tabel daftar transaksi di panel admin:
     - Kolom: Waktu, No Sesi, Template, Nominal, Status Pembayaran, Aksi.
  2. Setiap baris memiliki tombol "Cetak Ulang" (`btn-raw-secondary`).
  3. Saat tombol ditekan:
     - Muat path file komposit dari database.
     - Panggil fungsi cetak senyap langsung ke printer default tanpa mengganggu layar kiosk customer.
     - Tampilkan notifikasi status cetak ulang berhasil.
- **Verifikasi:**
  - Klik cetak ulang pada sesi kemarin -> perintah cetak dikirim ke printer dengan file foto yang benar.
- [ ] **Status:** Belum dikerjakan

---

### Task 6.3: Laporan Harian & Ekspor CSV (F-15)
- **Tujuan:** Memberikan ringkasan performa penjualan harian dan kemampuan mengunduh data transaksi ke spreadsheet.
- **File Target:**
  - `src/admin/screens/reports.js`
  - `server/routes/reports.js`
- **Instruksi Kerja:**
  1. Buat endpoint backend `GET /api/reports/daily`:
     - Menghitung total sesi lunas hari ini.
     - Menghitung total omset pendapatan (integer Rupiah).
  2. Tampilkan kartu ringkasan di dashboard: `TOTAL SESI: X` dan `TOTAL OMSET: RP Y`.
  3. Tambahkan tombol "Ekspor CSV" (`btn-raw-primary`):
     - Server merender data sesi menjadi file CSV (`id, waktu, template, nominal, status`).
     - Browser otomatis mengunduh file `laporan-photobooth-YYYYMMDD.csv`.
- **Verifikasi:**
  - File CSV yang diunduh dapat dibuka dengan rapi di Microsoft Excel atau Google Sheets.
- [ ] **Status:** Belum dikerjakan

---

## 🚀 FASE 7: Hardening Offline, Penanganan Error & Packaging Produksi

Fase final untuk memastikan aplikasi stabil di lapangan tanpa intervensi developer.

### Task 7.1: Penanganan Kegagalan & Ketahanan Offline (PRD Bagian 7 & 12)
- **Tujuan:** Aplikasi tetap dapat memfoto dan mencetak saat koneksi internet terputus, serta mampu memulihkan status sesi jika aplikasi tiba-tiba ditutup.
- **File Target:**
  - `server/routes/sessions.js`
  - `src/kiosk/main.js`
- **Instruksi Kerja:**
  1. **Session Recovery:** Saat aplikasi dimuat, cek sesi terakhir di SQLite (`GET /api/sessions/current`). Jika ada sesi menggantung di tengah jalan (misal laptop mati saat capturing), tanyakan pada operator atau pulihkan state terakhir.
  2. **Offline Detection:** Jika internet terputus saat berada di layar Welcome/Admin, tampilkan banner peringatan: `INTERNET TERPUTUS - PEMBAYARAN QRIS TIDAK DAPAT DIBUAT`.
  3. **Double-click Prevention:** Nonaktifkan semua tombol kiosk dan admin segera setelah diklik pertama kali untuk mencegah *double charge* atau *double print*.
- **Verifikasi:**
  - Putuskan koneksi WiFi -> aplikasi tetap bisa memfoto dan membuka template yang sudah ada di lokal.
- [ ] **Status:** Belum dikerjakan

---

### Task 7.2: Konfigurasi Electron Builder & Installer Desktop (PRD Bagian 8.1)
- **Tujuan:** Mengemas seluruh aplikasi ke dalam satu file installer desktop (.exe untuk Windows dan .dmg untuk macOS M1 Apple Silicon).
- **File Target:**
  - `package.json` (Konfigurasi script `electron-builder`)
  - `electron-builder.json`
- **Instruksi Kerja:**
  1. Pasang dependensi `electron-builder` ke `devDependencies`.
  2. Buat file `electron-builder.json`:
     - Tentukan app ID: `com.teras.photobooth`.
     - Konfigurasi target Windows: NSIS installer (`.exe`).
     - Konfigurasi target Mac: DMG (`arm64` untuk Apple Silicon).
     - Masukkan folder `server/`, `templates/`, `data/`, dan `dist/` ke dalam file distribusi.
     - Tetapkan direktori data persisten agar file database dan foto tidak terhapus saat pembaruan versi.
  3. Tambahkan script di `package.json`:
     - `"dist:win": "npm run build && electron-builder --win"`
     - `"dist:mac": "npm run build && electron-builder --mac --arm64"`
- **Verifikasi:**
  - Jalankan `npm run dist:win` -> menghasilkan file installer di folder `release/`.
- [ ] **Status:** Belum dikerjakan

---

## 📋 Lembar Kendali & Checklist Penerimaan Akhir (Definition of Done)

Sebelum booth dinyatakan siap digunakan di event mall/lapangan, seluruh item berikut harus tercentang:

- [ ] **Alur Mandiri:** Customer dapat menyelesaikan sesi (Welcome -> Bayar -> Pilih Template -> Foto -> Review -> Cetak) tanpa bantuan staff.
- [ ] **Kecepatan Alur:** Satu sesi penuh selesai dalam waktu ≤ 3 menit.
- [ ] **Zero Data Loss:** 100% foto tersimpan di folder lokal sebelum perintah cetak dikirim ke printer.
- [ ] **Ketepatan Cetak:** Hasil cetak 4R tidak terpotong, borderless, dan resolusi tajam (300 DPI).
- [ ] **Silent Print:** Pencetakan berjalan otomatis tanpa pernah memunculkan dialog konfigurasi printer.
- [ ] **Desain Konsisten:** Seluruh layar mematuhi RawBlock Brutalism (tanpa sudut bulat, tanpa shadow, kontras tinggi).
- [ ] **Stabilitas:** Aplikasi mampu berjalan 4 jam nonstop tanpa crash atau *memory leak*.

