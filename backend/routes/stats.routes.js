const express = require('express');
const router  = express.Router();

const { getStats } = require('../controllers/stats.controller');

// ─── Routes ──────────────────────────────────────────────────────────────────
router.get('/:sessionId', getStats);

module.exports = router;
