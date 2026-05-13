const mongoose = require('mongoose');

// Represents a single parsed network packet
const packetSchema = new mongoose.Schema({
  sessionId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
  packetNumber: { type: Number, required: true },

  // Timestamps
  timestampSec:  Number,
  timestampUsec: Number,
  capturedAt:    Date,

  // Ethernet layer
  srcMac:    String,
  destMac:   String,
  etherType: String, // IPv4 / IPv6 / ARP

  // IP layer
  hasIp:    { type: Boolean, default: false },
  ipVersion: Number,
  srcIp:    String,
  destIp:   String,
  protocol: String, // TCP / UDP / ICMP / OTHER
  ttl:      Number,

  // Transport layer
  hasTcp:   { type: Boolean, default: false },
  hasUdp:   { type: Boolean, default: false },
  srcPort:  Number,
  destPort: Number,

  // TCP specific
  tcpFlags:  [String], // SYN / ACK / FIN / RST / PSH / URG
  seqNumber: Number,
  ackNumber: Number,

  // Payload
  payloadLength:  { type: Number, default: 0 },
  payloadPreview: String, // hex string of first 32 bytes

  // DPI Classification
  appType: {
    type: String,
    enum: [
      'UNKNOWN', 'HTTP', 'HTTPS', 'DNS', 'TLS', 'QUIC',
      'GOOGLE', 'FACEBOOK', 'YOUTUBE', 'TWITTER', 'INSTAGRAM',
      'NETFLIX', 'AMAZON', 'MICROSOFT', 'APPLE', 'WHATSAPP',
      'TELEGRAM', 'TIKTOK', 'SPOTIFY', 'ZOOM', 'DISCORD',
      'GITHUB', 'CLOUDFLARE',
    ],
    default: 'UNKNOWN',
  },
  sni: String, // Server Name Indication (from TLS)

  // Firewall action
  action: {
    type: String,
    enum: ['FORWARD', 'DROP', 'INSPECT', 'LOG_ONLY'],
    default: 'FORWARD',
  },
  blockReason: String, // Why it was dropped

  // Five-tuple for connection tracking
  fiveTuple: {
    srcIp:    String,
    destIp:   String,
    srcPort:  Number,
    destPort: Number,
    protocol: String,
  },
}, { timestamps: true });

// Indexes for fast filtering queries
packetSchema.index({ sessionId: 1, packetNumber: 1 });
packetSchema.index({ sessionId: 1, srcIp: 1 });
packetSchema.index({ sessionId: 1, appType: 1 });
packetSchema.index({ sessionId: 1, action: 1 });

module.exports = mongoose.model('Packet', packetSchema);
