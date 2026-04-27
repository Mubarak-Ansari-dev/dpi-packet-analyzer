/**
 * PCAP Parser Utility
 * JavaScript equivalent of the C++ PacketParser + PcapReader + DPI classification
 * Parses binary .pcap files and returns structured packet data
 */

const fs = require('fs');

// ─── Protocol constants (mirrors C++ namespace Protocol) ───────────────────
const PROTO = { ICMP: 1, TCP: 6, UDP: 17 };
const ETHER_TYPE = { IPv4: 0x0800, IPv6: 0x86DD, ARP: 0x0806 };
const TCP_FLAGS = { FIN: 0x01, SYN: 0x02, RST: 0x04, PSH: 0x08, ACK: 0x10, URG: 0x20 };

// ─── AppType detection (mirrors sniToAppType in C++) ──────────────────────
const SNI_MAP = {
  google: 'GOOGLE', youtube: 'YOUTUBE', facebook: 'FACEBOOK', instagram: 'INSTAGRAM',
  twitter: 'TWITTER', netflix: 'NETFLIX', amazon: 'AMAZON', microsoft: 'MICROSOFT',
  apple: 'APPLE', whatsapp: 'WHATSAPP', telegram: 'TELEGRAM', tiktok: 'TIKTOK',
  spotify: 'SPOTIFY', zoom: 'ZOOM', discord: 'DISCORD', github: 'GITHUB',
  cloudflare: 'CLOUDFLARE',
};

function sniToAppType(sni) {
  if (!sni) return 'UNKNOWN';
  const lower = sni.toLowerCase();
  for (const [key, val] of Object.entries(SNI_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 'TLS';
}

function protoNumToString(n) {
  if (n === PROTO.TCP) return 'TCP';
  if (n === PROTO.UDP) return 'UDP';
  if (n === PROTO.ICMP) return 'ICMP';
  return 'OTHER';
}

function etherTypeToString(t) {
  if (t === ETHER_TYPE.IPv4) return 'IPv4';
  if (t === ETHER_TYPE.IPv6) return 'IPv6';
  if (t === ETHER_TYPE.ARP) return 'ARP';
  return `0x${t.toString(16).padStart(4, '0')}`;
}

function macToString(buf, offset) {
  return Array.from(buf.slice(offset, offset + 6))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(':');
}

function ipToString(buf, offset) {
  return `${buf[offset]}.${buf[offset+1]}.${buf[offset+2]}.${buf[offset+3]}`;
}

function parseTcpFlags(flags) {
  const names = [];
  if (flags & TCP_FLAGS.SYN) names.push('SYN');
  if (flags & TCP_FLAGS.ACK) names.push('ACK');
  if (flags & TCP_FLAGS.FIN) names.push('FIN');
  if (flags & TCP_FLAGS.RST) names.push('RST');
  if (flags & TCP_FLAGS.PSH) names.push('PSH');
  if (flags & TCP_FLAGS.URG) names.push('URG');
  return names;
}

/**
 * Try to extract SNI from TLS ClientHello payload
 * Mirrors sni_extractor.cpp logic
 */
function extractSNI(payload) {
  try {
    if (!payload || payload.length < 5) return null;
    // TLS record: type=0x16 (handshake), version, length
    if (payload[0] !== 0x16) return null;
    // Handshake type=0x01 (ClientHello)
    if (payload[5] !== 0x01) return null;
    
    let i = 43; // Skip fixed header fields
    if (i >= payload.length) return null;
    
    const sessionIdLen = payload[i++];
    i += sessionIdLen;
    if (i + 2 >= payload.length) return null;
    
    const cipherSuitesLen = (payload[i] << 8) | payload[i + 1];
    i += 2 + cipherSuitesLen;
    if (i >= payload.length) return null;
    
    const compressionLen = payload[i++];
    i += compressionLen;
    if (i + 2 >= payload.length) return null;
    
    const extLen = (payload[i] << 8) | payload[i + 1];
    i += 2;
    const extEnd = i + extLen;
    
    while (i + 4 <= extEnd && i + 4 <= payload.length) {
      const extType = (payload[i] << 8) | payload[i + 1];
      const extDataLen = (payload[i + 2] << 8) | payload[i + 3];
      i += 4;
      
      if (extType === 0x0000) { // SNI extension
        if (i + 5 <= payload.length) {
          const nameLen = (payload[i + 3] << 8) | payload[i + 4];
          if (i + 5 + nameLen <= payload.length) {
            return payload.slice(i + 5, i + 5 + nameLen).toString('ascii');
          }
        }
      }
      i += extDataLen;
    }
  } catch {}
  return null;
}

/**
 * Classify app by port (simple heuristic, mirrors fast_path.cpp logic)
 */
function classifyByPort(dstPort, hasTcp, hasUdp) {
  if (dstPort === 80 || dstPort === 8080) return 'HTTP';
  if (dstPort === 443) return 'HTTPS';
  if (dstPort === 53) return 'DNS';
  if (dstPort === 853) return 'TLS'; // DNS over TLS
  if (dstPort === 443 && hasUdp) return 'QUIC';
  return 'UNKNOWN';
}

/**
 * Parse a single packet buffer (Ethernet frame)
 * Mirrors PacketParser::parse() in C++
 */
function parsePacket(buf, tsec, tusec, pktNum) {
  const result = {
    packetNumber: pktNum,
    timestampSec: tsec,
    timestampUsec: tusec,
    capturedAt: new Date(tsec * 1000 + Math.floor(tusec / 1000)),
    // defaults
    srcMac: '', destMac: '', etherType: '',
    hasIp: false, hasTcp: false, hasUdp: false,
    ipVersion: 0, srcIp: '', destIp: '', protocol: '', ttl: 0,
    srcPort: 0, destPort: 0,
    tcpFlags: [], seqNumber: 0, ackNumber: 0,
    payloadLength: 0, payloadPreview: '',
    appType: 'UNKNOWN', sni: null, action: 'FORWARD', blockReason: null,
    fiveTuple: {}
  };

  if (buf.length < 14) return result;

  // ── Ethernet Layer ──
  result.destMac = macToString(buf, 0);
  result.srcMac = macToString(buf, 6);
  const etherTypeNum = buf.readUInt16BE(12);
  result.etherType = etherTypeToString(etherTypeNum);

  if (etherTypeNum !== ETHER_TYPE.IPv4) return result;

  // ── IPv4 Layer ──
  const ipStart = 14;
  if (buf.length < ipStart + 20) return result;
  result.hasIp = true;
  result.ipVersion = (buf[ipStart] >> 4) & 0xF;
  const ihl = (buf[ipStart] & 0xF) * 4;
  result.ttl = buf[ipStart + 8];
  const protoNum = buf[ipStart + 9];
  result.protocol = protoNumToString(protoNum);
  result.srcIp = ipToString(buf, ipStart + 12);
  result.destIp = ipToString(buf, ipStart + 16);

  const transportStart = ipStart + ihl;

  // ── TCP Layer ──
  if (protoNum === PROTO.TCP && buf.length >= transportStart + 20) {
    result.hasTcp = true;
    result.srcPort = buf.readUInt16BE(transportStart);
    result.destPort = buf.readUInt16BE(transportStart + 2);
    result.seqNumber = buf.readUInt32BE(transportStart + 4);
    result.ackNumber = buf.readUInt32BE(transportStart + 8);
    const dataOffset = ((buf[transportStart + 12] >> 4) & 0xF) * 4;
    result.tcpFlags = parseTcpFlags(buf[transportStart + 13]);
    const payloadStart = transportStart + dataOffset;
    const payload = buf.slice(payloadStart);
    result.payloadLength = payload.length;
    result.payloadPreview = payload.slice(0, 32).toString('hex');

    // SNI extraction from TLS
    const sni = extractSNI(payload);
    if (sni) {
      result.sni = sni;
      result.appType = sniToAppType(sni);
    } else {
      result.appType = classifyByPort(result.destPort, true, false);
    }
  }

  // ── UDP Layer ──
  else if (protoNum === PROTO.UDP && buf.length >= transportStart + 8) {
    result.hasUdp = true;
    result.srcPort = buf.readUInt16BE(transportStart);
    result.destPort = buf.readUInt16BE(transportStart + 2);
    const payloadStart = transportStart + 8;
    const payload = buf.slice(payloadStart);
    result.payloadLength = payload.length;
    result.payloadPreview = payload.slice(0, 32).toString('hex');
    result.appType = classifyByPort(result.destPort, false, true);
  }

  result.fiveTuple = {
    srcIp: result.srcIp,
    destIp: result.destIp,
    srcPort: result.srcPort,
    destPort: result.destPort,
    protocol: result.protocol,
  };

  return result;
}

/**
 * Read and parse a PCAP file
 * Mirrors PcapReader class in C++
 * Returns { packets, globalHeader }
 */
async function parsePcapFile(filepath, rules = [], onProgress = null) {
  return new Promise((resolve, reject) => {
    const fd = fs.openSync(filepath, 'r');
    const headerBuf = Buffer.alloc(24);
    fs.readSync(fd, headerBuf, 0, 24, 0);

    const magic = headerBuf.readUInt32LE(0);
    const isLittleEndian = magic === 0xa1b2c3d4;
    const isBigEndian = magic === 0xd4c3b2a1;

    if (!isLittleEndian && !isBigEndian) {
      fs.closeSync(fd);
      return reject(new Error('Not a valid PCAP file'));
    }

    const readU16 = (buf, off) => isLittleEndian ? buf.readUInt16LE(off) : buf.readUInt16BE(off);
    const readU32 = (buf, off) => isLittleEndian ? buf.readUInt32LE(off) : buf.readUInt32BE(off);

    const globalHeader = {
      versionMajor: readU16(headerBuf, 4),
      versionMinor: readU16(headerBuf, 6),
      snaplen: readU32(headerBuf, 16),
      network: readU32(headerBuf, 20),
    };

    const stats = { fileSize: fs.statSync(filepath).size };
    const packets = [];
    const connections = new Map();
    const blockedIps = new Set(rules.filter(r => r.type === 'IP').map(r => r.value));
    const blockedPorts = new Set(rules.filter(r => r.type === 'PORT').map(r => parseInt(r.value)));
    const blockedApps = new Set(rules.filter(r => r.type === 'APP').map(r => r.value));
    const blockedDomains = rules.filter(r => r.type === 'DOMAIN').map(r => r.value);

    let pos = 24;
    let pktNum = 0;
    const pktHeaderBuf = Buffer.alloc(16);

    try {
      while (true) {
        const bytesRead = fs.readSync(fd, pktHeaderBuf, 0, 16, pos);
        if (bytesRead < 16) break;

        const tsec = readU32(pktHeaderBuf, 0);
        const tusec = readU32(pktHeaderBuf, 4);
        const capLen = readU32(pktHeaderBuf, 8);
        // const origLen = readU32(pktHeaderBuf, 12); // unused

        pos += 16;
        if (capLen === 0 || capLen > 65535) break;

        const pktBuf = Buffer.alloc(capLen);
        const r2 = fs.readSync(fd, pktBuf, 0, capLen, pos);
        if (r2 < capLen) break;
        pos += capLen;
        pktNum++;

        const parsed = parsePacket(pktBuf, tsec, tusec, pktNum);

        // ── Apply Rules (mirrors RuleManager::shouldBlock) ──
        let blocked = false;
        if (parsed.srcIp && blockedIps.has(parsed.srcIp)) {
          parsed.action = 'DROP'; parsed.blockReason = `Blocked IP: ${parsed.srcIp}`; blocked = true;
        } else if (parsed.destPort && blockedPorts.has(parsed.destPort)) {
          parsed.action = 'DROP'; parsed.blockReason = `Blocked Port: ${parsed.destPort}`; blocked = true;
        } else if (parsed.appType && blockedApps.has(parsed.appType)) {
          parsed.action = 'DROP'; parsed.blockReason = `Blocked App: ${parsed.appType}`; blocked = true;
        } else if (parsed.sni) {
          const matchedDomain = blockedDomains.find(d => {
            if (d.startsWith('*.')) return parsed.sni.endsWith(d.slice(1));
            return parsed.sni === d || parsed.sni.endsWith('.' + d);
          });
          if (matchedDomain) {
            parsed.action = 'DROP'; parsed.blockReason = `Blocked Domain: ${matchedDomain}`; blocked = true;
          }
        }

        // ── Connection Tracking (mirrors ConnectionTracker) ──
        if (parsed.hasIp && (parsed.hasTcp || parsed.hasUdp)) {
          const key = `${parsed.srcIp}:${parsed.srcPort}-${parsed.destIp}:${parsed.destPort}-${parsed.protocol}`;
          const revKey = `${parsed.destIp}:${parsed.destPort}-${parsed.srcIp}:${parsed.srcPort}-${parsed.protocol}`;

          let conn = connections.get(key) || connections.get(revKey);
          const isOutbound = !connections.has(revKey);

          if (!conn) {
            conn = {
              fiveTuple: parsed.fiveTuple,
              state: 'NEW',
              appType: parsed.appType || 'UNKNOWN',
              sni: parsed.sni,
              packetsIn: 0, packetsOut: 0,
              bytesIn: 0, bytesOut: 0,
              action: parsed.action,
              firstSeen: parsed.capturedAt,
              lastSeen: parsed.capturedAt,
            };
            connections.set(key, conn);
          }

          // Update connection
          if (isOutbound) { conn.packetsOut++; conn.bytesOut += parsed.payloadLength; }
          else { conn.packetsIn++; conn.bytesIn += parsed.payloadLength; }
          conn.lastSeen = parsed.capturedAt;
          if (parsed.appType !== 'UNKNOWN') conn.appType = parsed.appType;
          if (parsed.sni) conn.sni = parsed.sni;
          if (blocked) conn.state = 'BLOCKED';
          else if (conn.state === 'NEW') conn.state = 'ESTABLISHED';
          if (parsed.appType !== 'UNKNOWN') conn.state = 'CLASSIFIED';
        }

        packets.push(parsed);

        if (onProgress && pktNum % 100 === 0) {
          onProgress({ processed: pktNum, bytesRead: pos, totalBytes: stats.fileSize });
        }
      }
    } catch (e) {
      // EOF or parse error — stop reading
    }

    fs.closeSync(fd);
    resolve({
      packets,
      connections: Array.from(connections.values()),
      globalHeader,
      totalPackets: pktNum,
    });
  });
}

module.exports = { parsePcapFile };
