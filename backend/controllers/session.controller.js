const fs                      = require('fs');
const { Session, Packet, Connection, Rule } = require('../models');
const { parsePcapFile }       = require('../utils/pcapParser');

// ─── GET all sessions ────────────────────────────────────────────────────────
const getAllSessions = async (req, res, next) => {
  try {
    const sessions = await Session.find().sort({ createdAt: -1 }).lean();
    res.json(sessions);
  } catch (err) {
    next(err);
  }
};

// ─── GET single session ──────────────────────────────────────────────────────
const getSessionById = async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id).lean();
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    next(err);
  }
};

// ─── POST upload pcap + trigger analysis ─────────────────────────────────────
const uploadSession = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const session = await Session.create({
      name:     req.body.name || req.file.originalname,
      filename: req.file.originalname,
      filepath: req.file.path,
      status:   'pending',
    });

    res.json({ sessionId: session._id, message: 'Upload successful. Analysis starting...' });

    // Run analysis in background — don't await
    runAnalysis(session._id, req.file.path, req.app.get('io')).catch(console.error);
  } catch (err) {
    next(err);
  }
};

// ─── DELETE session + all related data ───────────────────────────────────────
const deleteSession = async (req, res, next) => {
  try {
    const session = await Session.findByIdAndDelete(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    await Packet.deleteMany({ sessionId: req.params.id });
    await Connection.deleteMany({ sessionId: req.params.id });

    if (fs.existsSync(session.filepath)) fs.unlinkSync(session.filepath);

    res.json({ message: 'Session deleted' });
  } catch (err) {
    next(err);
  }
};

// ─── Background Analysis Job ──────────────────────────────────────────────────
const runAnalysis = async (sessionId, filepath, io) => {
  try {
    await Session.findByIdAndUpdate(sessionId, { status: 'processing' });
    io?.emit('session:status', { sessionId, status: 'processing' });

    const rules = await Rule.find({ enabled: true }).lean();

    const onProgress = ({ processed, bytesRead, totalBytes }) => {
      const pct = Math.round((bytesRead / totalBytes) * 100);
      io?.emit('session:progress', { sessionId, processed, progress: pct });
    };

    const { packets, connections, totalPackets } = await parsePcapFile(filepath, rules, onProgress);

    // Bulk insert packets in chunks of 500
    const CHUNK    = 500;
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
      totalBytes:        packets.reduce((s, p) => s + p.payloadLength, 0),
      forwardedPackets:  packets.filter(p => p.action === 'FORWARD').length,
      droppedPackets:    packets.filter(p => p.action === 'DROP').length,
      tcpPackets:        packets.filter(p => p.protocol === 'TCP').length,
      udpPackets:        packets.filter(p => p.protocol === 'UDP').length,
      otherPackets:      packets.filter(p => p.protocol !== 'TCP' && p.protocol !== 'UDP').length,
      activeConnections: connections.length,
    };

    // App distribution map
    const appDist = {};
    for (const p of packets) {
      if (p.appType && p.appType !== 'UNKNOWN') {
        appDist[p.appType] = (appDist[p.appType] || 0) + 1;
      }
    }

    // Save final stats to session
    await Session.findByIdAndUpdate(sessionId, {
      status: 'completed',
      stats,
      appDistribution: appDist,
      completedAt: new Date(),
    });

    io?.emit('session:completed', { sessionId, stats, appDistribution: appDist });

    // Update hit counts for matched rules
    const ruleHits = {};
    for (const p of packets) {
      if (p.action === 'DROP' && p.blockReason) {
        const parts = p.blockReason.split(': ');
        if (parts.length === 2) {
          const type = parts[0].replace('Blocked ', '');
          const val  = parts[1];
          const key  = `${type}:${val}`;
          ruleHits[key] = (ruleHits[key] || 0) + 1;
        }
      }
    }
    for (const [key, count] of Object.entries(ruleHits)) {
      const [type, value] = key.split(':');
      await Rule.findOneAndUpdate(
        { type: type.toUpperCase(), value },
        { $inc: { hitCount: count } }
      );
    }

  } catch (err) {
    console.error('Analysis error:', err);
    await Session.findByIdAndUpdate(sessionId, { status: 'error', error: err.message });
    io?.emit('session:error', { sessionId, error: err.message });
  }
};

module.exports = { getAllSessions, getSessionById, uploadSession, deleteSession };
