# PLAN — Refactor Layout Panel Admin: Sidebar + 5 Menu

> **Untuk AI yang mengerjakan:** baca seluruh dokumen ini sebelum menulis kode. Kerjakan **step demi step sesuai urutan**. Setelah setiap step, jalankan pengecekan di bagian "Cek selesai", lalu commit. Jangan lompat step, jangan gabung step.

---

## 0. Aturan Wajib

1. **Ini murni refactor tampilan.** Jangan mengubah endpoint server, skema database, `src/shared/api.js`, `src/shared/camera.js`, atau alur kiosk. Semua fitur yang ada sekarang harus tetap berfungsi sama persis.
2. Baca `GEMINI.md` dan ikuti aturannya: vanilla JS (ES modules), Tailwind, **tanpa** library/dependency baru, tanpa framework, tanpa event bus.
3. Kode, nama variabel, komentar, dan pesan commit pakai **bahasa Inggris**. Teks UI yang dilihat staff pakai **bahasa Indonesia** (huruf kapital sesuai gaya yang ada).
4. Gaya visual tetap **RawBlock** (border hitam tebal, tanpa radius, tanpa shadow lembut). Pakai class yang sudah ada di `src/styles.css`: `card-raw`, `card-raw-elevated`, `btn-raw-primary`, `btn-raw-secondary`, `btn-raw-destructive`, `input-raw`, `label-raw`, `chip-raw`, `chip-raw-active`, `chip-raw-warning`, `chip-raw-error`, `chip-raw-default`, `bg-raw-sunken`, `font-headline`, `font-body`, `font-mono`.
5. **Class `chip-raw-destructive` tidak ada di CSS** (bug lama). Saat memindahkan kode, ganti semua `chip-raw-destructive` menjadi `chip-raw-error`.
6. Setiap layar adalah modul dengan bentuk:
   ```js
   export function createXxxScreen(options) {
     return { mount(parent) {}, unmount() {}, refresh() {} };
   }
   ```
   `refresh()` opsional. `unmount()` **wajib** membersihkan semua `setInterval`, `setTimeout`, listener di `window`/`navigator.mediaDevices`, dan `EventSource` yang dibuat layar itu.
7. Pertahankan **ID elemen yang sudah ada** saat memindahkan markup (contoh: `history-table-body`, `btn-export-csv`) agar logika lama bisa dipindah dengan perubahan minimal.
8. Fungsi maksimal ±30 baris, maksimal 3 parameter, tanpa `catch {}` kosong, tanpa `console.log` debug yang tertinggal.
9. Jangan menghapus file selain yang disebut di plan ini. Jangan mengubah `vite.config.js`, Electron, atau `package.json`.
10. Perintah terminal di Windows PowerShell: pisahkan perintah dengan `;`, **bukan** `&&`.

---

## 1. Target Akhir

### 1.1 Wireframe

```
┌───────────────┬───────────────────────────────────────────────────────┐
│ TERAS         │ KAMERA: EKSTERNAL ● │ PRINTER: OK ● │ EVENT: WEDDING A │  ← top bar
│ PHOTOBOOTH    ├───────────────────────────────────────────────────────┤
│               │                                                       │
│ ▸ BERANDA (1) │   <judul menu>                                         │
│   EVENT       │   <deskripsi singkat>                                  │
│   LAPORAN     │                                                       │
│   TEMPLATE    │   <isi menu: kartu-kartu>                              │
│   PENGATURAN  │                                                       │
│               │                                                       │
│ [KUNCI PANEL] │                                                       │
└───────────────┴───────────────────────────────────────────────────────┘
```

- Sidebar hitam, lebar tetap (`w-64`), setinggi layar. Item aktif: latar putih, teks hitam.
- `(1)` = badge merah pada BERANDA, muncul hanya jika ada sesi berstatus `waiting_payment`.
- Top bar selalu tampil di semua menu.

### 1.2 Isi Setiap Menu

| Route (hash) | Menu | Isi | PRD |
| --- | --- | --- | --- |
| `#/beranda` | BERANDA | 3 kartu angka hari ini (sesi, lunas, omset) · sesi menunggu bayar + konfirmasi manual (modal PIN) · tombol darurat · kartu pilih kamera & printer | F-04, F-08, F-12, F-14, F-16 |
| `#/event` | EVENT | Banner event aktif · tabel event (aktifkan/nonaktifkan) · modal buat event baru | F-17, F-18 |
| `#/laporan` | LAPORAN | **Satu** filter event · 4 kartu ringkasan omset · tombol ekspor CSV · tabel riwayat transaksi + cetak ulang | F-13, F-15 |
| `#/template` | TEMPLATE | Layar `template-editor.js` yang sudah ada | F-07, F-22, F-23 |
| `#/pengaturan` | PENGATURAN | Form harga sesi, jumlah cetak, PIN | F-14 |

> Kartu "STATUS TEMPLATE CETAKAN" (tombol "BUKA EDITOR TEMPLATE") **dihapus** karena sudah digantikan menu TEMPLATE.
> Dua dropdown filter lama (`select-report-event` dan `select-history-event`) **digabung menjadi satu** `select-report-event` di menu LAPORAN yang mengontrol ringkasan, riwayat, dan ekspor CSV sekaligus.

### 1.3 Struktur File Akhir

```
src/admin/
├─ index.html              (diubah sedikit: class <main>)
├─ main.js                 (DITULIS ULANG: hanya cek PIN + mount shell, ±30 baris)
├─ router.js               (BARU: fungsi murni parsing route)
├─ shell.js                (BARU: sidebar, top bar, router, SSE, polling badge)
├─ ui-helpers.js           (BARU: helper markup kecil yang dipakai ulang)
└─ screens/
   ├─ pin-modal.js         (tidak diubah)
   ├─ template-editor.js   (tidak diubah)
   ├─ home.js              (BARU: Beranda)
   ├─ events.js            (BARU: Event)
   ├─ reports.js           (BARU: Laporan)
   └─ settings.js          (BARU: Pengaturan)
tests/
└─ admin-router.test.js    (BARU)
```

### 1.4 Peta Pemindahan Kode dari `src/admin/main.js` Lama

Cari bagian berikut di `main.js` lama berdasarkan **komentar HTML** atau **nama fungsi**, lalu pindahkan ke file tujuan.

| Bagian di `main.js` lama | Pindah ke |
| --- | --- |
| Markup `<!-- Status & Pemilihan Perangkat ... -->` (kartu kamera & printer) | `screens/home.js` |
| Logika `updateCameraStatusUI`, `updateCameraDevices`, `updatePrinterDevices`, listener `change` pada `select-camera-device` / `select-printer-device`, listener `devicechange` | `screens/home.js` |
| Markup `<!-- Sesi Menunggu Pembayaran ... -->` dan `<!-- Modal PIN Konfirmasi Manual ... -->` | `screens/home.js` |
| Logika `openPinModal`, `closePinModal`, submit `pin-confirm-form`, delegasi klik `#btn-manual-confirm`, `checkWaitingPayment` | `screens/home.js` |
| Markup `<!-- Tombol Darurat -->` + listener `btn-emergency-reset` | `screens/home.js` |
| Markup `<!-- Kelola Event & Sesi Operasional ... -->`, `<!-- Banner Event Aktif -->`, `<!-- Tabel Daftar Event -->`, `<!-- Modal Buat Event Baru ... -->` | `screens/events.js` |
| Logika modal event, `btnBrowseFolder`, submit `create-event-form`, `loadEvents` (bagian banner + tabel saja), `handleDeactivateEvent`, delegasi klik `events-table-body` | `screens/events.js` |
| Markup `<!-- Ringkasan Penjualan & Omset (F-15) -->`, `<!-- Riwayat Transaksi & Cetak Ulang (F-13) -->` | `screens/reports.js` |
| Logika `loadDailyReport`, ekspor CSV, `loadHistory`, `handleReprint`, delegasi klik `history-table-body`, isi dropdown filter (bagian dari `loadEvents` lama) | `screens/reports.js` |
| Markup `<!-- Pengaturan Sesi -->`, load `api.getSettings()`, simpan `btn-save-settings` | `screens/settings.js` |
| Tombol `btn-lock-panel`, `EventSource` SSE, `setInterval(checkWaitingPayment, ...)` | `shell.js` (dibuat ulang, bukan dipindah mentah) |
| Header lama (judul "Panel Operator Photobooth", `btn-nav-templates`, `system-status-pill`), kartu `<!-- Quick Status Template Aktif -->` | **Dihapus** |

---

## 2. Langkah Kerja

### STEP 1 — Baseline

1. Jalankan:
   ```powershell
   npm test; npm run build
   ```
2. Keduanya harus lulus **sebelum** mulai. Catat jumlah test yang lulus (saat ini 58).
3. Buka `src/admin/main.js` dan baca seluruhnya sekali agar paham isinya.

**Cek selesai:** test & build hijau. Tidak ada commit di step ini.

---

### STEP 2 — Konstanta Route

Tambahkan di **akhir** `src/shared/constants.js`:

```js
export const ADMIN_ROUTES = Object.freeze({
  HOME: 'beranda',
  EVENTS: 'event',
  REPORTS: 'laporan',
  TEMPLATES: 'template',
  SETTINGS: 'pengaturan'
});
```

**Cek selesai:** `npm run build` lulus.
**Commit:** `refactor(admin): add admin route constants (F-14)`

---

### STEP 3 — Router Murni + Test

Buat `src/admin/router.js`:

```js
import { ADMIN_ROUTES } from '../shared/constants.js';

const VALID_ROUTES = Object.values(ADMIN_ROUTES);

/**
 * Converts a location hash (e.g. "#/laporan") into a known admin route.
 * Unknown or empty hashes fall back to the home route.
 */
export function parseAdminRoute(hash) {
  const route = String(hash || '').replace(/^#\/?/, '').trim().toLowerCase();
  return VALID_ROUTES.includes(route) ? route : ADMIN_ROUTES.HOME;
}

export function toAdminHash(route) {
  return `#/${route}`;
}
```

Buat `tests/admin-router.test.js` dengan kasus berikut:
- `parseAdminRoute('#/laporan')` → `'laporan'`
- `parseAdminRoute('#laporan')` → `'laporan'`
- `parseAdminRoute('#/LAPORAN')` → `'laporan'`
- `parseAdminRoute('')`, `parseAdminRoute(undefined)`, `parseAdminRoute('#/tidak-ada')` → `'beranda'`
- `toAdminHash('event')` → `'#/event'`

**Cek selesai:** `npm test` lulus (jumlah test bertambah).
**Commit:** `feat(admin): add pure hash router helpers with tests (F-14)`

---

### STEP 4 — Helper UI Admin

Buat `src/admin/ui-helpers.js` berisi **hanya** dua fungsi ini:

```js
/**
 * Renders the standard page header used at the top of every admin menu.
 * @param {{ title: string, description: string, actionsHtml?: string }} options
 */
export function pageHeader({ title, description, actionsHtml = '' }) {
  return `
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 mb-6 border-b-[5px] border-black">
      <div>
        <h1 class="text-3xl font-headline uppercase tracking-tight text-black">${title}</h1>
        <p class="font-body text-sm text-black/70 mt-1">${description}</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">${actionsHtml}</div>
    </div>
  `;
}

export function formatRupiah(amount) {
  return `RP ${Number(amount || 0).toLocaleString('id-ID')}`;
}
```

Saat memindahkan kode di step berikutnya, ganti semua pola `` `RP ${Number(x || 0).toLocaleString('id-ID')}` `` dengan `formatRupiah(x)`. Pola `` `Rp ${...}` `` di tabel riwayat juga diganti `formatRupiah(...)`.

**Cek selesai:** `npm run build` lulus.
**Commit:** `refactor(admin): add shared admin UI helpers`

---

### STEP 5 — Layar Pengaturan (`screens/settings.js`)

Mulai dari layar paling sederhana.

1. Buat `src/admin/screens/settings.js` dengan `export function createSettingsScreen()`.
2. `mount(parent)`:
   - Buat `container` (`div`), isi `innerHTML` dengan:
     - `pageHeader({ title: 'PENGATURAN', description: 'Harga sesi, jumlah cetak, dan PIN operator' })`
     - Markup `<section>` dari `<!-- Pengaturan Sesi -->` lama (berisi `setting-price`, `setting-copies`, `setting-pin`, `btn-save-settings`). Judul `<h2>` di dalam section boleh tetap.
   - `parent.appendChild(container)`.
   - Panggil `loadSettings()` (pindahkan blok "Load existing settings" lama ke fungsi ini).
   - Pasang listener simpan memakai `preventDoubleClick` dari `../../shared/ui.js` (pindahkan blok "Save settings event" lama apa adanya).
3. `unmount()`: `container?.remove()`.
4. Gunakan `container.querySelector('#...')`, **bukan** `document.getElementById`, untuk semua elemen milik layar ini.

**Cek selesai:** `npm run build` lulus. (Layar belum dipakai, itu normal.)
**Commit:** `refactor(admin): extract settings screen module (F-14)`

---

### STEP 6 — Layar Event (`screens/events.js`)

1. Buat `export function createEventsScreen({ onStatusChange })`.
   `onStatusChange` adalah callback dari shell untuk memperbarui top bar.
2. Markup `container`:
   - `pageHeader({ title: 'EVENT', description: 'Folder penyimpanan foto per kegiatan (disinkronkan Google Drive)', actionsHtml: '<button id="btn-create-event-modal" class="btn-raw-primary px-5 py-2.5 text-xs font-headline">+ BUAT EVENT BARU</button>' })`
   - Banner event aktif (`active-event-name`, `active-event-path`, `active-event-chip`) dari markup lama.
   - Tabel event (`events-table-body`) dari markup lama.
   - Modal `event-modal-overlay` dari markup lama.
   - **Hapus** `<section>` pembungkus dan judul lama "KELOLA EVENT / SESI OPERASIONAL" karena sudah diganti `pageHeader`.
3. Logika yang dipindah:
   - Buka/tutup modal, klik di luar modal, `btn-browse-event-folder`, submit `create-event-form`.
   - `loadEvents()`: **hanya** bagian banner + render tabel. **Hapus** bagian yang mengisi dropdown `selectReportEvent` / `selectHistoryEvent`.
   - `handleDeactivateEvent()` dan delegasi klik `events-table-body` (aktifkan/nonaktifkan).
4. Di semua tempat yang dulu memanggil `loadDailyReport(...)` / `loadHistory(...)` setelah buat/aktif/nonaktif event: **hapus** panggilan itu, ganti dengan:
   ```js
   await loadEvents();
   onStatusChange?.();
   ```
5. `mount()` memanggil `loadEvents()` di akhir.
6. `refresh()` → `loadEvents()`.
7. `unmount()` → `container?.remove()`.

**Cek selesai:** `npm run build` lulus.
**Commit:** `refactor(admin): extract events screen module (F-17, F-18)`

---

### STEP 7 — Layar Laporan (`screens/reports.js`)

1. Buat `export function createReportsScreen()`.
2. Markup `container`:
   - `pageHeader` dengan `title: 'LAPORAN'`, `description: 'Omset, riwayat transaksi, dan cetak ulang'`, dan `actionsHtml` berisi:
     - label `FILTER:` + `<select id="select-report-event" class="input-raw py-1.5 px-3 text-xs font-mono">` dengan opsi awal `<option value="">SEMUA EVENT</option>`
     - tombol `btn-refresh-history` (teks `REFRESH`)
     - tombol `btn-export-csv` (teks `EKSPOR CSV`)
   - Grid 4 kartu ringkasan dari markup lama (`report-today-sessions`, `report-today-paid`, `report-today-revenue`, `report-alltime-sessions`, `report-alltime-paid`, `report-alltime-revenue`). Hapus header section lama beserta filter & tombolnya (sudah pindah ke `pageHeader`).
   - Tabel riwayat (`history-table-body`) dari markup lama, dalam `card-raw`. Hapus header section lama beserta dropdown `select-history-event` dan tombol refresh lama.
3. Fungsi baru `loadEventFilter()`:
   - Ambil `api.getEvents()`, isi `#select-report-event` dengan `SEMUA EVENT` + satu opsi per event (`nama` + ` [AKTIF]` jika `aktif`).
   - Pertahankan nilai yang sedang dipilih (pola sama seperti `loadEvents` lama).
4. Fungsi yang dipindah: `loadDailyReport`, `loadHistory`, `handleReprint` (beserta flag `isReprinting`), delegasi klik `history-table-body`, klik `btn-export-csv`.
   - Semua fungsi ini membaca event dari **satu** dropdown: `const eventId = filterSelect.value;`.
   - Ganti `chip-raw-destructive` → `chip-raw-error` di badge status sesi & pembayaran.
5. Fungsi `reloadAll()`:
   ```js
   async function reloadAll() {
     await loadEventFilter();
     await Promise.all([loadDailyReport(), loadHistory()]);
   }
   ```
6. Listener: `change` pada filter → `Promise.all([loadDailyReport(), loadHistory()])`; klik `btn-refresh-history` → `reloadAll()`.
7. `mount()` memanggil `reloadAll()` di akhir. `refresh()` → `Promise.all([loadDailyReport(), loadHistory()])`. `unmount()` → `container?.remove()`.

**Cek selesai:** `npm run build` lulus.
**Commit:** `refactor(admin): extract reports screen with single event filter (F-13, F-15)`

---

### STEP 8 — Layar Beranda (`screens/home.js`)

1. Buat `export function createHomeScreen({ onStatusChange })`.
2. Markup `container` (urutan dari atas):
   ```
   pageHeader({ title: 'BERANDA', description: 'Pantau sesi yang sedang berjalan hari ini' })

   [Grid 3 kolom] kartu angka hari ini:
     SESI HARI INI   → id="home-today-sessions"
     LUNAS           → id="home-today-paid"
     OMSET HARI INI  → id="home-today-revenue"

   [Grid lg:grid-cols-3]
     kolom kiri (lg:col-span-2): section "SESI MENUNGGU PEMBAYARAN" (markup lama, id waiting-payment-section,
                                 payment-widget-badge, payment-widget-content)
     kolom kanan: section "TOMBOL DARURAT" (markup lama, btn-emergency-reset)

   Judul kecil "PERANGKAT" lalu grid 2 kartu kamera & printer (markup lama)

   Modal pin-modal-overlay (markup lama)
   ```
   Kartu angka: `div` dengan `p-4 border-[3px] border-black bg-white`, label `label-raw text-xs`, angka `font-headline text-3xl`.
3. Fungsi baru `loadTodayStats()`:
   - `api.getDailyReport('')` → isi `home-today-sessions` (`${today.total_sessions} SESI`), `home-today-paid` (`${today.paid_sessions} LUNAS`), `home-today-revenue` (`formatRupiah(today.revenue)`).
   - Error → `console.warn` dengan pesan singkat.
4. Logika yang dipindah:
   - Perangkat: `updateCameraStatusUI`, `updateCameraDevices`, `updatePrinterDevices`, listener `change` kamera & printer. Setelah pilihan kamera/printer berubah, panggil `onStatusChange?.()`.
   - Listener `devicechange`: **simpan referensi handler** agar bisa dilepas:
     ```js
     const handleDeviceChange = () => updateCameraDevices();
     navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
     // di unmount():
     navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
     ```
   - Konfirmasi manual: `openPinModal`, `closePinModal`, submit `pin-confirm-form`, delegasi `#btn-manual-confirm`, `checkWaitingPayment`. Setelah konfirmasi sukses, panggil `checkWaitingPayment()`, `loadTodayStats()`, `onStatusChange?.()`. **Hapus** panggilan `loadHistory()` / `loadDailyReport()`.
   - Tombol darurat: sama seperti lama, tetapi setelah reset panggil `checkWaitingPayment()`, `loadTodayStats()`, `onStatusChange?.()`.
   - Ganti `chip-raw-destructive` → `chip-raw-error`.
5. **Jangan** membuat `setInterval` atau `EventSource` di layar ini. Polling & SSE ditangani shell, yang akan memanggil `refresh()`.
6. `mount()` memanggil di akhir: `loadTodayStats()`, `checkWaitingPayment()`, `updateCameraDevices()`, `updatePrinterDevices()`.
7. `refresh()` → `checkWaitingPayment()` dan `loadTodayStats()`.
8. `unmount()` → lepas listener `devicechange`, lalu `container?.remove()`.
9. Import yang dibutuhkan: `api` (`../../shared/api.js`), `preventDoubleClick` (`../../shared/ui.js`), `getCameraDevices` (`../../shared/camera.js`), `pageHeader`, `formatRupiah` (`../ui-helpers.js`).

**Cek selesai:** `npm run build` lulus.
**Commit:** `refactor(admin): extract home screen with live session controls (F-04, F-08, F-12, F-16)`

---

### STEP 9 — Shell: Sidebar, Top Bar, Router (`shell.js`)

Buat `src/admin/shell.js`. Tanggung jawab shell:
- Render kerangka sidebar + top bar + area konten `#admin-content`.
- Membaca hash URL → memasang layar yang sesuai → melepas layar sebelumnya.
- Satu koneksi SSE dan satu polling untuk seluruh panel; meneruskan pembaruan ke layar aktif via `refresh()`.
- Memperbarui top bar (kamera, printer, event aktif) dan badge BERANDA.

Gunakan kerangka berikut. Lengkapi bagian `TODO` lalu **hapus komentar `TODO` itu**:

```js
import { api } from '../shared/api.js';
import { ADMIN_ROUTES, DEFAULTS, TIMEOUTS } from '../shared/constants.js';
import { getCameraDevices } from '../shared/camera.js';
import { parseAdminRoute, toAdminHash } from './router.js';
import { createHomeScreen } from './screens/home.js';
import { createEventsScreen } from './screens/events.js';
import { createReportsScreen } from './screens/reports.js';
import { createSettingsScreen } from './screens/settings.js';
import { createTemplateEditor } from './screens/template-editor.js';

const SSE_URL = `http://localhost:${DEFAULTS.SERVER_PORT}/api/sse`;
const SSE_EVENTS = ['session_created', 'session_updated', 'payment_paid', 'payment_expired', 'payment_cancelled'];

const NAV_ITEMS = [
  { route: ADMIN_ROUTES.HOME, label: 'BERANDA' },
  { route: ADMIN_ROUTES.EVENTS, label: 'EVENT' },
  { route: ADMIN_ROUTES.REPORTS, label: 'LAPORAN' },
  { route: ADMIN_ROUTES.TEMPLATES, label: 'TEMPLATE' },
  { route: ADMIN_ROUTES.SETTINGS, label: 'PENGATURAN' }
];

export function createAdminShell({ onLock }) {
  let container = null;
  let contentEl = null;
  let currentScreen = null;
  let pollTimer = null;
  let sse = null;
  let lastWaitingSessionId = null;

  const refreshTopBar = () => {
    updateEventStatus();
    updateCameraStatus();
    updatePrinterStatus();
  };

  const screenFactories = {
    [ADMIN_ROUTES.HOME]: () => createHomeScreen({ onStatusChange: refreshTopBar }),
    [ADMIN_ROUTES.EVENTS]: () => createEventsScreen({ onStatusChange: refreshTopBar }),
    [ADMIN_ROUTES.REPORTS]: () => createReportsScreen(),
    [ADMIN_ROUTES.TEMPLATES]: () =>
      createTemplateEditor({ onBack: () => { window.location.hash = toAdminHash(ADMIN_ROUTES.HOME); } }),
    [ADMIN_ROUTES.SETTINGS]: () => createSettingsScreen()
  };

  function renderRoute() {
    const route = parseAdminRoute(window.location.hash);
    currentScreen?.unmount?.();
    contentEl.innerHTML = '';
    currentScreen = screenFactories[route]();
    currentScreen.mount(contentEl);
    highlightNav(route);
  }

  // TODO highlightNav(route): for each [data-route] link, toggle the active classes
  //      (active: 'bg-white text-black', inactive: 'text-white hover:bg-white/10')
  //      and set aria-current="page" on the active link only.

  // TODO updateEventStatus(): api.getEvents() → find aktif === 1 → set #topbar-event text to
  //      `EVENT: ${nama}` or 'EVENT: TANPA EVENT'. Use chip-raw-active / chip-raw-warning.

  // TODO updateCameraStatus(): getCameraDevices() → no devices: 'KAMERA: TIDAK ADA' (chip-raw-error);
  //      selected (localStorage 'selected_camera_id', fallback first external, fallback first device)
  //      isExternal → 'KAMERA: EKSTERNAL', else 'KAMERA: LAPTOP' (both chip-raw-active).

  // TODO updatePrinterStatus(): window.photobooth?.getPrinters?.() → empty: 'PRINTER: TIDAK ADA'
  //      (chip-raw-error), else 'PRINTER: OK' (chip-raw-active).

  async function pollWaitingSession() {
    try {
      const res = await api.getCurrentSession();
      const waitingId = res.data?.status === 'waiting_payment' ? res.data.id : null;
      setHomeBadge(Boolean(waitingId));
      if (waitingId !== lastWaitingSessionId) {
        lastWaitingSessionId = waitingId;
        currentScreen?.refresh?.();
      }
    } catch (err) {
      console.warn('[Admin] Gagal mengecek sesi aktif:', err.message);
    }
  }

  // TODO setHomeBadge(visible): show/hide #nav-badge-home (class 'hidden').

  function connectServerEvents() {
    try {
      sse = new EventSource(SSE_URL);
      const handleServerEvent = () => {
        pollWaitingSession();
        currentScreen?.refresh?.();
      };
      SSE_EVENTS.forEach((name) => sse.addEventListener(name, handleServerEvent));
    } catch (err) {
      console.warn('[Admin] SSE tidak tersedia:', err.message);
    }
  }

  return {
    mount(parent) {
      container = document.createElement('div');
      container.className = 'flex min-h-screen';
      container.innerHTML = renderLayout();
      parent.appendChild(container);
      contentEl = container.querySelector('#admin-content');

      container.querySelector('#btn-lock-panel').addEventListener('click', () => onLock?.());
      window.addEventListener('hashchange', renderRoute);

      if (!window.location.hash) {
        window.location.hash = toAdminHash(ADMIN_ROUTES.HOME);
      }
      renderRoute();
      refreshTopBar();
      pollWaitingSession();
      pollTimer = setInterval(pollWaitingSession, TIMEOUTS.PAYMENT_POLL_INTERVAL_MS);
      connectServerEvents();
    },
    unmount() {
      window.removeEventListener('hashchange', renderRoute);
      clearInterval(pollTimer);
      sse?.close();
      currentScreen?.unmount?.();
      currentScreen = null;
      container?.remove();
    }
  };
}

function renderLayout() {
  // TODO return the layout HTML (see spec below).
}
```

**Spesifikasi `renderLayout()`:**

```html
<aside class="w-64 shrink-0 bg-black text-white flex flex-col min-h-screen sticky top-0 h-screen">
  <div class="p-6 border-b-[3px] border-white">
    <p class="font-headline text-xl uppercase leading-tight">TERAS<br/>PHOTOBOOTH</p>
    <p class="font-mono text-[11px] text-white/60 mt-1">PANEL OPERATOR</p>
  </div>
  <nav class="flex-1 py-4" aria-label="Menu admin">
    <!-- satu <a> per NAV_ITEMS, dibangun dengan NAV_ITEMS.map(...).join('') -->
    <a href="#/beranda" data-route="beranda"
       class="flex items-center justify-between h-14 px-6 font-headline text-sm uppercase
              focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-white">
      <span>BERANDA</span>
      <!-- hanya untuk BERANDA: -->
      <span id="nav-badge-home" class="hidden chip-raw chip-raw-error text-[10px]">BAYAR</span>
    </a>
  </nav>
  <div class="p-4 border-t-[3px] border-white">
    <button id="btn-lock-panel" class="btn-raw-secondary w-full py-3 text-xs font-headline">KUNCI PANEL</button>
  </div>
</aside>

<div class="flex-1 min-w-0 flex flex-col">
  <header class="sticky top-0 z-40 bg-white border-b-[3px] border-black px-8 py-3 flex flex-wrap items-center gap-3">
    <span id="topbar-camera" class="chip-raw chip-raw-default text-xs">KAMERA: ...</span>
    <span id="topbar-printer" class="chip-raw chip-raw-default text-xs">PRINTER: ...</span>
    <span id="topbar-event" class="chip-raw chip-raw-default text-xs">EVENT: ...</span>
  </header>
  <main id="admin-content" class="flex-1 p-8 max-w-6xl w-full"></main>
</div>
```

Catatan untuk shell:
- Semua `querySelector` di shell harus dari `container`, bukan `document`.
- Fungsi-fungsi `TODO` didefinisikan **di dalam** `createAdminShell` (closure) kecuali `renderLayout`.
- Jangan pakai inline `style="..."`.

**Cek selesai:** `npm run build` lulus.
**Commit:** `feat(admin): add sidebar shell with hash router and live status bar (F-14)`

---

### STEP 10 — Ganti Entry Point (`main.js`) & `index.html`

1. **Tulis ulang** `src/admin/main.js` menjadi persis seperti ini (semua isi lama dihapus, karena sudah dipindah di step 5–9):
   ```js
   import { createPinModal } from './screens/pin-modal.js';
   import { createAdminShell } from './shell.js';

   const AUTH_STORAGE_KEY = 'admin_auth';
   const appRoot = document.getElementById('app');
   let currentView = null;

   function renderView(view) {
     currentView?.unmount?.();
     currentView = view;
     appRoot.innerHTML = '';
     view.mount(appRoot);
   }

   function lockPanel() {
     sessionStorage.removeItem(AUTH_STORAGE_KEY);
     start();
   }

   function start() {
     const isAuthenticated = sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true';
     if (!isAuthenticated) {
       renderView(createPinModal({ onAuthenticated: start }));
       return;
     }
     renderView(createAdminShell({ onLock: lockPanel }));
   }

   start();
   ```
2. Di `src/admin/index.html`, ubah:
   ```html
   <main id="app" class="p-8 max-w-6xl mx-auto">
   ```
   menjadi:
   ```html
   <main id="app">
   ```
   (Padding & lebar maksimum sekarang diatur oleh shell.)
3. Cek tampilan PIN login (`pin-modal.js`) masih rapi tanpa padding lama. Jika terlalu mepet ke tepi, tambahkan padding **di dalam markup `pin-modal.js` pada wrapper terluarnya saja** (misalnya `p-8`), jangan ubah logikanya.

**Cek selesai:** `npm test; npm run build` lulus.
**Commit:** `refactor(admin): replace monolithic dashboard with sidebar shell entry (F-14)`

---

### STEP 11 — Verifikasi Manual

Jalankan `npm run dev`, buka panel admin, lalu centang semua item berikut. Perbaiki jika ada yang gagal, lalu commit dengan `fix(admin): ...`.

**Navigasi**
- [ ] Setelah PIN benar, terbuka `#/beranda` dengan sidebar dan top bar.
- [ ] Klik setiap menu: konten berganti, item aktif berwarna putih, URL hash berubah.
- [ ] Refresh browser di `#/laporan` tetap membuka LAPORAN.
- [ ] Hash ngawur (`#/abc`) jatuh ke BERANDA.
- [ ] Tab/Shift+Tab di sidebar menampilkan outline fokus.
- [ ] KUNCI PANEL kembali ke layar PIN.

**Beranda**
- [ ] 3 angka hari ini tampil.
- [ ] Mulai sesi di kiosk → badge `BAYAR` muncul di sidebar dan widget menunggu bayar tampil (≤ 3 detik).
- [ ] Konfirmasi manual dengan PIN salah → pesan error; PIN benar → kiosk lanjut, badge hilang.
- [ ] Tombol darurat membatalkan sesi; di LAPORAN status pembayarannya `BATAL`.
- [ ] Ganti kamera/printer → top bar ikut berubah.

**Event**
- [ ] Buat event baru (termasuk tombol PILIH FOLDER di Electron) → muncul di tabel, top bar menampilkan nama event jika diaktifkan.
- [ ] Aktifkan / nonaktifkan event → banner & top bar berubah.

**Laporan**
- [ ] Filter event mengubah ringkasan **dan** tabel riwayat.
- [ ] EKSPOR CSV mengunduh file sesuai filter.
- [ ] CETAK ULANG berjalan seperti sebelumnya.
- [ ] Badge status `CANCELLED` / `BATAL` / `GAGAL` berwarna merah (bukan polos).

**Template & Pengaturan**
- [ ] Menu TEMPLATE membuka editor; tombol "KEMBALI KE DASHBOARD" kembali ke BERANDA.
- [ ] Simpan pengaturan berhasil dan nilainya tetap setelah refresh.

**Kebocoran resource**
- [ ] Pindah menu bolak-balik 10× lalu buka DevTools → Network: hanya ada **satu** koneksi `api/sse` yang terbuka dan request `sessions/current` tetap ~1 kali per 2,5 detik (tidak berlipat).
- [ ] Console bebas error.

---

### STEP 12 — Dokumentasi

1. Di `docs/CODEBASE.md`, perbarui bagian `src/admin/` (cari heading `` #### [`src/admin/`] ``): jelaskan singkat `main.js` (auth + shell), `shell.js` (sidebar, router hash, SSE, polling), `router.js`, `ui-helpers.js`, dan lima layar di `screens/`.
2. Jangan mengubah dokumen lain.

**Cek selesai:** `npm test; npm run build` lulus.
**Commit:** `docs: describe admin sidebar shell structure`

---

## 3. Definisi Selesai

- Semua checklist STEP 11 tercentang.
- `npm test` dan `npm run build` lulus, tanpa error di console.
- `src/admin/main.js` ±30 baris; tidak ada lagi markup dashboard di sana.
- Tidak ada perubahan pada `server/`, `electron/`, `src/kiosk/`, `src/shared/api.js`, `src/shared/camera.js`.
- Tidak ada dependency baru; tidak ada `TODO` atau `console.log` debug yang tertinggal.
- Ringkasan akhir ke user dalam bahasa Indonesia: apa yang berubah, cara mengetes, dan risiko yang masih ada.
