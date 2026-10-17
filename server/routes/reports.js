import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

/**
 * Format Date ke string YYYY-MM-DD zona waktu lokal WIB (Asia/Jakarta)
 */
function getTodayWibString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * GET /api/reports/daily
 * Menghitung ringkasan performa penjualan harian dan all-time (PRD F-15)
 * Mendukung filter event_id melalui query parameter
 */
router.get('/daily', (req, res) => {
  try {
    const today = getTodayWibString();
    const { event_id } = req.query;

    let eventInfo = null;
    if (event_id) {
      eventInfo = db.prepare('SELECT id, nama FROM events WHERE id = ?').get(event_id) || null;
    }

    // 1. Total sesi hari ini
    const todayQuery = event_id
      ? `SELECT count(*) as count FROM sessions WHERE substr(dibuat_pada, 1, 10) = ? AND event_id = ?`
      : `SELECT count(*) as count FROM sessions WHERE substr(dibuat_pada, 1, 10) = ?`;
    const todaySessions = event_id
      ? db.prepare(todayQuery).get(today, event_id)
      : db.prepare(todayQuery).get(today);

    // 2. Sesi berbayar & omset hari ini
    const todayRevQuery = event_id
      ? `SELECT 
           count(p.id) as paid_count,
           coalesce(sum(p.nominal), 0) as total_revenue
         FROM payments p
         JOIN sessions s ON p.session_id = s.id
         WHERE p.status IN ('lunas', 'paid') 
           AND (substr(p.dibayar_pada, 1, 10) = ? OR p.dibayar_pada IS NULL)
           AND s.event_id = ?`
      : `SELECT 
           count(*) as paid_count,
           coalesce(sum(nominal), 0) as total_revenue
         FROM payments 
         WHERE status IN ('lunas', 'paid') AND (substr(dibayar_pada, 1, 10) = ? OR dibayar_pada IS NULL)`;
    const todayRevenue = event_id
      ? db.prepare(todayRevQuery).get(today, event_id)
      : db.prepare(todayRevQuery).get(today);

    // 3. Ringkasan keseluruhan (all-time / event-wide)
    const allTimeQuery = event_id
      ? `SELECT count(*) as count FROM sessions WHERE event_id = ?`
      : `SELECT count(*) as count FROM sessions`;
    const allTimeSessions = event_id
      ? db.prepare(allTimeQuery).get(event_id)
      : db.prepare(allTimeQuery).get();

    const allTimeRevQuery = event_id
      ? `SELECT 
           count(p.id) as paid_count,
           coalesce(sum(p.nominal), 0) as total_revenue
         FROM payments p
         JOIN sessions s ON p.session_id = s.id
         WHERE p.status IN ('lunas', 'paid') AND s.event_id = ?`
      : `SELECT 
           count(*) as paid_count,
           coalesce(sum(nominal), 0) as total_revenue
         FROM payments 
         WHERE status IN ('lunas', 'paid')`;
    const allTimeRevenue = event_id
      ? db.prepare(allTimeRevQuery).get(event_id)
      : db.prepare(allTimeRevQuery).get();

    // 4. Breakdown template terpopuler
    const popularQuery = event_id
      ? `SELECT 
           coalesce(t.nama, 'Belum Dipilih') as nama,
           count(s.id) as count
         FROM sessions s
         LEFT JOIN templates t ON s.template_id = t.id
         WHERE s.status = 'done' AND s.event_id = ?
         GROUP BY s.template_id
         ORDER BY count DESC
         LIMIT 5`
      : `SELECT 
           coalesce(t.nama, 'Belum Dipilih') as nama,
           count(s.id) as count
         FROM sessions s
         LEFT JOIN templates t ON s.template_id = t.id
         WHERE s.status = 'done'
         GROUP BY s.template_id
         ORDER BY count DESC
         LIMIT 5`;
    const popularTemplates = event_id
      ? db.prepare(popularQuery).all(event_id)
      : db.prepare(popularQuery).all();

    res.json({
      success: true,
      data: {
        date: today,
        filter_event: eventInfo,
        today: {
          total_sessions: todaySessions.count,
          paid_sessions: todayRevenue.paid_count,
          revenue: todayRevenue.total_revenue
        },
        all_time: {
          total_sessions: allTimeSessions.count,
          paid_sessions: allTimeRevenue.paid_count,
          revenue: allTimeRevenue.total_revenue
        },
        popular_templates: popularTemplates
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/reports/export-csv
 * Mengunduh laporan rekap transaksi sesi dalam format CSV standar (PRD F-15)
 * Mendukung filter event_id melalui query parameter
 */
router.get('/export-csv', (req, res) => {
  try {
    const { event_id } = req.query;

    const query = event_id
      ? `SELECT 
          s.rowid as session_no,
          s.id as session_id,
          s.dibuat_pada,
          coalesce(e.nama, 'Event Reguler') as event_nama,
          coalesce(t.nama, 'Belum Dipilih') as template_nama,
          coalesce(p.nominal, 0) as nominal,
          s.status as session_status,
          coalesce(p.status, 'unpaid') as payment_status
        FROM sessions s
        LEFT JOIN events e ON s.event_id = e.id
        LEFT JOIN templates t ON s.template_id = t.id
        LEFT JOIN payments p ON p.session_id = s.id
        WHERE s.event_id = ?
        ORDER BY s.rowid ASC`
      : `SELECT 
          s.rowid as session_no,
          s.id as session_id,
          s.dibuat_pada,
          coalesce(e.nama, 'Event Reguler') as event_nama,
          coalesce(t.nama, 'Belum Dipilih') as template_nama,
          coalesce(p.nominal, 0) as nominal,
          s.status as session_status,
          coalesce(p.status, 'unpaid') as payment_status
        FROM sessions s
        LEFT JOIN events e ON s.event_id = e.id
        LEFT JOIN templates t ON s.template_id = t.id
        LEFT JOIN payments p ON p.session_id = s.id
        ORDER BY s.rowid ASC`;

    const rows = event_id ? db.prepare(query).all(event_id) : db.prepare(query).all();

    // Header CSV
    const headers = [
      'No Sesi',
      'ID Sesi',
      'Event',
      'Waktu Dibuat',
      'Template Terpilih',
      'Nominal (IDR)',
      'Status Sesi',
      'Status Pembayaran'
    ];

    const escapeCsv = (str) => {
      const val = String(str ?? '');
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const csvLines = [headers.join(',')];

    for (const r of rows) {
      const line = [
        String(r.session_no).padStart(4, '0'),
        r.session_id,
        r.event_nama,
        r.dibuat_pada,
        r.template_nama,
        r.nominal,
        r.session_status,
        r.payment_status
      ].map(escapeCsv).join(',');

      csvLines.push(line);
    }

    const today = getTodayWibString().replace(/-/g, '');
    const filename = event_id ? `laporan-photobooth-${event_id}-${today}.csv` : `laporan-photobooth-${today}.csv`;
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const payload = Buffer.concat([bom, Buffer.from(csvLines.join('\r\n'), 'utf-8')]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(payload);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
