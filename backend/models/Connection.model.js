const mongoose = require('mongoose');

// Represents a network flow tracked by 5-tuple
const connectionSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true, index: true },

  fiveTuple: {
    srcIp:    String,
    destIp:   String,
    srcPort:  Number,
    destPort: Number,
    protocol: String,
  },

  state: {
    type: String,
    enum: ['NEW', 'ESTABLISHED', 'CLASSIFIED', 'BLOCKED', 'CLOSED'],
    default: 'NEW',
  },

  appType:    { type: String, default: 'UNKNOWN' },
  sni:        String,

  packetsIn:  { type: Number, default: 0 },
  packetsOut: { type: Number, default: 0 },
  bytesIn:    { type: Number, default: 0 },
  bytesOut:   { type: Number, default: 0 },

  action:    { type: String, default: 'FORWARD' },
  firstSeen: Date,
  lastSeen:  Date,
});

connectionSchema.index({ sessionId: 1 });

module.exports = mongoose.model('Connection', connectionSchema);
