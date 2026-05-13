const { Rule } = require('../models');

const VALID_TYPES = ['IP', 'APP', 'DOMAIN', 'PORT'];

// ─── GET all rules ────────────────────────────────────────────────────────────
const getAllRules = async (req, res, next) => {
  try {
    const rules = await Rule.find().sort({ createdAt: -1 }).lean();
    res.json(rules);
  } catch (err) {
    next(err);
  }
};

// ─── POST create rule ─────────────────────────────────────────────────────────
const createRule = async (req, res, next) => {
  try {
    const { type, value, description } = req.body;

    if (!type || !value)
      return res.status(400).json({ error: 'type and value are required' });

    if (!VALID_TYPES.includes(type.toUpperCase()))
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });

    const rule = await Rule.create({
      type:        type.toUpperCase(),
      value:       String(value),
      description,
      enabled:     true,
    });

    res.status(201).json(rule);
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ error: 'Rule already exists' });
    next(err);
  }
};

// ─── PUT update rule (enable/disable/description) ─────────────────────────────
const updateRule = async (req, res, next) => {
  try {
    const rule = await Rule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json(rule);
  } catch (err) {
    next(err);
  }
};

// ─── DELETE single rule ───────────────────────────────────────────────────────
const deleteRule = async (req, res, next) => {
  try {
    const rule = await Rule.findByIdAndDelete(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json({ message: 'Rule deleted' });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE all rules ─────────────────────────────────────────────────────────
const clearAllRules = async (req, res, next) => {
  try {
    await Rule.deleteMany({});
    res.json({ message: 'All rules cleared' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllRules, createRule, updateRule, deleteRule, clearAllRules };
