const express = require('express');
const router = express.Router();
const { Rule } = require('../models');

// GET /api/rules
router.get('/', async (req, res) => {
  try {
    const rules = await Rule.find().sort({ createdAt: -1 }).lean();
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rules — create rule (blockIP, blockApp, blockDomain, blockPort)
router.post('/', async (req, res) => {
  try {
    const { type, value, description } = req.body;
    if (!type || !value) return res.status(400).json({ error: 'type and value required' });

    const validTypes = ['IP', 'APP', 'DOMAIN', 'PORT'];
    if (!validTypes.includes(type.toUpperCase())) {
      return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
    }

    const rule = await Rule.create({
      type: type.toUpperCase(),
      value: String(value),
      description,
      enabled: true,
    });

    res.status(201).json(rule);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Rule already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/rules/:id — toggle enabled or update
router.put('/:id', async (req, res) => {
  try {
    const rule = await Rule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json(rule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/rules/:id
router.delete('/:id', async (req, res) => {
  try {
    const rule = await Rule.findByIdAndDelete(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json({ message: 'Rule deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/rules — clear all rules
router.delete('/', async (req, res) => {
  try {
    await Rule.deleteMany({});
    res.json({ message: 'All rules cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
