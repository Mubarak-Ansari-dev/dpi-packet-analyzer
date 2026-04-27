const express = require('express');
const router = express.Router();
const { Packet, Connection } = require('../models');

// GET /api/packets?sessionId=&page=&limit=&protocol=&action=&appType=&srcIp=&search=
router.get('/', async (req, res) => {
  try {
    const { sessionId, page = 1, limit = 50, protocol, action, appType, srcIp, search } = req.query;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

    const filter = { sessionId };
    if (protocol) filter.protocol = protocol;
    if (action) filter.action = action;
    if (appType) filter.appType = appType;
    if (srcIp) filter.srcIp = srcIp;
    if (search) {
      filter.$or = [
        { srcIp: new RegExp(search, 'i') },
        { destIp: new RegExp(search, 'i') },
        { sni: new RegExp(search, 'i') },
        { appType: new RegExp(search, 'i') },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [packets, total] = await Promise.all([
      Packet.find(filter)
        .sort({ packetNumber: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Packet.countDocuments(filter),
    ]);

    res.json({
      packets,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      limit: parseInt(limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/packets/:id — single packet detail
router.get('/:id', async (req, res) => {
  try {
    const packet = await Packet.findById(req.params.id).lean();
    if (!packet) return res.status(404).json({ error: 'Packet not found' });
    res.json(packet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/packets/connections/:sessionId — all tracked connections
router.get('/connections/:sessionId', async (req, res) => {
  try {
    const connections = await Connection.find({ sessionId: req.params.sessionId })
      .sort({ packetsIn: -1 })
      .lean();
    res.json(connections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
