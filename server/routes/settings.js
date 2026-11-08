import { Router } from 'express';
import { db } from '../db.js';
import { broadcastEvent } from '../events.js';

const router = Router();

// GET all settings
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    if (!settings.gallery_base_url || (settings.gallery_base_url.includes('localhost') && process.env.GALLERY_BASE_URL && !process.env.GALLERY_BASE_URL.includes('localhost'))) {
      settings.gallery_base_url = process.env.GALLERY_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE settings
router.put('/', (req, res) => {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid settings payload' });
    }

    const updateStmt = db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const updateMany = db.transaction((entries) => {
      for (const [key, value] of entries) {
        updateStmt.run(key, String(value));
      }
    });

    updateMany(Object.entries(updates));

    // Broadcast update settings ke seluruh client terhubung (Kiosk & Admin)
    broadcastEvent('settings_updated', updates);
    if (updates.selected_camera_label || updates.selected_camera_id) {
      broadcastEvent('camera_changed', {
        label: updates.selected_camera_label,
        deviceId: updates.selected_camera_id
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// VERIFY admin PIN
router.post('/verify-pin', (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ success: false, error: 'PIN wajib diisi' });
    }

    const row = db.prepare("SELECT value FROM settings WHERE key = 'admin_pin'").get();
    const storedPin = row?.value || process.env.ADMIN_PIN || '1234';

    if (String(pin).trim() === String(storedPin).trim()) {
      return res.json({ success: true, message: 'PIN valid' });
    }

    return res.status(401).json({ success: false, error: 'PIN yang dimasukkan salah' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

