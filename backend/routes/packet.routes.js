const express = require('express');
const router  = express.Router();

const {
  getPackets,
  getPacketById,
  getConnections,
} = require('../controllers/packet.controller');

// ─── Routes ──────────────────────────────────────────────────────────────────
router.get('/',                        getPackets);
router.get('/connections/:sessionId',  getConnections);
router.get('/:id',                     getPacketById);

module.exports = router;
