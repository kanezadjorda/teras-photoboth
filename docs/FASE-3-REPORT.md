# Laporan Implementasi — Fase 3: Alur Kiosk Pemilihan Template, Pengambilan Foto & Review

Laporan ini merinci perubahan kode dan implementasi teknis untuk **Fase 3** pada [PLAN.md](file:///d:/teras-photobooth/PLAN.md) berdasarkan spesifikasi [docs/PRD.md](file:///d:/teras-photobooth/docs/PRD.md) dan standar desain brutalist [docs/DESIGN.md](file:///d:/teras-photobooth/docs/DESIGN.md).

---

## 1. Ringkasan Fitur yang Selesai

Pada Fase 3 ini, seluruh alur interaksi pelanggan di layar Kiosk telah terhubung dari awal hingga konfirmasi cetak:
1. **Layar Pemilihan Template (F-06, F-23)**: Menampilkan galeri template aktif yang tersimpan di database, dengan thumbnail, jumlah slot, dan pemilihan instan.
2. **Siklus Pengambilan Foto Berurutan (F-06, F-09)**: Mengambil foto secara sekuensial sesuai jumlah slot template (`N` foto), dilengkapi countdown 3-2-1, shutter flash 100ms, dan **pratinjau cepat 1.5 detik** antar jepretan.
3. **Layar Review & Komposit 4R (F-10, F-11)**: Menampilkan pratinjau hasil cetak komposit 1200×1800 px (300 DPI) yang menggabungkan foto pelanggan ke dalam lubang template.
4. **Mekanisme Retake Maksimal 1x (F-10)**: Pelanggan dapat mengulang foto pada slot tertentu saja. Sistem melacak kuota retake (`max 1x per slot`) dan menonaktifkan tombol retake jika kuota habis.

---

## 2. Rincian Modul & Kode yang Dibuat

### 2.1. [`src/kiosk/screens/choose-template.js`](file:///d:/teras-photobooth/src/kiosk/screens/choose-template.js)
- **Tujuan:** Antarmuka katalog template cetak yang ramah sentuhan untuk pelanggan.
- **Implementasi:**
  - Memanggil `api.getTemplates(false)` untuk hanya mengambil template yang berstatus `aktif = 1`.
  - Merender kartu RawBlock (`card-raw`) dengan tombol aksi besar `PILIH TEMPLATE INI`.
  - Mengirim objek template terpilih ke callback `onSelectTemplate(template)`.
  - Menyediakan tombol darurat pembatalan sesi `BATALKAN SESI` (`btn-raw-destructive`).

### 2.2. [`src/kiosk/screens/capture.js`](file:///d:/teras-photobooth/src/kiosk/screens/capture.js)
- **Tujuan:** Pengambilan foto webcam/capture card beresolusi tinggi dengan mode sekuensial dan mode retake single-slot.
- **Pembaruan Kunci:**
  - **Pratinjau Cepat 1.5 Detik (`showQuickPreview`)**: Sesaat setelah shutter mengambil foto, overlay transparan menampilkan foto yang baru dijepret selama 1500 ms dengan teks brutalist `FOTO #X TERSIMPAN!`.
  - **Mode Retake Slot Tunggal (`retakeSlotIndex`)**: Jika layar dipanggil dengan parameter `retakeSlotIndex`, alur hanya mengambil satu foto pengganti untuk slot tersebut (`MENGULANG FOTO #X`), tanpa mengulang seluruh sesi foto dari awal.

### 2.3. [`src/kiosk/screens/review.js`](file:///d:/teras-photobooth/src/kiosk/screens/review.js)
- **Tujuan:** Layar evaluasi hasil foto sebelum dicetak ke printer fisik.
- **Implementasi:**
  - **Asynchronous Composite Rendering**: Memanggil `renderComposite()` dari `src/shared/composite.js` menggunakan kanvas 1200×1800 px 300 DPI untuk memotong foto secara *cover-fit* ke dalam slot template dan menimpa overlay PNG template.
  - **Kontrol Retake per Slot**:
    - Melacak counter retake: `retakeCounts[slotIndex] = 0 | 1`.
    - Jika `retakeCounts[i] < 1`: Tombol `ULANG FOTO INI` aktif.
    - Jika `retakeCounts[i] >= 1`: Tombol otomatis dinonaktifkan (`disabled`) dengan label `KUOTA HABIS`.
  - **Tombol Konfirmasi**: `LANJUT & CETAK FOTO` (`btn-raw-primary min-h-[64px]`) untuk melanjutkan ke tahap produksi berikutnya.

### 2.4. [`src/kiosk/main.js`](file:///d:/teras-photobooth/src/kiosk/main.js)
- **Tujuan:** Orkestrasi alur layar dan sinkronisasi state machine sesi dengan server.
- **Alur Kerja:**
  ```text
  Welcome Screen
       │  (Klik "Mulai", buat sesi)
       ▼
  Choose Template Screen
       │  (Pilih template aktif -> status: 'capturing')
       ▼
  Capture Screen (N Foto)
       │  (Selesai foto -> status: 'reviewing')
       ▼
  Review Screen ◄────────┐
       │                 │ (Retake foto slot X)
       ├─► Retake Screen ─┘
       │
       ▼  (Konfirmasi "Lanjut & Cetak Foto")
  Welcome Screen (Selesai)
  ```

---

## 3. Hasil Pengujian & Verifikasi

1. **Unit Test (Vitest)**:
   ```powershell
   npm run test
   ```
   *Hasil:* **14 tests passed (3 test files: composite, slot-detector, session-state)**.
2. **Production Bundle (Vite)**:
   ```powershell
   npm run build
   ```
   *Hasil:* **Sukses terkompilasi dalam 106 ms tanpa error**.
3. **Verifikasi Fungsional UI**:
   - Template aktif muncul di layar Kiosk saat mulai sesi.
   - Mengambil N foto berjalan lancar dengan hitung mundur dan kilatan shutter.
   - Komposit foto tertata rapi di dalam kanvas pratinjau 4R.
   - Tombol retake berfungsi dan terkunci setelah 1x pemakaian per slot.
