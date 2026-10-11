# PRD — Aplikasi Photobooth (QRIS + Template + Kamera & Printer Eksternal)

**Versi:** 0.9.1 (Draft MVP) · **Tanggal:** 4 Oktober 2026

---

## 1. Ringkasan

Aplikasi web lokal yang berjalan di laptop staff untuk mengoperasikan photobooth: customer membayar via QRIS, memilih template cetakan, berfoto dengan kamera eksternal, lalu hasilnya langsung dicetak di printer eksternal. Layar customer ditampilkan di monitor kedua, staff mengontrol dari laptop.

## 2. Tujuan & Metrik Sukses

| Tujuan | Metrik |
| --- | --- |
| Transaksi mandiri tanpa bantuan staff | ≥ 90% sesi selesai tanpa intervensi |
| Alur cepat | Bayar → cetak selesai ≤ 3 menit |
| Andal di venue (event/mall) | Tetap berjalan saat internet putus (kecuali verifikasi pembayaran) |
| Tidak ada foto hilang | 100% foto tersimpan lokal sebelum dicetak |

## 3. Pengguna

- **Customer** — pengunjung umum, tanpa pelatihan, memakai mouse (touchscreen belum dipakai).
- **Staff/Operator** — menyiapkan perangkat, memantau sesi, mencetak ulang, mengatasi masalah.
- **Owner** — mengatur harga, template, melihat laporan penjualan.

## 4. Ruang Lingkup

**MVP (In-scope)**

- Pembayaran QRIS dinamis + deteksi status otomatis
- Pilihan template (strip 2×6, 4×6 dengan 1–4 slot foto)
- Live preview kamera eksternal, hitung mundur, ambil foto, pilih ulang (retake)
- Komposit foto ke template, cetak otomatis (4R, jumlah cetak fleksibel)
- **Soft file:** foto disimpan ke folder laptop yang disinkronkan ke Google Drive; QR link folder Drive publik dicetak di template, customer scan untuk mengunduh
- Panel admin: status perangkat otomatis, atur harga (sepenuhnya oleh admin, tanpa voucher/promo), kelola template, cetak ulang, riwayat transaksi
- Penyimpanan lokal (foto + transaksi)

**Di luar MVP (Fase berikutnya)**

- Link unduh per sesi (QR dinamis) lewat Google Drive API; kirim foto via email/WhatsApp
- Filter/efek AR, GIF/boomerang
- Multi-booth dengan dashboard pusat

## 5. User Flow

```
[Staff] Sambung kamera + printer + monitor → buka /admin → tes perangkat → Mulai Sesi
   │
[Customer] Layar Welcome ("Sentuh untuk mulai")
   │
   ▼
1. Bayar QRIS            → harga sesi (diatur admin); QR dinamis + countdown 3 menit
      ├─ Lunas      → lanjut
      └─ Expired    → kembali ke Welcome
2. Pilih template        → bebas memilih template yang diaktifkan admin
3. Foto                  → preview live → countdown 3-2-1 → ambil N foto (N = jumlah slot template)
4. Review                → pilih/ulang foto (maks 1× retake per slot)
5. Cetak                 → komposit → print → "Ambil hasil cetakmu"
6. Soft file             → layar akhir: "Scan QR di cetakanmu untuk unduh soft file" (foto sudah tersimpan di folder Drive)
   │
   ▼
Selesai → kembali ke Welcome (otomatis)
```

> **Harga:** ditentukan admin per sesi dan sama untuk semua template. Customer membayar lebih dulu, lalu bebas memilih template aktif.

## 6. Kebutuhan Fungsional

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| **Pembayaran** |  |  |
| F-01 | Generate QRIS dinamis sesuai nominal via payment gateway | P0 |
| F-02 | Deteksi status bayar otomatis (polling/webhook), timeout 3 menit | P0 |
| F-03 | Catat transaksi (id, nominal, status, waktu) | P0 |
| F-04 | Konfirmasi manual oleh staff (cadangan jika gateway bermasalah) | P1 |
| **Template** |  |  |
| F-05 | Galeri template dari folder + file konfigurasi JSON | P0 |
| F-06 | Template = satu PNG; area foto berupa lubang transparan. Jumlah foto per sesi = jumlah slot template | P0 |
| F-07 | Upload template dari panel admin: **slot terdeteksi otomatis** dari area transparan, tampil sebagai kotak bernomor | P0 |
| F-22 | Editor koreksi slot: geser, ubah ukuran, hapus/tambah slot, ubah urutan foto | P1 |
| F-23 | Aktif/nonaktifkan template dan atur nama template (harga tidak per template) | P0 |
| **Kamera** |  |  |
| F-08 | Kamera eksternal terdeteksi otomatis (tanpa pemilihan manual; kamera bawaan laptop diabaikan jika ada kamera eksternal), live preview (mirror) | P0 |
| F-09 | Countdown + capture resolusi tertinggi yang didukung | P0 |
| F-10 | Retake per foto | P1 |
| **Cetak** |  |  |
| F-11 | Komposit foto + template ke satu gambar siap cetak (300 DPI) | P0 |
| F-12 | Cetak otomatis tanpa dialog ke printer default sistem (tanpa pemilihan printer; ukuran 4R diatur oleh aplikasi); jumlah salinan diterapkan di langkah cetak (N halaman pada CSS cetak), bukan di dialog printer | P0 |
| F-13 | Cetak ulang dari riwayat (staff) | P1 |
| **Staff** |  |  |
| F-14 | Halaman admin (PIN): indikator status perangkat otomatis (kamera, printer, internet, sinkron Drive; hanya tampilan), atur harga sesi, atur jumlah cetak per sesi (default 1; bisa diubah admin, mis. 2 untuk dua orang) | P0 |
| F-15 | Laporan harian: jumlah sesi & total pendapatan, ekspor CSV | P1 |
| F-16 | Tombol darurat: batalkan sesi / reset ke Welcome | P0 |
| **Soft file** |  |  |
| F-17 | Simpan foto final (dan foto asli, opsional) ke folder output; nama file `YYYYMMDD-HHMMSS-<no sesi>.jpg` | P0 |
| F-18 | Admin memilih folder output lewat dialog pilih folder (folder yang disinkronkan Google Drive for desktop) | P0 |
| F-19 | Nomor sesi dicetak kecil di hasil cetak (opsional, bisa diatur) agar customer mudah menemukan fotonya di folder | P1 |
| F-20 | Template boleh memuat QR/teks statis (bagian dari PNG, tidak transparan); aplikasi tidak membuat QR | P0 |

## 7. Kebutuhan Non-Fungsional

- **Keandalan:** foto disimpan ke disk sebelum cetak; sesi dapat dilanjutkan jika browser tertutup.
- **Performa:** komposit + kirim ke printer ≤ 5 detik.
- **Kemudahan:** tombol besar (≥ 56 px, siap touchscreen walau saat ini memakai mouse), teks Bahasa Indonesia, layout 16:9 dan 9:16 (portrait).
- **Keamanan:** API key gateway hanya di server (`.env`), tidak pernah di frontend; halaman `/admin` dilindungi PIN.
- **Offline:** semua kecuali pembayaran QRIS berjalan tanpa internet.
- **Kompatibilitas:** Windows 10/11 dan macOS (target utama: MacBook M1 / Apple Silicon, build arm64; aplikasi Electron, tidak perlu instal Node.js atau Chrome).
- **Kemudahan operasional:** staff awam; tidak ada terminal atau perintah manual sama sekali.

## 8. Tech Stack

Prinsip: **sesederhana mungkin, tanpa framework frontend**.

| Lapisan | Pilihan | Alasan |
| --- | --- | --- |
| Frontend | **HTML + JavaScript (vanilla, ES Modules)** | Tanpa framework UI, mudah di-debug |
| Bundler | **Vite** (template vanilla, multi-page) | Dev server cepat (HMR), build produksi ringkas; satu proyek untuk halaman kiosk dan admin |
| Styling | **Tailwind CSS (plugin Vite)** | Tanpa langkah CLI terpisah; CSS statis hasil build, jalan offline (tanpa CDN di produksi) |
| Kamera | **Web API `getUserMedia` + `ImageCapture`** | Native browser, mendukung webcam/UVC |
| Komposit gambar | **Canvas API** | Native, cukup untuk overlay template + foto |
| Backend lokal | **Node.js + Express** | Satu bahasa (JS), ringan, simpan rahasia API |
| Database | **SQLite (`better-sqlite3`)** | Tanpa server DB, satu file, mudah backup |
| Real-time | **Server-Sent Events (SSE)** | Sinkron layar staff ↔ customer, lebih simpel dari WebSocket |
| Pembayaran | **Midtrans Core API** (QRIS dinamis, sandbox & simulator tersedia) | Deteksi bayar via polling status order_id (tanpa webhook/tunnel); biaya flat/standar industri |
| Soft file | **Folder lokal + Google Drive for desktop** (sinkron otomatis) | Tanpa kode upload/server; sinkron menunggu sendiri saat offline |
| QR code | **Statis di desain template (PNG)** | Link folder Drive publik dijadikan QR di Canva/Photoshop; aplikasi tidak perlu generate QR |
| Cetak | **`window.print()` + CSS `@page` + Chrome `--kiosk-printing`** | Cetak tanpa dialog, ukuran kertas presisi |
| Distribusi | **Electron + electron-builder** (installer `.exe` Windows / `.dmg` macOS) | Staff cukup klik ikon aplikasi, tanpa terminal/Node/Chrome terpisah; cetak senyap bawaan |

**Catatan teknis penting**

1. **Kamera Canon DSLR:** browser hanya mengenali perangkat UVC. Gunakan **Canon EOS Webcam Utility** (cek dukungan tipe kamera) atau *HDMI capture card*. **Di MacBook M1:** versi lama EOS Webcam Utility pernah bermasalah di Apple Silicon (kamera tidak muncul di aplikasi); versi terbaru dilaporkan sudah membaik tetapi wajib diuji dengan model kamera dan macOS yang dipakai, termasuk di dalam aplikasi Electron kita. Jalur paling aman: *HDMI capture card* (terbaca sebagai kamera UVC tanpa driver di macOS), butuh kamera dengan *clean HDMI out*. Pasang *dummy battery* dan matikan auto power off. Resolusi ±1080p cukup untuk 4R. Aplikasi **tidak mengontrol kamera**; pengaturan (pencahayaan, fokus, white balance, dll.) dilakukan staff langsung di kamera sebelum sesi, aplikasi hanya menampilkan preview dan mengambil gambar.
2. **QRIS tidak bisa dibuat langsung dari frontend.** QRIS statis tidak bisa mendeteksi pembayaran. Wajib QRIS dinamis via gateway, dan itu butuh backend. Untuk laptop tanpa IP publik, gunakan **polling status** (server menanyakan status ke gateway tiap 2–3 detik) sehingga tidak perlu webhook/tunnel.
3. **Printer Epson, kertas 4R (4×6 inci):** atur ukuran kertas default di driver ke 4R borderless agar sama dengan `@page`. Jumlah cetak dirender sebagai N halaman di CSS cetak. Opsi hemat kertas: dua strip 2×6 berdampingan di satu lembar 4R, lalu dipotong.
4. **Midtrans Core API:** Endpoint charge mengembalikan `actions` berisi URL gambar QR code dan `qr_string` beserta `transaction_id`. Server melakukan polling `GET /v2/:order_id/status` setiap 2–3 detik hingga status berubah menjadi `settlement`. Tersedia Midtrans QRIS Simulator untuk pengujian di mode sandbox.
5. **Soft file via Google Drive:** aplikasi hanya menulis file ke folder output; Google Drive for desktop yang menyinkronkan. Atur folder tersebut ke mode *Mirror* (bukan Stream) agar file tetap tersimpan lokal. Bagikan folder dengan akses "Anyone with the link – Viewer", lalu jadikan link itu QR di desain template. **Privasi:** pemegang link dapat melihat semua foto di folder; folder Drive dibuat per event; ganti link/QR di template setiap event baru. Pantau sisa kuota Drive.

### 8.1 Distribusi & Cara Menjalankan

- **Pengembangan:** `npm run dev` menjalankan Vite dev server + Electron (HMR aktif); terminal hanya untuk developer.
- **Build:** `npm run build` → Vite menghasilkan `dist/` (kiosk, admin), lalu electron-builder mengemasnya menjadi installer.
- **Produksi:** satu installer `Photobooth-Setup.exe`. Setelah diinstal, aplikasi punya ikon desktop dan dibuka manual dengan klik ikon. Opsi **"Jalankan otomatis saat Windows menyala"** tersedia di pengaturan admin (default: mati).
- **Alur staff:** nyalakan laptop → sambung kamera/printer/monitor → klik ikon Photobooth (atau terbuka sendiri jika auto-start diaktifkan) → klik **Mulai Sesi**.
- `main.js` Electron (±30 baris) menjalankan server, membuka jendela admin di laptop dan jendela kiosk fullscreen di monitor kedua, serta mencetak senyap lewat `webContents.print`.
- **Pembaruan:** jalankan installer versi baru di atas yang lama; data (`data/`) tidak terhapus.

### 8.2 Penyimpanan: Lokal vs Online

| Data | Lokasi | Perlu internet? |
| --- | --- | --- |
| Database (transaksi, sesi, pengaturan) | SQLite, file lokal | Tidak |
| Foto asli & hasil komposit | Folder lokal `data/photos` | Tidak |
| Template | Folder lokal `templates/` | Tidak |
| Foto untuk soft file | Folder lokal yang disinkronkan Google Drive for desktop | Sinkron otomatis saat online |
| Pembayaran QRIS (Mayar) | Server Mayar | Ya |

Booth tetap bisa memfoto dan mencetak saat offline; sinkron ke Drive menyusul otomatis saat internet kembali. Backup: salin folder `data/` secara berkala (fitur backup otomatis di fase berikutnya).

## 9. Arsitektur

```
Laptop staff (Windows) — satu aplikasi Electron
├─ Express  (localhost:3000, berjalan di dalam aplikasi)
│   ├─ /api/payments   → buat QRIS, polling status ke gateway
│   ├─ /api/sessions   → simpan sesi & foto (SQLite + folder /data/photos)
│   ├─ /api/templates  → baca /templates/*.json
│   └─ /events (SSE)   → sinkron state ke layar customer
├─ Jendela Electron 1 (laptop)  → /admin   (staff)
└─ Jendela Electron 2 (monitor) → /kiosk   (customer, fullscreen)
        ├─ getUserMedia → kamera eksternal
        └─ Canvas → komposit → window.print() → printer eksternal
```

**Struktur folder**

```
photobooth/
├─ electron/      (main.js, preload.js)
├─ server/        (index.js, routes/, db.js, payment/)
├─ src/
│   ├─ kiosk/     (index.html, main.js, screens/)
│   ├─ admin/     (index.html, main.js)
│   └─ styles.css (@import "tailwindcss")
├─ vite.config.js (multi-page: kiosk, admin + plugin Tailwind)
├─ templates/     (strip-4.png, strip-4.json, ...)
├─ data/          (photobooth.db, photos/)
└─ .env           (API key gateway, PIN admin)
```

## 10. Model Data (SQLite)

| Tabel | Kolom utama |
| --- | --- |
| `templates` | id, nama, file_png, jumlah_slot, aktif |
| `sessions` | id, template_id, status (`menunggu_bayar`/`foto`/`cetak`/`selesai`/`batal`), dibuat_pada |
| `payments` | id, session_id, order_id, nominal, status, qris_string, dibayar_pada |
| `photos` | id, session_id, urutan, path_file |
| `settings` | key, value (harga sesi, jumlah cetak, PIN, folder output) |

## 11. Spesifikasi Template

```json
{
  "id": "strip-4",
  "nama": "Strip 4 Foto",
  "overlay": "strip-4.png",
  "canvas": { "width": 600, "height": 1800 },
  "paper": "2x6in",
  "slots": [
    { "x": 50, "y": 60,   "w": 500, "h": 380 },
    { "x": 50, "y": 470,  "w": 500, "h": 380 },
    { "x": 50, "y": 880,  "w": 500, "h": 380 },
    { "x": 50, "y": 1290, "w": 500, "h": 380 }
  ]
}
```

Foto digambar di dalam slot (cover-fit), lalu overlay PNG transparan digambar di atasnya. Desain template dibuat di Canva/Photoshop dengan area slot transparan.

### 11.1 Deteksi Slot Otomatis

Agar admin bisa membuat template dengan jumlah foto berbeda (2, 3, 4, dst.) tanpa menulis JSON:

1. Admin mendesain template di Canva/Photoshop berukuran **4R 300 DPI (1200×1800 px)**. Latar dan dekorasi **tidak transparan**; hanya area foto yang dilubangi (transparan).
2. Di panel admin: **Tambah Template** → pilih PNG.
3. Aplikasi membaca channel alpha lewat Canvas, mencari area transparan yang terpisah (connected components), mengabaikan area kecil (\< 2% kanvas), lalu mengambil bounding box tiap area.
4. Slot diurutkan atas → bawah, kiri → kanan, dan ditampilkan sebagai kotak bernomor di atas pratinjau.
5. Admin memeriksa/mengoreksi (F-22), mengisi nama, lalu **Simpan**. Hasil disimpan sebagai JSON (`slots`, `overlay`).
6. Di kiosk: jumlah pengambilan foto = jumlah slot ("Foto 1 dari 3"). Hasil dikomposit sesuai koordinat slot.

Batasan: lubang yang saling menyentuh terbaca satu slot (beri jarak antar-lubang); slot non-persegi memakai bounding box, bentuk akhirnya mengikuti overlay PNG di atas foto.

## 12. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Internet venue lemah saat bayar | Transaksi macet | Tombol konfirmasi manual staff (F-04); hotspot cadangan |
| Kamera DSLR tidak terdeteksi | Booth tidak bisa dipakai | Di MacBook M1 utamakan HDMI capture card (webcam utility Canon bisa bermasalah di Apple Silicon); siapkan webcam cadangan |
| Printer macet/kertas habis | Customer sudah bayar tapi tidak dapat cetakan | Cetak ulang dari riwayat (F-13) + indikator di panel staff |
| Dialog print muncul | Alur terhenti | Wajib flag `--kiosk-printing` + printer default benar |
| Sinkron Drive tertunda/gagal (internet lemah, kuota penuh) | Customer belum bisa unduh | Drive sinkron otomatis saat online; cek status & sisa kuota Drive sebelum event |
| Link folder publik bocor | Foto semua customer bisa dilihat | Folder per event; QR di template diganti tiap event |
| Listrik/laptop mati | Sesi hilang | Foto & status sesi disimpan per langkah ke disk |

## 13. Milestone

| Fase | Isi | Estimasi |
| --- | --- | --- |
| 1 | Setup proyek, kamera live + capture, komposit Canvas | 1 minggu |
| 2 | Template (JSON) + cetak otomatis ke printer | 1 minggu |
| 3 | Integrasi QRIS (mode sandbox → produksi) | 1–2 minggu |
| 4 | Panel admin, riwayat, laporan, penanganan error | 1 minggu |
| 5 | Uji lapangan 1–2 event, perbaikan | 1 minggu |

## 14. Kriteria Penerimaan MVP

- [ ] Customer menyelesaikan alur bayar → cetak tanpa bantuan staff
- [ ] Pembayaran terverifikasi otomatis di sandbox & produksi
- [ ] Minimal 3 template berfungsi dengan hasil cetak presisi (tidak terpotong)
- [ ] Cetak berjalan tanpa dialog di printer target
- [ ] Foto dan transaksi tersimpan, dapat dicetak ulang
- [ ] Booth berjalan 4 jam non-stop tanpa restart

## 15. Keputusan & Asumsi

1. **Model kamera & printer:** Canon DSLR dan printer Epson belum diketahui modelnya; diasumsikan mendukung karena perangkat baru. Verifikasi dukungan Canon EOS Webcam Utility dan driver borderless 4R saat model diketahui; cadangan: HDMI capture card.
2. **Layar customer:** memakai mouse untuk saat ini; UI tetap dibuat dengan tombol besar agar siap touchscreen.
3. **Folder Drive publik:** dibuat per event; QR di template diganti tiap event.
4. **Platform:** MacBook M1 (Apple Silicon); installer `.dmg` arm64 dibuild di MacBook tersebut.
5. **Jumlah cetak:** diatur admin (default 1) dan diterapkan di langkah cetak lewat `window.print`; biaya dihitung per orang, sehingga untuk dua orang admin dapat mengatur dua cetakan.
6. **Tanpa setup perangkat di aplikasi:** kamera terdeteksi otomatis (utamakan kamera eksternal) dan cetak memakai printer default sistem; aplikasi tidak menyediakan menu pilih kamera/printer/ukuran kertas. Konfigurasi driver Epson (printer default, 4R, borderless) dilakukan **sekali oleh teknisi saat instalasi**, bukan oleh staff.

**Pertanyaan terbuka**

- Versi macOS pada MacBook M1 dan model persis kamera Canon (untuk cek dukungan EOS Webcam Utility; jika meragukan, siapkan HDMI capture card).