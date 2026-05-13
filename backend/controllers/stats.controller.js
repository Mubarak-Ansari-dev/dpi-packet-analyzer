const mongoose   = require('mongoose');
const { Packet, Session } = require('../models');

// ─── GET aggregated chart data for a session ──────────────────────────────────
const getStats = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const oid = mongoose.Types.ObjectId.createFromHexString(sessionId);

    const [
      session,
      protocolDist,
      actionDist,
      appDist,
      topSrcIps,
      topDestIps,
      topPorts,
      topSnis,
    ] = await Promise.all([

      Session.findById(sessionId).lean(),

      Packet.aggregate([
        { $match: { sessionId: oid } },
        { $group: { _id: '$protocol', count: { $sum: 1 } } },
      ]),

      Packet.aggregate([
        { $match: { sessionId: oid } },
        { $group: { _id: '$action', count: { $sum: 1 } } },
      ]),

      Packet.aggregate([
        { $match: { sessionId: oid, appType: { $ne: 'UNKNOWN' } } },
        { $group: { _id: '$appType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),

      Packet.aggregate([
        { $match: { sessionId: oid, srcIp: { $ne: '' } } },
        { $group: { _id: '$srcIp', count: { $sum: 1 }, bytes: { $sum: '$payloadLength' } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      Packet.aggregate([
        { $match: { sessionId: oid, destIp: { $ne: '' } } },
        { $group: { _id: '$destIp', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      Packet.aggregate([
        { $match: { sessionId: oid, destPort: { $gt: 0 } } },
        { $group: { _id: '$destPort', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      Packet.aggregate([
        { $match: { sessionId: oid, sni: { $ne: null } } },
        { $group: { _id: '$sni', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    res.json({
      session,
      charts: {
        protocolDistribution: protocolDist.map(d => ({ name: d._id || 'OTHER', value: d.count })),
        actionDistribution:   actionDist.map(d => ({ name: d._id, value: d.count })),
        appDistribution:      appDist.map(d => ({ name: d._id, value: d.count })),
        topSourceIPs:         topSrcIps.map(d => ({ ip: d._id, packets: d.count, bytes: d.bytes })),
        topDestinationIPs:    topDestIps.map(d => ({ ip: d._id, packets: d.count })),
        topPorts:             topPorts.map(d => ({ port: d._id, packets: d.count })),
        topSNIs:              topSnis.map(d => ({ sni: d._id, packets: d.count })),
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getStats };
