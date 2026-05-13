const mongoose = require('mongoose');

// Represents one PCAP file analysis run
const sessionSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  filename: { type: String, required: true },
  filepath: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'error'],
    default: 'pending',
  },
  stats: {
    totalPackets:      { type: Number, default: 0 },
    totalBytes:        { type: Number, default: 0 },
    forwardedPackets:  { type: Number, default: 0 },
    droppedPackets:    { type: Number, default: 0 },
    tcpPackets:        { type: Number, default: 0 },
    udpPackets:        { type: Number, default: 0 },
    otherPackets:      { type: Number, default: 0 },
    activeConnections: { type: Number, default: 0 },
  },
  appDistribution: { type: Map, of: Number, default: {} },
  createdAt:   { type: Date, default: Date.now },
  completedAt: Date,
  error:       String,
});

module.exports = mongoose.model('Session', sessionSchema);
