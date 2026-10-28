# PRD — Aplikasi Photobooth (QRIS + Template + Kamera & Printer Eksternal)

**Versi:** 0.12 (Revisi Soft File: Cloudflare R2 & Galeri Web Vercel) · **Tanggal:** 28 Oktober 2026

---

## 1. Ringkasan

Aplikasi web lokal yang berjalan di laptop staff untuk mengoperasikan photobooth: customer membayar via QRIS, memilih template cetakan, berfoto dengan kamera eksternal, lalu hasilnya langsung dicetak di printer eksternal. Layar customer ditampilkan di monitor kedua, staff mengontrol dari laptop. Foto komposit dan satuan diunggah otomatis ke Cloudflare R2 untuk diunduh privat oleh customer via halaman galeri web di Vercel.

## 2. Tujuan & Metrik Sukses

| Tujuan                                | Metrik                                                             |
| ------------------------------------- | ------------------------------------------------------------------ |
| Transaksi mandiri tanpa bantuan staff | ≥ 90% sesi selesai tanpa intervensi                                |
| Alur cepat                            | Bayar → cetak selesai ≤ 3 menit                                    |
| Andal di venue (event/mall)           | Tetap berjalan saat internet putus (kecuali verifikasi pembayaran) |
| Tidak ada foto hilang                 | 100% foto tersimpan lokal sebelum dicetak                          |

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
- **Soft file privat via Cloudflare R2 & Vercel:** foto komposit dan foto satuan diunggah secara async ke Cloudflare R2 (S3-compatible, zero egress bandwidth, 10 GB gratis); QR Code dinamis unik per sesi di-generate di layar Done mengarah ke web galeri privat di Vercel (`https://<gallery-app>.vercel.app/s/<session_token>`) untuk diunduh customer di HP
- Panel admin: status perangkat otomatis, atur harga (sepenuhnya oleh admin, tanpa voucher/promo), kelola template, cetak ulang, riwayat transaksi
- Penyimpanan lokal (foto + transaksi)

**Di luar MVP (Fase berikutnya)**

- Kirim foto otomatis via email/WhatsApp
- Filter/efek AR, GIF/boomerang
- Multi-booth dengan dashboard pusat

## 5. User Flow

```
[Staff] Sambung kamera + printer + monitor → buka /admin → tes perangkat → Mulai Sesi
   │
[Customer] Layar Welcome  → kamera aktif sebagai latar, tombol "Mulai"
   │
   ▼
1. Tata cara             → 4 langkah bergambar; Lanjut / Kembali
2. Bayar QRIS            → harga sesi (diatur admin); QR dinamis + countdown 3 menit
      ├─ Lunas      → lanjut
      └─ Expired    → kembali ke Welcome
3. Pilih template        → bebas memilih template yang diaktifkan admin
4. Foto (per foto)       → preview live → countdown 3-2-1 → ambil → tampil hasil foto ke-i → **Ulangi** (tanpa batas) atau **Lanjut** ke foto berikutnya; diulang sampai N foto (N = jumlah slot template)
5. Pilih efek           → pratinjau hasil akhir, pilih efek (tidak ada retake di tahap ini)
6. Cetak                 → komposit (dengan efek) → print → "Ambil hasil cetakmu" (foto diunggah async ke Cloudflare R2 di background)
7. Soft file (Done)      → layar akhir: menampilkan QR Code dinamis unik sesi; customer memindai QR untuk membuka galeri privat di web Vercel dan download soft file
   │
   ▼
Selesai → kembali ke Welcome (otomatis)
```

> **Harga:** ditentukan admin per sesi dan sama untuk semua template. Customer membayar lebih dulu, lalu bebas memilih template aktif.

## 6. Kebutuhan Fungsional

| ID                      | Kebutuhan                                                                                                                                                                                                               | Prioritas |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **Pembayaran**          |                                                                                                                                                                                                                         |           |
| F-01                    | Generate QRIS dinamis sesuai nominal via payment gateway                                                                                                                                                                | P0        |
| F-02                    | Deteksi status bayar otomatis (polling/webhook), timeout 3 menit                                                                                                                                                        | P0        |
| F-03                    | Catat transaksi (id, nominal, status, waktu)                                                                                                                                                                            | P0        |
| F-04                    | Konfirmasi manual oleh staff (cadangan jika gateway bermasalah)                                                                                                                                                         | P1        |
| **Template**            |                                                                                                                                                                                                                         |           |
| F-05                    | Galeri template dari folder + file konfigurasi JSON                                                                                                                                                                     | P0        |
| F-06                    | Template = satu PNG; area foto berupa lubang transparan. Jumlah foto per sesi = jumlah slot template                                                                                                                    | P0        |
| F-07                    | Upload template dari panel admin: **slot terdeteksi otomatis** dari area transparan, tampil sebagai kotak bernomor                                                                                                      | P0        |
| F-22                    | Editor koreksi slot: geser, ubah ukuran, hapus/tambah slot, ubah urutan foto                                                                                                                                            | P1        |
| F-23                    | Aktif/nonaktifkan template dan atur nama template (harga tidak per template)                                                                                                                                            | P0        |
| **Kamera**              |                                                                                                                                                                                                                         |           |
| F-08                    | Kamera eksternal terdeteksi otomatis (tanpa pemilihan manual; kamera bawaan laptop diabaikan jika ada kamera eksternal), live preview (mirror)                                                                          | P0        |
| F-09                    | Countdown + capture resolusi tertinggi yang didukung                                                                                                                                                                    | P0        |
| F-10                    | Retake saat pengambilan: setelah tiap foto, customer memilih **Ulangi** (tanpa batas) atau **Lanjut** ke foto berikutnya. Hanya foto yang diterima yang disimpan ke disk; tidak ada retake setelah semua foto selesai   | P0        |
| **Cetak**               |                                                                                                                                                                                                                         |           |
| F-11                    | Komposit foto + template ke satu gambar siap cetak (300 DPI)                                                                                                                                                            | P0        |
| F-12                    | Cetak otomatis tanpa dialog ke printer default sistem (tanpa pemilihan printer; ukuran 4R diatur oleh aplikasi); jumlah salinan diterapkan di langkah cetak (N halaman pada CSS cetak), bukan di dialog printer         | P0        |
| F-13                    | Cetak ulang dari riwayat (staff)                                                                                                                                                                                        | P1        |
| **Staff**               |                                                                                                                                                                                                                         |           |
| F-14                    | Halaman admin (PIN): indikator status perangkat otomatis (kamera, printer, internet, status sync R2; hanya tampilan), atur harga sesi, atur jumlah cetak per sesi (default 1; bisa diubah admin, mis. 2 untuk dua orang) | P0        |
| F-15                    | Laporan harian: jumlah sesi & total pendapatan, ekspor CSV                                                                                                                                                              | P1        |
| F-16                    | Tombol darurat: batalkan sesi / reset ke Welcome                                                                                                                                                                        | P0        |
| **Pengalaman customer** |                                                                                                                                                                                                                         |           |
| F-24                    | Layar Welcome menampilkan preview kamera aktif sebagai latar fullscreen (dimirror, lapisan gelap agar teks terbaca) dan tombol Mulai; fallback gambar statis jika kamera tidak tersedia                                 | P0        |
| F-25                    | Satu layanan kamera memegang stream dan dipakai ulang di layar foto (tanpa buka-tutup kamera); kamera dideteksi ulang saat dicolok/dilepas                                                                              | P0        |
| F-26                    | Layar Tata Cara: 4 langkah bergambar + tombol Lanjut/Kembali; teks disimpan di satu berkas konfigurasi                                                                                                                  | P0        |
| F-27                    | Layar Pilih Efek setelah foto: pratinjau hasil + 7 preset (Normal, Hitam Putih, Sepia, Vintage, Cerah, Hangat, Dingin)                                                                                                  | P0        |
| F-28                    | Efek diterapkan hanya pada foto (bukan overlay template), sama untuk semua foto dalam satu sesi; hasil cetak = pratinjau; foto asli tetap tanpa efek; efek terpilih disimpan di sesi                                    | P0        |
| F-29                    | Tanpa aktivitas 60 detik di layar tata cara, pilih template, atau pilih efek → kembali ke Welcome                                                                                                                       | P1        |
| **Soft file privat**    |                                                                                                                                                                                                                         |           |
| F-17                    | Simpan foto final dan foto asli ke folder lokal `DATA_DIR/photos`; nama file `YYYYMMDD-HHMMSS-<no sesi>.jpg`                                                                                                            | P0        |
| F-18                    | Admin mengatur folder penyimpanan lokal; sinkronisasi ke Cloudflare R2 berjalan otomatis di latar belakang saat online                                                                                                  | P0        |
| F-19                    | Token unik sesi (UUID / slug acak) digenerate per sesi untuk akses privat galeri foto pelanggan                                                                                                                          | P0        |
| F-20                    | Layar Selesai (Done) menampilkan QR Code dinamis beresolusi tajam mengarah ke Web Galeri Vercel (`https://<app>.vercel.app/s/<token>`)                                                                                 | P0        |
| F-30                    | Web Galeri Responsif (Vercel): halaman download di HP customer bertema StudioBlank untuk mengunduh foto komposit 4R dan foto satuan dari Cloudflare R2 tanpa butuh login Google                                      | P0        |
| F-31                    | Antrean unggah resilien (offline-resilient queue): jika internet venue lemah/putus, proses booth & cetak tetap lancar; file foto otomatis diunggah begitu koneksi internet pulih                                      | P0        |

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

| Lapisan         | Pilihan                                                                   | Alasan                                                                                                    |
| --------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Frontend        | **HTML + JavaScript (vanilla, ES Modules)**                               | Tanpa framework UI, mudah di-debug                                                                        |
| Bundler         | **Vite** (template vanilla, multi-page)                                   | Dev server cepat (HMR), build produksi ringkas; satu proyek untuk halaman kiosk dan admin                 |
| Styling         | **Tailwind CSS (plugin Vite)**                                            | Tanpa langkah CLI terpisah; CSS statis hasil build, jalan offline (tanpa CDN di produksi)                 |
| Kamera          | **Web API `getUserMedia` + `ImageCapture`**                               | Native browser, mendukung webcam/UVC                                                                      |
| Komposit gambar | **Canvas API**                                                            | Native, cukup untuk overlay template + foto                                                               |
| Backend lokal   | **Node.js + Express**                                                     | Satu bahasa (JS), ringan, simpan rahasia API                                                              |
| Database        | **SQLite (`better-sqlite3`)**                                             | Tanpa server DB, satu file, mudah backup                                                                  |
| Real-time       | **Server-Sent Events (SSE)**                                              | Sinkron layar staff ↔ customer, lebih simpel dari WebSocket                                               |
| Pembayaran      | **Mayar.id** (QRIS dinamis, sandbox tersedia)                             | Deteksi bayar via polling transaksi paid (webhook opsional via Cloudflare Tunnel); cek biaya di dashboard |
| Soft file       | **Cloudflare R2 (S3-compatible Object Storage)**                          | 10 GB gratis, Rp 0 / tanpa biaya bandwidth egress; upload async via background queue                      |
| QR code         | **Dinamis per sesi di layar Done**                                        | Merender QR Code unik mengarah ke Galeri Web Vercel (`/s/<token>`)                                        |
| Cetak           | **`window.print()` + CSS `@page` + Chrome `--kiosk-printing`**            | Cetak tanpa dialog, ukuran kertas presisi                                                                 |
| Distribusi      | **Electron + electron-builder** (installer `.exe` Windows / `.dmg` macOS) | Staff cukup klik ikon aplikasi, tanpa terminal/Node/Chrome terpisah; cetak senyap bawaan                  |

**Catatan teknis penting**

1. **Kamera Canon DSLR:** browser hanya mengenali perangkat UVC. Gunakan **Canon EOS Webcam Utility** (cek dukungan tipe kamera) atau _HDMI capture card_. **Di MacBook M1:** versi lama EOS Webcam Utility pernah bermasalah di Apple Silicon (kamera tidak muncul di aplikasi); versi terbaru dilaporkan sudah membaik tetapi wajib diuji dengan model kamera dan macOS yang dipakai, termasuk di dalam aplikasi Electron kita. Jalur paling aman: _HDMI capture card_ (terbaca sebagai kamera UVC tanpa driver di macOS), butuh kamera dengan _clean HDMI out_. Pasang _dummy battery_ dan matikan auto power off. Resolusi ±1080p cukup untuk 4R. Aplikasi **tidak mengontrol kamera**; pengaturan (pencahayaan, fokus, white balance, dll.) dilakukan staff langsung di kamera sebelum sesi, aplikasi hanya menampilkan preview dan mengambil gambar.
2. **QRIS tidak bisa dibuat langsung dari frontend.** QRIS statis tidak bisa mendeteksi pembayaran. Wajib QRIS dinamis via gateway, dan itu butuh backend. Untuk laptop tanpa IP publik, gunakan **polling status** (server menanyakan status ke gateway tiap 2–3 detik) sehingga tidak perlu webhook/tunnel.
3. **Printer Epson, kertas 4R (4×6 inci):** atur ukuran kertas default di driver ke 4R borderless agar sama dengan `@page`. Jumlah cetak dirender sebagai N halaman di CSS cetak. Opsi hemat kertas: dua strip 2×6 berdampingan di satu lembar 4R, lalu dipotong.
4. **Mayar:** respons QRIS dinamis hanya berisi URL gambar QR dan nominal (tanpa ID transaksi), sehingga pembayaran dicocokkan lewat nominal + waktu. Uji juga API payment request di sandbox untuk opsi yang mengembalikan ID.
5. **Soft file privat via Cloudflare R2 & Galeri Web Vercel:** Menggantikan Google Drive for desktop. Setiap sesi foto menghasilkan secret token acak (UUIDv4/slug). Foto komposit dan foto satuan diunggah secara async ke bucket Cloudflare R2 menggunakan API S3-compatible (bebas kuota bandwidth keluar). Layar Done menghasilkan QR Code dinamis mengarah ke web galeri privat yang dihosting di Vercel (misal: `https://<gallery-app>.vercel.app/s/<token>`). Customer memindai QR untuk membuka galeri responsif bertema StudioBlank dan mengunduh foto mereka secara privat tanpa login Google dan tanpa bisa melihat foto sesi orang lain. Jika internet venue mati, booth tetap mencetak normal dan antrean upload R2 otomatis dilanjutkan saat koneksi internet pulih.

6. **Kamera latar & efek:** `cameraService` (singleton) memegang `MediaStream` dan memilih kamera eksternal otomatis; Welcome dan layar foto memakai stream yang sama. Di macOS, tambahkan `NSCameraUsageDescription` (electron-builder `mac.extendInfo`) agar izin kamera bisa diminta pada aplikasi yang dikemas. Efek = daftar preset `{id, label, filter}` (string filter CSS); pratinjau memakai komposit Canvas dengan `ctx.filter` pada foto saja, sehingga pratinjau sama persis dengan hasil cetak.

### 8.1 Distribusi & Cara Menjalankan

- **Pengembangan:** `npm run dev` menjalankan Vite dev server + Electron (HMR aktif); terminal hanya untuk developer.
- **Build:** `npm run build` → Vite menghasilkan `dist/` (kiosk, admin), lalu electron-builder mengemasnya menjadi installer.
- **Produksi:** satu installer `Photobooth-Setup.exe`. Setelah diinstal, aplikasi punya ikon desktop dan dibuka manual dengan klik ikon. Opsi **"Jalankan otomatis saat Windows menyala"** tersedia di pengaturan admin (default: mati).
- **Alur staff:** nyalakan laptop → sambung kamera/printer/monitor → klik ikon Photobooth (atau terbuka sendiri jika auto-start diaktifkan) → klik **Mulai Sesi**.
- `main.js` Electron (±30 baris) menjalankan server, membuka jendela admin di laptop dan jendela kiosk fullscreen di monitor kedua, serta mencetak senyap lewat `webContents.print`.
- **Pembaruan:** jalankan installer versi baru di atas yang lama; data (`data/`) tidak terhapus.

### 8.2 Penyimpanan: Lokal vs Online

| Data                                   | Lokasi                                                  | Perlu internet?              |
| -------------------------------------- | ------------------------------------------------------- | ---------------------------- |
| Database (transaksi, sesi, pengaturan) | SQLite, file lokal (`DATA_DIR/photobooth.db`)           | Tidak                        |
| Foto asli & hasil komposit             | Folder lokal `DATA_DIR/photos`                          | Tidak                        |
| Template                               | Folder lokal `templates/` & `DATA_DIR/templates`        | Tidak                        |
| Foto untuk soft file publik            | Cloudflare R2 Object Storage (10 GB gratis)             | Ya (upload async background) |
| Pembayaran QRIS                        | Server Payment Gateway                                  | Ya                           |

Booth tetap bisa memfoto dan mencetak saat offline; upload foto ke Cloudflare R2 menyusul otomatis saat internet kembali melalui antrean resilien. Backup: salin folder `DATA_DIR/` secara berkala.

## 9. Arsitektur

```
Laptop staff (Windows / macOS) — Aplikasi Desktop Electron
├─ Express (localhost:3000, berjalan di dalam aplikasi)
│   ├─ /api/payments   → buat QRIS, polling status ke gateway
│   ├─ /api/sessions   → simpan sesi & foto lokal (DATA_DIR/photos)
│   ├─ /api/templates  → baca & koreksi template
│   ├─ /events (SSE)   → sinkron state layar staff ↔ customer
│   └─ Cloudflare R2 Uploader (async queue) → upload foto komposit & foto satuan ke R2 bucket
├─ Jendela Electron 1 (laptop)  → /admin (staff operator)
└─ Jendela Electron 2 (monitor) → /kiosk (customer, fullscreen)
        ├─ getUserMedia → kamera eksternal
        ├─ Canvas → komposit → window.print() → printer eksternal
        └─ Layar Selesai (Done) → Tampilkan QR Code dinamis galeri web Vercel
             │
             ▼
Customer Smartphone (Scan QR via 4G/5G)
   │
   ▼
Web Galeri Privat di Vercel (https://<gallery-app>.vercel.app/s/:token)
   └─ Unduh foto komposit 4R & foto satuan langsung dari Cloudflare R2
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

| Tabel       | Kolom utama                                                                              |
| ----------- | ---------------------------------------------------------------------------------------- |
| `templates` | id, nama, file_png, jumlah_slot, aktif                                                   |
| `sessions`  | id, template_id, status (`menunggu_bayar`/`foto`/`cetak`/`selesai`/`batal`), dibuat_pada |
| `payments`  | id, session_id, order_id, nominal, status, qris_string, dibayar_pada                     |
| `photos`    | id, session_id, urutan, path_file                                                        |
| `settings`  | key, value (harga sesi, jumlah cetak, PIN, folder output)                                |

## 11. Spesifikasi Template

```json
{
  "id": "strip-4",
  "nama": "Strip 4 Foto",
  "overlay": "strip-4.png",
  "canvas": { "width": 600, "height": 1800 },
  "paper": "2x6in",
  "slots": [
    { "x": 50, "y": 60, "w": 500, "h": 380 },
    { "x": 50, "y": 470, "w": 500, "h": 380 },
    { "x": 50, "y": 880, "w": 500, "h": 380 },
    { "x": 50, "y": 1290, "w": 500, "h": 380 }
  ]
}
```

Foto digambar di dalam slot (cover-fit), lalu overlay PNG transparan digambar di atasnya. Desain template dibuat di Canva/Photoshop dengan area slot transparan.

### 11.1 Deteksi Slot Otomatis

Agar admin bisa membuat template dengan jumlah foto berbeda (2, 3, 4, dst.) tanpa menulis JSON:

1. Admin mendesain template di Canva/Photoshop berukuran **4R 300 DPI (1200×1800 px)**. Latar dan dekorasi **tidak transparan**; hanya area foto yang dilubangi (transparan).
2. Di panel admin: **Tambah Template** → pilih PNG.
3. Aplikasi membaca channel alpha lewat Canvas, mencari area transparan yang terpisah (connected components), mengabaikan area kecil (< 2% kanvas), lalu mengambil bounding box tiap area.
4. Slot diurutkan atas → bawah, kiri → kanan, dan ditampilkan sebagai kotak bernomor di atas pratinjau.
5. Admin memeriksa/mengoreksi (F-22), mengisi nama, lalu **Simpan**. Hasil disimpan sebagai JSON (`slots`, `overlay`).
6. Di kiosk: jumlah pengambilan foto = jumlah slot ("Foto 1 dari 3"). Hasil dikomposit sesuai koordinat slot.

Batasan: lubang yang saling menyentuh terbaca satu slot (beri jarak antar-lubang); slot non-persegi memakai bounding box, bentuk akhirnya mengikuti overlay PNG di atas foto.

## 12. Risiko & Mitigasi

| Risiko                                                     | Dampak                                        | Mitigasi                                                                                                                  |
| ---------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Internet venue lemah saat bayar                            | Transaksi macet                               | Tombol konfirmasi manual staff (F-04); hotspot cadangan                                                                   |
| Kamera DSLR tidak terdeteksi                               | Booth tidak bisa dipakai                      | Di MacBook M1 utamakan HDMI capture card (webcam utility Canon bisa bermasalah di Apple Silicon); siapkan webcam cadangan |
| Printer macet/kertas habis                                 | Customer sudah bayar tapi tidak dapat cetakan | Cetak ulang dari riwayat (F-13) + indikator di panel staff                                                                |
| Dialog print muncul                                        | Alur terhenti                                 | Wajib flag `--kiosk-printing` + printer default benar                                                                     |
| Upload R2 tertunda (internet venue lemah/mati)             | Customer belum bisa unduh soft file           | Antrean upload lokal resilien di SQLite (F-31); booth tetap cetak normal; sinkron otomatis saat internet pulih            |
| Kebocoran privasi foto antar-customer                      | Foto sesi customer bisa dilihat orang lain    | Token sesi acak unguessable (UUIDv4/crypto slug) per sesi; galeri hanya merender foto milik token tersebut                |
| Listrik/laptop mati                                        | Sesi hilang                                   | Foto & status sesi disimpan per langkah ke disk                                                                           |

## 13. Milestone

| Fase | Isi                                                  | Estimasi   |
| ---- | ---------------------------------------------------- | ---------- |
| 1    | Setup proyek, kamera live + capture, komposit Canvas | 1 minggu   |
| 2    | Template (JSON) + cetak otomatis ke printer          | 1 minggu   |
| 3    | Integrasi QRIS (mode sandbox → produksi)             | 1–2 minggu |
| 4    | Panel admin, riwayat, laporan, penanganan error      | 1 minggu   |
| 5    | Uji lapangan 1–2 event, perbaikan                    | 1 minggu   |

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
3. **Soft file privat via Cloudflare R2 & Vercel:** menggantikan Google Drive. Setiap sesi foto menghasilkan token sesi unik unguessable. Foto komposit 4R dan foto satuan diunggah secara async ke Cloudflare R2 (10 GB gratis, tanpa biaya bandwidth egress). Customer memindai QR dinamis di layar Done untuk membuka galeri privat di web Vercel (`https://<app>.vercel.app/s/<token>`) dan mengunduh foto mereka sendiri tanpa login Google dan tanpa melihat foto sesi lain.
4. **Platform:** MacBook M1 (Apple Silicon); installer `.dmg` arm64 dibuild di MacBook tersebut.
5. **Jumlah cetak:** diatur admin (default 1) dan diterapkan di langkah cetak lewat `window.print`; biaya dihitung per orang, sehingga untuk dua orang admin dapat mengatur dua cetakan.
6. **Tanpa setup perangkat di aplikasi:** kamera terdeteksi otomatis (utamakan kamera eksternal) dan cetak memakai printer default sistem; aplikasi tidak menyediakan menu pilih kamera/printer/ukuran kertas. Konfigurasi driver Epson (printer default, 4R, borderless) dilakukan **sekali oleh teknisi saat instalasi**, bukan oleh staff.

**Pertanyaan terbuka**

- Versi macOS pada MacBook M1 dan model persis kamera Canon (untuk cek dukungan EOS Webcam Utility; jika meragukan, siapkan HDMI capture card).
