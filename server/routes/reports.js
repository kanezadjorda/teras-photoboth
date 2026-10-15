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
 */
router.get('/daily', (req, res) => {
  try {
    const today = getTodayWibString();

    // 1. Total sesi hari ini
    const todaySessions = db.prepare(`
      SELECT count(*) as count FROM sessions 
      WHERE substr(dibuat_pada, 1, 10) = ?
    `).get(today);

    // 2. Sesi berbayar & omset hari ini
    const todayRevenue = db.prepare(`
      SELECT 
        count(*) as paid_count,
        coalesce(sum(nominal), 0) as total_revenue
      FROM payments 
      WHERE status = 'paid' AND (substr(dibayar_pada, 1, 10) = ? OR dibayar_pada IS NULL)
    `).get(today);

    // 3. Ringkasan keseluruhan (all-time)
    const allTimeSessions = db.prepare(`
      SELECT count(*) as count FROM sessions
    `).get();

    const allTimeRevenue = db.prepare(`
      SELECT 
        count(*) as paid_count,
        coalesce(sum(nominal), 0) as total_revenue
      FROM payments 
      WHERE status = 'paid'
    `).get();

    // 4. Breakdown template terpopuler
    const popularTemplates = db.prepare(`
      SELECT 
        coalesce(t.nama, 'Belum Dipilih') as nama,
        count(s.id) as count
      FROM sessions s
      LEFT JOIN templates t ON s.template_id = t.id
      WHERE s.status = 'done'
      GROUP BY s.template_id
      ORDER BY count DESC
      LIMIT 5
    `).all();

    res.json({
      success: true,
      data: {
        date: today,
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
 */
router.get('/export-csv', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        s.rowid as session_no,
        s.id as session_id,
        s.dibuat_pada,
        coalesce(t.nama, 'Belum Dipilih') as template_nama,
        coalesce(p.nominal, 0) as nominal,
        s.status as session_status,
        coalesce(p.status, 'unpaid') as payment_status
      FROM sessions s
      LEFT JOIN templates t ON s.template_id = t.id
      LEFT JOIN payments p ON p.session_id = s.id
      ORDER BY s.rowid ASC
    `).all();

    // Header CSV
    const headers = [
      'No Sesi',
      'ID Sesi',
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
        r.dibuat_pada,
        r.template_nama,
        r.nominal,
        r.session_status,
        r.payment_status
      ].map(escapeCsv).join(',');

      csvLines.push(line);
    }

    const today = getTodayWibString().replace(/-/g, '');
    const filename = `laporan-photobooth-${today}.csv`;
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
