const mongoose = require('mongoose');

// ─── Session Model ───────────────────────────────────────────────────────────
// Represents one PCAP file analysis run (equivalent to DPIEngine processing a file)
const sessionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  filename: { type: String, required: true },
  filepath: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'error'],
    default: 'pending'
  },
  stats: {
    totalPackets: { type: Number, default: 0 },
    totalBytes: { type: Number, default: 0 },
    forwardedPackets: { type: Number, default: 0 },
    droppedPackets: { type: Number, default: 0 },
    tcpPackets: { type: Number, default: 0 },
    udpPackets: { type: Number, default: 0 },
    otherPackets: { type: Number, default: 0 },
    activeConnections: { type: Number, default: 0 },
  },
  appDistribution: { type: Map, of: Number, default: {} },
  createdAt: { type: Date, default: Date.now },
  completedAt: Date,
  error: String,
});

// ─── Packet Model ────────────────────────────────────────────────────────────
// Represents a single parsed packet (ParsedPacket + PacketJob equivalent)
const packetSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
  packetNumber: { type: Number, required: true },

  // Timestamps (from pcap)
  timestampSec: Number,
  timestampUsec: Number,
  capturedAt: Date,

  // Ethernet layer
  srcMac: String,
  destMac: String,
  etherType: String,   // e.g. "IPv4", "IPv6", "ARP"

  // IP layer
  hasIp: { type: Boolean, default: false },
  ipVersion: Number,
  srcIp: String,
  destIp: String,
  protocol: String,    // "TCP", "UDP", "ICMP", "OTHER"
  ttl: Number,

  // Transport layer
  hasTcp: { type: Boolean, default: false },
  hasUdp: { type: Boolean, default: false },
  srcPort: Number,
  destPort: Number,

  // TCP-specific
  tcpFlags: [String],  // ["SYN", "ACK", etc.]
  seqNumber: Number,
  ackNumber: Number,

  // Payload
  payloadLength: { type: Number, default: 0 },
  payloadPreview: String,  // hex string of first 32 bytes

  // DPI Classification (from DPIEngine / ConnectionTracker)
  appType: {
    type: String,
    enum: [
      'UNKNOWN', 'HTTP', 'HTTPS', 'DNS', 'TLS', 'QUIC',
      'GOOGLE', 'FACEBOOK', 'YOUTUBE', 'TWITTER', 'INSTAGRAM',
      'NETFLIX', 'AMAZON', 'MICROSOFT', 'APPLE', 'WHATSAPP',
      'TELEGRAM', 'TIKTOK', 'SPOTIFY', 'ZOOM', 'DISCORD',
      'GITHUB', 'CLOUDFLARE'
    ],
    default: 'UNKNOWN'
  },
  sni: String,   // Server Name Indication

  // Action (from PacketAction enum)
  action: {
    type: String,
    enum: ['FORWARD', 'DROP', 'INSPECT', 'LOG_ONLY'],
    default: 'FORWARD'
  },
  blockReason: String,  // If dropped: IP / APP / DOMAIN / PORT

  // Five-tuple for connection tracking
  fiveTuple: {
    srcIp: String,
    destIp: String,
    srcPort: Number,
    destPort: Number,
    protocol: String,
  }
}, { timestamps: true });

// Index for fast queries
packetSchema.index({ sessionId: 1, packetNumber: 1 });
packetSchema.index({ sessionId: 1, srcIp: 1 });
packetSchema.index({ sessionId: 1, appType: 1 });
packetSchema.index({ sessionId: 1, action: 1 });

// ─── Connection Model ─────────────────────────────────────────────────────────
// Tracks flows (ConnectionTracker / Connection struct equivalent)
const connectionSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
  fiveTuple: {
    srcIp: String,
    destIp: String,
    srcPort: Number,
    destPort: Number,
    protocol: String,
  },
  state: {
    type: String,
    enum: ['NEW', 'ESTABLISHED', 'CLASSIFIED', 'BLOCKED', 'CLOSED'],
    default: 'NEW'
  },
  appType: { type: String, default: 'UNKNOWN' },
  sni: String,
  packetsIn: { type: Number, default: 0 },
  packetsOut: { type: Number, default: 0 },
  bytesIn: { type: Number, default: 0 },
  bytesOut: { type: Number, default: 0 },
  action: { type: String, default: 'FORWARD' },
  firstSeen: Date,
  lastSeen: Date,
});

connectionSchema.index({ sessionId: 1 });

// ─── Rule Model ───────────────────────────────────────────────────────────────
// RuleManager equivalent — persisted blocking rules
const ruleSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['IP', 'APP', 'DOMAIN', 'PORT'],
    required: true
  },
  value: { type: String, required: true },  // IP, app name, domain, or port
  enabled: { type: Boolean, default: true },
  description: String,
  createdAt: { type: Date, default: Date.now },
  hitCount: { type: Number, default: 0 },   // How many times this rule blocked a packet
});

ruleSchema.index({ type: 1, value: 1 }, { unique: true });

const Session = mongoose.model('Session', sessionSchema);
const Packet = mongoose.model('Packet', packetSchema);
const Connection = mongoose.model('Connection', connectionSchema);
const Rule = mongoose.model('Rule', ruleSchema);

module.exports = { Session, Packet, Connection, Rule };
