# Laporan Teknis: FASE 6 — Panel Admin Lengkap, Riwayat & Laporan

Dokumen ini mendokumentasikan implementasi teknis untuk **Fase 6: Panel Admin Lengkap, Riwayat & Laporan** pada aplikasi Teras Photobooth sesuai dengan spesifikasi PRD (F-13, F-14, F-15) dan panduan desain RawBlock ([`docs/DESIGN.md`](./DESIGN.md)).

---

## 1. Ringkasan Fitur & Keputusan Arsitektur

### 1.1 Proteksi Keamanan Panel Admin dengan PIN (PRD F-14)
Sesuai PRD F-14:
> *"Panel admin dilindungi dengan otorisasi PIN operator (default: 1234) agar tidak dapat diakses atau diubah oleh customer umum yang sedang menggunakan kiosk."*

Alur pengamanan:
1. Saat halaman `/admin` dimuat, sistem mengecek otentikasi sesi di browser (`sessionStorage.getItem('admin_auth')`).
2. Jika belum terotentikasi, antarmuka langsung mengunci dan menampilkan modal keypad angka RawBlock 3x4 (`src/admin/screens/pin-modal.js`).
3. Operator memasukkan 4 digit PIN melalui tombol on-screen keypad maupun keyboard fisik.
4. PIN diverifikasi ke backend `POST /api/settings/verify-pin` yang mencocokkan nilai dengan tabel `settings.admin_pin` (default: `1234`).
5. Jika valid, status otentikasi disimpan di `sessionStorage` dan dashboard admin terbuka.
6. Header panel admin menyediakan tombol `KUNCI PANEL` untuk segera mengunci kembali panel operator saat ditinggalkan.
7. Fitur ubah PIN operator disediakan langsung pada bagian form Pengaturan Sesi & Keamanan.

---

### 1.2 Riwayat Transaksi & Fitur Cetak Ulang / Reprint (PRD F-13)
Sesuai PRD F-13:
> *"Staff dapat melihat daftar sesi transaksi dan mencetak ulang foto komposit jika printer sebelumnya macet atau kehabisan kertas tanpa perlu mengulang sesi customer."*

Alur cetak ulang:
1. Halaman admin menyajikan tabel riwayat transaksi (`GET /api/sessions/history`) dengan kolom: `NO SESI`, `WAKTU (WIB)`, `TEMPLATE`, `NOMINAL`, `STATUS SESI`, `PEMBAYARAN`, dan `AKSI REPRINT`.
2. Setiap sesi yang memiliki file foto komposit (`photos.urutan = 0`) dilengkapi tombol `CETAK ULANG`.
3. Saat diklik, frontend memanggil endpoint `POST /api/sessions/:id/reprint` untuk mengambil URL foto komposit lokal (`/photos/<filename>.jpg`).
4. Frontend menyiapkan layout cetak off-screen 4R dan memicu perintah silent print:
   - Pada Electron: memanggil `window.photobooth.printSilent({ copies: 1 })`.
   - Pada Browser Web: fallback menggunakan `window.print()`.
5. Notifikasi status keberhasilan cetak ulang langsung ditampilkan kepada operator.

---

### 1.3 Laporan Penjualan Harian & Ekspor CSV (PRD F-15)
Sesuai PRD F-15:
> *"Memberikan ringkasan performa penjualan harian (total sesi dan omset) serta kemampuan mengekspor rekap transaksi ke dalam format spreadsheet CSV."*

Implementasi laporan & ekspor:
1. Endpoint backend `GET /api/reports/daily` menghitung secara real-time:
   - Total sesi hari ini (zona waktu WIB) dan sesi berbayar (*paid*).
   - Akumulasi omset pendapatan hari ini dalam integer Rupiah.
   - Total akumulasi sesi dan omset keseluruhan (*all-time*).
   - Template cetak terpopuler.
2. Dashboard admin menampilkan 4 kartu ringkasan visual RawBlock:
   - `TOTAL SESI HARI INI`
   - `OMSET HARI INI`
   - `TOTAL SESI (ALL-TIME)`
   - `TOTAL OMSET (ALL-TIME)`
3. Tombol `EKSPOR CSV` memicu unduhan file dari endpoint `GET /api/reports/export-csv`:
   - Menghasilkan file berformat `laporan-photobooth-YYYYMMDD.csv`.
   - Dilengkapi byte-order mark UTF-8 (`\uFEFF`) agar terbaca sempurna di Microsoft Excel dan Google Sheets tanpa masalah encoding.
   - Kolom data: `No Sesi`, `ID Sesi`, `Waktu Dibuat`, `Template Terpilih`, `Nominal (IDR)`, `Status Sesi`, `Status Pembayaran`.

---

## 2. Struktur File & Modul

| File | Peran & Deskripsi |
|---|---|
| `server/routes/settings.js` | Endpoint `POST /api/settings/verify-pin` dan update konfigurasi `admin_pin`. |
| `server/routes/sessions.js` | Endpoint `GET /api/sessions/history` dan `POST /api/sessions/:id/reprint`. |
| `server/routes/reports.js` | Endpoint `GET /api/reports/daily` dan `GET /api/reports/export-csv` dengan UTF-8 BOM. |
| `server/index.js` | Pemasangan rute laporan `app.use('/api/reports', reportsRouter)`. |
| `src/shared/api.js` | Penambahan method API client: `verifyPin`, `getHistory`, `reprintSession`, `getDailyReport`, `getExportCsvUrl`. |
| `src/admin/screens/pin-modal.js` | Layar modal keypad RawBlock 3x4 dengan input visual 4-titik, error state, dan integrasi keyboard fisik. |
| `src/admin/main.js` | Integrasi auth guard, tombol kunci panel, kartu metrik penjualan, tabel riwayat, dan pemicu cetak ulang. |
| `tests/admin.test.js` | Unit & integration test suite Vitest untuk F-13, F-14, dan F-15. |

---

## 3. Hasil Pengujian & Verifikasi

Seluruh pengujian otomatis dijalankan menggunakan **Vitest**:
- `tests/admin.test.js` (8 tests):
  - Validasi penolakan PIN kosong / salah (HTTP 400 & 401).
  - Validasi penerimaan PIN standar `1234` (HTTP 200).
  - Validasi perubahan PIN ke nilai baru dan penegakannya.
  - Pengujian retrieval riwayat transaksi dengan formatting nomor sesi (`#0001`).
  - Pengujian validasi & eksekusi endpoint reprint foto komposit.
  - Pengujian kalkulasi metrik laporan harian dan all-time.
  - Pengujian struktur file CSV dan byte-order mark UTF-8 (`0xEF, 0xBB, 0xBF`).

**Hasil Pengujian Keseluruhan:**
- **38/38 tests passed** (100% lulus pada 7 test suites).
- Build frontend produksi `vite build` sukses mengompilasi 22 modul tanpa peringatan.
