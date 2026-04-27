const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Session, Packet, Connection, Rule } = require('../models');
const { parsePcapFile } = require('../utils/pcapParser');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

// GET /api/sessions — list all sessions
router.get('/', async (req, res) => {
  try {
    const sessions = await Session.find().sort({ createdAt: -1 }).lean();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id
router.get('/:id', async (req, res) => {
  try {
    const session = await Session.findById(req.params.id).lean();
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/upload — upload PCAP and start analysis
router.post('/upload', upload.single('pcap'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const session = await Session.create({
      name: req.body.name || req.file.originalname,
      filename: req.file.originalname,
      filepath: req.file.path,
      status: 'pending',
    });

    res.json({ sessionId: session._id, message: 'Upload successful. Analysis starting...' });

    // Run analysis asynchronously
    runAnalysis(session._id, req.file.path, req.app.get('io')).catch(console.error);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sessions/:id
router.delete('/:id', async (req, res) => {
  try {
    const session = await Session.findByIdAndDelete(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    await Packet.deleteMany({ sessionId: req.params.id });
    await Connection.deleteMany({ sessionId: req.params.id });
    if (fs.existsSync(session.filepath)) fs.unlinkSync(session.filepath);
    res.json({ message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function runAnalysis(sessionId, filepath, io) {
  try {
    await Session.findByIdAndUpdate(sessionId, { status: 'processing' });
    io?.emit('session:status', { sessionId, status: 'processing' });

    const rules = await Rule.find({ enabled: true }).lean();

    const onProgress = ({ processed, bytesRead, totalBytes }) => {
      const pct = Math.round((bytesRead / totalBytes) * 100);
      io?.emit('session:progress', { sessionId, processed, progress: pct });
    };

    const { packets, connections, totalPackets } = await parsePcapFile(filepath, rules, onProgress);

    // Bulk insert packets (in chunks to avoid memory issues)
    const CHUNK = 500;
    const toInsert = packets.map(p => ({ ...p, sessionId }));
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      await Packet.insertMany(toInsert.slice(i, i + CHUNK), { ordered: false });
    }

    // Insert connections
    const connDocs = connections.map(c => ({ ...c, sessionId }));
    if (connDocs.length > 0) {
      await Connection.insertMany(connDocs, { ordered: false });
    }

    // Compute stats
    const stats = {
      totalPackets,
      totalBytes: packets.reduce((s, p) => s + p.payloadLength, 0),
      forwardedPackets: packets.filter(p => p.action === 'FORWARD').length,
      droppedPackets: packets.filter(p => p.action === 'DROP').length,
      tcpPackets: packets.filter(p => p.protocol === 'TCP').length,
      udpPackets: packets.filter(p => p.protocol === 'UDP').length,
      otherPackets: packets.filter(p => p.protocol !== 'TCP' && p.protocol !== 'UDP').length,
      activeConnections: connections.length,
    };

    // App distribution
    const appDist = {};
    for (const p of packets) {
      if (p.appType && p.appType !== 'UNKNOWN') {
        appDist[p.appType] = (appDist[p.appType] || 0) + 1;
      }
    }

    // Update session
    await Session.findByIdAndUpdate(sessionId, {
      status: 'completed',
      stats,
      appDistribution: appDist,
      completedAt: new Date(),
    });

    io?.emit('session:completed', { sessionId, stats, appDistribution: appDist });

    // Update rule hit counts
    const ruleHits = {};
    for (const p of packets) {
      if (p.action === 'DROP' && p.blockReason) {
        const parts = p.blockReason.split(': ');
        if (parts.length === 2) {
          const type = parts[0].replace('Blocked ', '');
          const val = parts[1];
          const key = `${type}:${val}`;
          ruleHits[key] = (ruleHits[key] || 0) + 1;
        }
      }
    }
    for (const [key, count] of Object.entries(ruleHits)) {
      const [type, value] = key.split(':');
      await Rule.findOneAndUpdate({ type: type.toUpperCase(), value }, { $inc: { hitCount: count } });
    }

  } catch (err) {
    console.error('Analysis error:', err);
    await Session.findByIdAndUpdate(sessionId, { status: 'error', error: err.message });
    io?.emit('session:error', { sessionId, error: err.message });
  }
}

module.exports = router;
