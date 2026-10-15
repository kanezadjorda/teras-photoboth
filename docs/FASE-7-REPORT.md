# Laporan Teknis: FASE 7 — Hardening Offline, Penanganan Error & Packaging Produksi

Dokumen ini mendokumentasikan implementasi teknis untuk **Fase 7: Hardening Offline, Penanganan Error & Packaging Produksi** pada aplikasi Teras Photobooth sesuai dengan spesifikasi PRD (Bagian 7, 8.1, 8.2, 12) dan panduan desain RawBlock ([`docs/DESIGN.md`](./DESIGN.md)).

---

## 1. Ringkasan Fitur & Keputusan Arsitektur

### 1.1 Pemulihan Sesi (Session Recovery) (PRD Bagian 7 & 12)
Sesuai PRD Bagian 12:
> *"Risiko: Listrik atau laptop mati mendadak saat sesi berjalan. Mitigasi: Foto & status sesi disimpan per langkah ke disk/database SQLite. Sesi dapat dipulihkan saat aplikasi dibuka kembali."*

Alur pemulihan sesi:
1. Saat Kiosk dimuat (`src/kiosk/main.js`), fungsi `checkSessionRecovery()` memanggil endpoint `GET /api/sessions/current`.
2. Jika ada sesi yang belum selesai (status bukan `done`, `cancelled`, atau `expired`):
   - Jika statusnya `waiting_payment` dan sudah tercatat terbayar (`paid`), aplikasi langsung melanjutkan ke layar pemilihan template.
   - Untuk status sesi lainnya (`capturing`, `reviewing`, `waiting_payment`), antarmuka memunculkan modal dialog pemulihan sesi RawBlock ([`src/kiosk/screens/recovery-modal.js`](../src/kiosk/screens/recovery-modal.js)).
3. Operator atau customer dapat memilih:
   - **LANJUTKAN SESI:** Melanjutkan ke tahapan proses terakhir (memuat kembali template, slot, atau instruksi bayar).
   - **BATALKAN & MULAI BARU:** Membatalkan sesi menggantung tersebut (`status: 'cancelled'`) dan kembali ke Welcome Screen.

---

### 1.2 Deteksi Koneksi Offline & Banner Peringatan (PRD Bagian 8.2)
Sesuai PRD Bagian 8.2:
> *"Aplikasi bersifat offline-first. Semua fungsi (kamera live, template lokal, komposit Canvas, cetak senyap, dan penyimpanan disk) tetap bekerja 100% tanpa internet, kecuali pembuatan QRIS dinamis."*

Implementasi:
1. Helper `setupOfflineMonitor` di [`src/shared/ui.js`](../src/shared/ui.js) memantau event `window.addEventListener('online')` dan `window.addEventListener('offline')`.
2. Saat koneksi terputus:
   - Pada Layar Kiosk: Menampilkan banner RawBlock merah menyala di sisi atas layar:
     `KONEKSI INTERNET TERPUTUS • QRIS MEMERLUKAN KONEKSI ATAU KONFIRMASI MANUAL STAFF`.
   - Pada Layar Admin: Indikator koneksi berubah seketika menjadi `TERPUTUS / OFFLINE` dengan badge merah `chip-raw-destructive`.
3. Saat koneksi internet kembali aktif, banner otomatis disembunyikan dan status admin kembali menjadi `ONLINE / AKTIF`.

---

### 1.3 Pencegahan Aksi Ganda (Double-Click Prevention / Idempotency)
Sesuai panduan arsitektur PRD:
> *"Pencegahan double-charge, double-session, dan double-print melalui proteksi idempotensi tombol."*

Implementasi:
1. Fungsi `preventDoubleClick(button, asyncAction, loadingText)` di [`src/shared/ui.js`](../src/shared/ui.js):
   - Segera menonaktifkan tombol (`disabled = true`, `dataset.busy = 'true'`) pada klik pertama.
   - Menampilkan teks status seperti `MEMPROSES SESI...`, `MENYIAPKAN CETAKAN...`, atau `MENCETAK...`.
   - Mengabaikan semua klik tambahan yang masuk saat aksi asinkron masih berjalan.
   - Memulihkan tombol jika terjadi kegagalan jaringan atau galat sistem.
2. Diterapkan pada tombol kritis:
   - Tombol **Mulai Sesi** di Welcome Screen.
   - Tombol **Pilih Template** di Galeri Template.
   - Tombol **Lanjut & Cetak Foto** di Review Screen.
   - Tombol **Cetak Ulang (Reprint)** dan **Simpan Pengaturan** di Admin Panel.
   - Tombol **Emergency Reset** di Admin Panel.

---

### 1.4 Konfigurasi Electron Builder & Packaging Desktop (PRD Bagian 8.1)
Sesuai PRD Bagian 8.1:
> *"Pengemasan satu installer mandiri (NSIS .exe untuk Windows dan DMG arm64 untuk macOS Apple Silicon). Data database dan foto tidak terhapus saat instalasi pembaruan versi."*

Konfigurasi ([`electron-builder.json`](../electron-builder.json)):
1. **App ID & Identitas:** `com.teras.photobooth` / `Teras Photobooth`.
2. **Target Platform:**
   - Windows: NSIS Installer x64 (`.exe`) dengan kustomisasi direktori dan shortcut desktop/start menu.
   - macOS: DMG Apple Silicon (`arm64`).
3. **Persistensi Data Pengguna (`app.getPath('userData')`):**
   - Diatur di [`electron/main.js`](../electron/main.js) agar database SQLite (`data/photobooth.db`) dan folder output foto (`data/photos/`) mengarah ke direktori `userData` pada mode produksi.
   - Pembaruan installer di masa mendatang tidak akan menghapus riwayat transaksi maupun file foto yang telah dihasilkan.
4. **Native Binaries:**
   - Dikonfigurasi `asar: true` dengan `asarUnpack: ["**/node_modules/better-sqlite3/**/*"]` agar modul biner SQLite dapat dieksekusi langsung tanpa isu unpacking.
5. **NPM Scripts (`package.json`):**
   - `"dist:win": "npm run build && electron-builder --win"`
   - `"dist:mac": "npm run build && electron-builder --mac --arm64"`

---

## 2. Struktur File & Modul yang Dibuat / Dimodifikasi

| File | Peran & Deskripsi |
|---|---|
| `src/shared/ui.js` | Helper `preventDoubleClick` dan `setupOfflineMonitor`. |
| `src/kiosk/screens/recovery-modal.js` | Layar modal pemulihan sesi yang menggantung dengan opsi Lanjutkan / Batalkan. |
| `src/kiosk/screens/welcome.js` | Integrasi proteksi double-click pada tombol sentuh untuk mulai. |
| `src/kiosk/screens/choose-template.js` | Proteksi pemilihan template agar tidak memicu transisi ganda. |
| `src/kiosk/screens/review.js` | Proteksi konfirmasi cetak dari klik berulang. |
| `src/kiosk/main.js` | Integrasi pengecekan pemulihan sesi saat startup dan banner offline. |
| `src/admin/main.js` | Integrasi monitor status jaringan dinamis dan proteksi tombol simpan/reprint/reset. |
| `electron/main.js` | Konfigurasi path data persisten (`userData`) pada mode produksi. |
| `electron-builder.json` | Konfigurasi installer NSIS Windows dan DMG macOS. |
| `package.json` | Penambahan dependency `electron-builder` dan scripts `dist:win` / `dist:mac`. |
| `tests/offline-recovery.test.js` | Unit & integration test suite untuk session recovery dan pencegahan double-click. |

---

## 3. Hasil Pengujian & Verifikasi

1. **Vitest Unit & Integration:**
   - **42/42 tests passed** (100% lulus pada 8 test suites).
   - Menguji deteksi sesi menggantung, pembersihan sesi pasca-batal, dan mekanisme proteksi klik ganda.
2. **Vite Production Bundler:**
   - `vite build` berhasil mengompilasi 24 modul tanpa peringatan.
3. **Electron Builder Verification:**
   - Eksekusi `electron-builder --dir --win` sukses menghasilkan file distribusi di `release/win-unpacked/Teras Photobooth.exe`.
