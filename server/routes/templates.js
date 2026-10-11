import { Router } from 'express';
import { resolve } from 'node:path';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { db } from '../db.js';

const router = Router();

// GET active or all templates (for kiosk and admin)
router.get('/', (req, res) => {
  try {
    const onlyActive = req.query.all !== 'true';
    const query = onlyActive
      ? 'SELECT * FROM templates WHERE aktif = 1 ORDER BY nama ASC'
      : 'SELECT * FROM templates ORDER BY nama ASC';
    const templates = db.prepare(query).all();

    const formatted = templates.map((t) => ({
      ...t,
      slots: JSON.parse(t.slots_json || '[]')
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single template by id
router.get('/:id', (req, res) => {
  try {
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template tidak ditemukan' });
    }
    res.json({
      success: true,
      data: {
        ...template,
        slots: JSON.parse(template.slots_json || '[]')
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create/upload new template
router.post('/', (req, res) => {
  try {
    const { nama, file_png, slots = [], aktif = 1 } = req.body;
    let { id } = req.body;

    if (!nama || !file_png) {
      return res.status(400).json({ success: false, error: 'Nama dan file_png wajib diisi' });
    }

    if (!id) {
      id = `tpl_${Date.now()}`;
    }

    // Sanitize id for filename
    const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${cleanId}.png`;
    const targetFilePath = resolve(process.cwd(), 'templates', fileName);

    // Save base64 image data to templates directory
    let base64Data = file_png;
    if (base64Data.includes(';base64,')) {
      base64Data = base64Data.split(';base64,').pop();
    }
    const buffer = Buffer.from(base64Data, 'base64');
    writeFileSync(targetFilePath, buffer);

    const jumlahSlot = Array.isArray(slots) ? slots.length : 0;
    const slotsJson = JSON.stringify(slots);
    const activeValue = aktif ? 1 : 0;

    const stmt = db.prepare(`
      INSERT INTO templates (id, nama, file_png, jumlah_slot, aktif, slots_json)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        nama = excluded.nama,
        file_png = excluded.file_png,
        jumlah_slot = excluded.jumlah_slot,
        aktif = excluded.aktif,
        slots_json = excluded.slots_json
    `);

    stmt.run(cleanId, nama, fileName, jumlahSlot, activeValue, slotsJson);

    res.status(201).json({
      success: true,
      data: {
        id: cleanId,
        nama,
        file_png: fileName,
        jumlah_slot: jumlahSlot,
        aktif: activeValue,
        slots
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH update template metadata or slot corrections
router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Template tidak ditemukan' });
    }

    const { nama, aktif, slots } = req.body;

    const updatedNama = nama !== undefined ? nama : existing.nama;
    const updatedAktif = aktif !== undefined ? (aktif ? 1 : 0) : existing.aktif;
    const updatedSlotsJson = slots !== undefined ? JSON.stringify(slots) : existing.slots_json;
    const updatedJumlahSlot = slots !== undefined ? slots.length : existing.jumlah_slot;

    db.prepare(`
      UPDATE templates 
      SET nama = ?, aktif = ?, slots_json = ?, jumlah_slot = ?
      WHERE id = ?
    `).run(updatedNama, updatedAktif, updatedSlotsJson, updatedJumlahSlot, id);

    const updated = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);

    res.json({
      success: true,
      data: {
        ...updated,
        slots: JSON.parse(updated.slots_json || '[]')
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE template
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Template tidak ditemukan' });
    }

    db.prepare('DELETE FROM templates WHERE id = ?').run(id);

    // Delete file if exists
    if (existing.file_png) {
      const filePath = resolve(process.cwd(), 'templates', existing.file_png);
      if (existsSync(filePath)) {
        try {
          unlinkSync(filePath);
        } catch (e) {
          console.warn('[Templates] Gagal menghapus berkas PNG:', e.message);
        }
      }
    }

    res.json({ success: true, message: 'Template berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
