import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// GET active templates (for kiosk and admin)
router.get('/', (req, res) => {
  try {
    const onlyActive = req.query.all !== 'true';
    const query = onlyActive
      ? 'SELECT * FROM templates WHERE aktif = 1'
      : 'SELECT * FROM templates';
    const templates = db.prepare(query).all();
    
    // Parse slots_json for consumers
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
      return res.status(404).json({ success: false, error: 'Template not found' });
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

export default router;
