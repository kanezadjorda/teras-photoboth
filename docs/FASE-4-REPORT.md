# Laporan Teknis: FASE 4 — Integrasi Pembayaran QRIS Dinamis (Midtrans Core API)

Dokumen ini mendokumentasikan implementasi teknis untuk **Fase 4: Integrasi Pembayaran QRIS Dinamis** pada aplikasi Teras Photobooth sesuai dengan kebutuhan PRD (F-01, F-02, F-03, F-04), desain sistem RawBlock ([`docs/DESIGN.md`](./DESIGN.md)), dan keputusan bersama untuk beralih menggunakan **Midtrans Core API (QRIS)**.

---

## 1. Latar Belakang & Keputusan Arsitektur

### Mengapa Midtrans Core API?
1. **Dukungan Sandbox Resmi & Simulator:** Midtrans menyediakan dashboard sandbox gratis tanpa perlu verifikasi dokumen bisnis, serta simulator QRIS resmi untuk menguji pembayaran.
2. **Tanpa Popup / Snap UI Bawaan:** Menggunakan **Midtrans Core API** (`POST /v2/charge`), sistem menerima data URL gambar QR code dan teks raw `qr_string` secara langsung. Antarmuka kiosk tetap 100% menggunakan styling **RawBlock Brutalism** murni tanpa elemen UI pihak ketiga.
3. **Arsitektur Polling Server-Side:** Sesuai PRD, laptop photobooth beroperasi di jaringan lokal tanpa IP publik. Server lokal Node.js melakukan polling status order ke endpoint `GET /v2/:order_id/status` setiap 2.5 detik (`TIMEOUTS.PAYMENT_POLL_INTERVAL_MS`), menghilangkan kebutuhan akan webhook publik atau tunnel.

---

## 2. Struktur Modul & Detail Kode

### 2.1 Service Midtrans Core API (`server/payment/midtrans.js`)
- **Fungsi Utama:**
  - `createQrisCharge({ orderId, amount })`: Mengirim request charge QRIS ke Midtrans API. Jika `MIDTRANS_SERVER_KEY` belum dikonfigurasi, modul secara otomatis beralih ke mode **Simulasi Mock** dengan QR code SVG beresolusi tinggi sehingga pengujian lokal tetap berjalan lancar.
  - `checkTransactionStatus(orderId)`: Memeriksa status transaksi ke Midtrans via HTTP GET dengan autentikasi Basic Auth `base64(serverKey + ':')`.
  - `mapMidtransStatusToPaymentState(status)`: Pure function untuk memetakan status Midtrans (`settlement`, `capture`, `pending`, `expire`, `cancel`, `deny`) ke konstanta internal `PAYMENT_STATES` (`paid`, `pending`, `expired`, `cancelled`, `failed`).
  - `simulateMockPayment(orderId)`: Helper untuk mengubah status transaksi mock menjadi `settlement` secara instan untuk kemudahan pengujian offline.

### 2.2 Rute Pembayaran & Polling Worker (`server/routes/payments.js`)
- **Endpoint:**
  - `POST /api/payments/charge`: Memvalidasi sesi berstatus `waiting_payment`, membaca harga sesi dari tabel `settings` (default Rp 25.000), membuat charge QRIS, mencatat ke tabel `payments`, dan memulai *polling worker*.
  - `GET /api/payments/:sessionId`: Mengambil detail data pembayaran berdasarkan ID sesi.
  - `POST /api/payments/:sessionId/confirm-manual`: Cadangan staff (F-04) untuk memverifikasi pembayaran secara manual dengan validasi PIN admin.
  - `POST /api/payments/:orderId/simulate-pay`: Endpoint pengujian sandbox untuk mensimulasikan pembayaran pelanggan.
- **Mekanisme Polling Worker:**
  - Menggunakan interval tiap 2.5 detik.
  - Memeriksa batas waktu 180 detik (3 menit). Jika melebihi batas, status transaksi dan sesi diubah menjadi `expired`, dan event SSE `payment_expired` disiarkan.
  - Ketika gateway mengembalikan status `settlement`/`capture`, status pembayaran diubah menjadi `paid`, status sesi menjadi `choosing_template`, dan event SSE `payment_paid` disiarkan ke frontend.

### 2.3 Layar Kiosk Pembayaran QRIS (`src/kiosk/screens/payment.js`)
- Mengikuti pola modular `mount()` / `unmount()`.
- **Fitur UI RawBlock:**
  - Kartu bingkai QRIS border 5px hitam dengan header standar nasional.
  - Tampilan nominal besar: `RP 25.000` (font Archivo Black).
  - Countdown timer 3 menit (`03:00` s.d. `00:00`) dengan font mono Space Mono dan progress bar.
  - Tombol batal untuk membatalkan sesi kembali ke Welcome.
  - Tombol helper pengujian `[DEV] SIMULASI BAYAR LANGSUNG`.
- **Koneksi SSE:**
  - Terhubung ke Server-Sent Events (`/api/events`) untuk mendeteksi `payment_paid` dan `payment_expired` secara real-time.

### 2.4 Panel Admin: Widget Konfirmasi Manual Staff (`src/admin/main.js`)
- Menampilkan card **"SESI MENUNGGU PEMBAYARAN (QRIS)"** (PRD F-04).
- Jika ada sesi aktif di monitor customer yang sedang menunggu pembayaran:
  - Badge berkedip hitam-putih `MENUNGGU PEMBAYARAN`.
  - Menampilkan ID sesi dan nominal.
  - Tombol **"KONFIRMASI BAYAR MANUAL"** yang meminta verifikasi PIN Staff (default: `1234`).
  - Saat dikonfirmasi, kiosk seketika beralih ke layar pemilihan template tanpa menunggu gateway.

---

## 3. Unit Testing & Verifikasi

Pengujian otomatis dilakukan menggunakan **Vitest**:
- File: `tests/payment.test.js`
- Menguji:
  1. Pemetaan status Midtrans (`settlement`, `capture` &rarr; `paid`, `expire` &rarr; `expired`, dsb.).
  2. Resolusi Base URL (Sandbox vs Production).
  3. Pembuatan charge mode mock dan transisi status saat simulasi bayar.
- **Hasil:** `23/23 tests passed` (100%).
- **Build:** `vite build` berhasil mengompilasi seluruh chunk (kiosk, admin, css) tanpa error.

---

## 4. Panduan Menghubungkan Akun Midtrans Asli

Jika ingin menguji menggunakan akun Midtrans Sandbox asli:
1. Buka [dashboard.sandbox.midtrans.com](https://dashboard.sandbox.midtrans.com) &rarr; menu **Settings** &rarr; **Access Keys**.
2. Salin **Server Key** (berawalan `SB-Mid-server-...`).
3. Buka file `.env` di folder proyek, lalu masukkan kunci:
   ```env
   MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxxxxxxx
   MIDTRANS_IS_PRODUCTION=false
   ```
4. Restart server backend (`npm run dev:server`).
5. Scan QR code yang tampil di kiosk menggunakan simulator Midtrans di:
   [https://simulator.sandbox.midtrans.com/qris/index](https://simulator.sandbox.midtrans.com/qris/index).

