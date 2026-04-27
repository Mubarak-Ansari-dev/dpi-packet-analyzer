import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { getSession, getStats, getPackets, getConnections } from '../utils/api';

const COLORS = [
  '#00d4ff', '#00e676', '#ffc107', '#ff3b5c', '#bf5af2',
  '#ff9f0a', '#59c8e8', '#4caf50', '#e91e63', '#2196f3',
];

const APP_ICONS = {
  GOOGLE: '🔍', YOUTUBE: '▶', FACEBOOK: '👤', INSTAGRAM: '📷',
  TWITTER: '𝕏', NETFLIX: '🎬', AMAZON: '📦', MICROSOFT: '🪟',
  APPLE: '🍎', WHATSAPP: '💬', TELEGRAM: '✈', TIKTOK: '🎵',
  SPOTIFY: '🎧', ZOOM: '📹', DISCORD: '🎮', GITHUB: '⌥',
  CLOUDFLARE: '☁', HTTP: '🌐', HTTPS: '🔒', DNS: '📡',
  TLS: '🔐', QUIC: '⚡', UNKNOWN: '?',
};

export default function SessionDetailPage({ socket }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, st] = await Promise.all([getSession(id), getStats(id)]);
      setSession(s);
      setStats(st);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();

    socket.on('session:completed', ({ sessionId }) => {
      if (sessionId === id) load();
    });
    socket.on('session:progress', ({ sessionId, processed, progress }) => {
      if (sessionId === id) {
        setSession(prev => prev ? { ...prev, _progress: progress, _processed: processed } : prev);
      }
    });

    return () => { socket.off('session:completed'); socket.off('session:progress'); };
  }, [id, load, socket]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text3)', padding: 40 }}>
      <span style={{ animation: 'pulse 1s infinite' }}>◈</span> Loading session...
    </div>
  );

  if (!session) return (
    <div className="empty-state"><div className="icon">⚠</div><p>Session not found.</p></div>
  );

  const s = session.stats || {};

  return (
    <div>
      <div className="top-bar">
        <div>
          <button className="btn btn-ghost" style={{ marginBottom: 8, fontSize: 11 }} onClick={() => navigate('/')}>
            ← Back
          </button>
          <h2>{session.name}</h2>
          <div className="breadcrumb">
            <span className={`status-dot status-${session.status}`} />
            {session.status.toUpperCase()} · {session.filename}
          </div>
        </div>
      </div>

      {session.status === 'processing' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
            <span>Analyzing packets...</span>
            <span>{session._processed || 0} packets · {session._progress || 0}%</span>
          </div>
          <div className="progress-bar-wrap">
            <div className="progress-bar" style={{ width: `${session._progress || 30}%` }} />
          </div>
        </div>
      )}

      {/* Stats tiles */}
      <div className="stat-grid">
        <StatTile label="Total Packets" value={(s.totalPackets || 0).toLocaleString()} />
        <StatTile label="Total Bytes" value={fmtBytes(s.totalBytes || 0)} />
        <StatTile label="Forwarded" value={(s.forwardedPackets || 0).toLocaleString()} color="var(--green)" />
        <StatTile label="Blocked" value={(s.droppedPackets || 0).toLocaleString()} color="var(--red)" />
        <StatTile label="TCP" value={(s.tcpPackets || 0).toLocaleString()} color="var(--accent)" />
        <StatTile label="UDP" value={(s.udpPackets || 0).toLocaleString()} color="var(--orange)" />
        <StatTile label="Connections" value={(s.activeConnections || 0).toLocaleString()} color="var(--purple)" />
      </div>

      {/* Tabs */}
      <div className="tabs">
        {['overview', 'packets', 'connections'].map(t => (
          <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        ))}
      </div>

      {tab === 'overview' && stats && <OverviewTab stats={stats} />}
      {tab === 'packets' && <PacketsTab sessionId={id} />}
      {tab === 'connections' && <ConnectionsTab sessionId={id} />}
    </div>
  );
}

function StatTile({ label, value, color }) {
  return (
    <div className="stat-tile">
      <div className="label">{label}</div>
      <div className="value" style={color ? { color } : {}}>{value}</div>
    </div>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────────────────
function OverviewTab({ stats }) {
  const { charts } = stats;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
        <div style={{ color: 'var(--text)' }}>{payload[0].name || payload[0].payload.name}</div>
        <div style={{ color: 'var(--accent)' }}>{payload[0].value?.toLocaleString()}</div>
      </div>
    );
  };

  return (
    <div>
      <div className="charts-grid">
        {/* Protocol Distribution */}
        <div className="card">
          <div className="card-header"><div className="card-title">Protocol Distribution</div></div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={charts.protocolDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {charts.protocolDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Action Distribution */}
        <div className="card">
          <div className="card-header"><div className="card-title">Packet Actions</div></div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={charts.actionDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {charts.actionDistribution.map((entry, i) => {
                  const c = entry.name === 'DROP' ? '#ff3b5c' : entry.name === 'FORWARD' ? '#00e676' : COLORS[i % COLORS.length];
                  return <Cell key={i} fill={c} />;
                })}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* App Distribution */}
        {charts.appDistribution.length > 0 && (
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header"><div className="card-title">Application Distribution (via SNI / Port)</div></div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={charts.appDistribution} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text3)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="var(--accent)" radius={[3, 3, 0, 0]}>
                  {charts.appDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Source IPs */}
        <div className="card">
          <div className="card-header"><div className="card-title">Top Source IPs</div></div>
          <table>
            <thead><tr><th>IP</th><th>Packets</th><th>Bytes</th></tr></thead>
            <tbody>
              {charts.topSourceIPs.map((row, i) => (
                <tr key={i}>
                  <td className="ip">{row.ip}</td>
                  <td>{(row.packets || 0).toLocaleString()}</td>
                  <td>{fmtBytes(row.bytes || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top SNIs */}
        <div className="card">
          <div className="card-header"><div className="card-title">Top Domains (SNI)</div></div>
          {charts.topSNIs.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 12, padding: '8px 0' }}>No TLS SNI data found</div>
          ) : (
            <table>
              <thead><tr><th>Domain</th><th>Packets</th></tr></thead>
              <tbody>
                {charts.topSNIs.map((row, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--accent)' }}>{row.sni}</td>
                    <td>{(row.packets || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top Ports */}
        <div className="card">
          <div className="card-header"><div className="card-title">Top Destination Ports</div></div>
          <table>
            <thead><tr><th>Port</th><th>Service</th><th>Packets</th></tr></thead>
            <tbody>
              {charts.topPorts.map((row, i) => (
                <tr key={i}>
                  <td className="port">{row.port}</td>
                  <td style={{ color: 'var(--text3)' }}>{portName(row.port)}</td>
                  <td>{(row.packets || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* App icons summary */}
        {charts.appDistribution.length > 0 && (
          <div className="card">
            <div className="card-header"><div className="card-title">Detected Applications</div></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {charts.appDistribution.map((app, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px' }}>
                  <span style={{ fontSize: 16 }}>{APP_ICONS[app.name] || '?'}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{app.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{app.value.toLocaleString()} pkts</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Packets Tab ───────────────────────────────────────────────────────────
function PacketsTab({ sessionId }) {
  const [data, setData] = useState({ packets: [], total: 0, pages: 1 });
  const [filters, setFilters] = useState({ page: 1, limit: 50, protocol: '', action: '', appType: '', search: '' });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getPackets({ sessionId, ...filters })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sessionId, filters]);

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v, page: 1 }));
  const setPage = (p) => setFilters(f => ({ ...f, page: p }));

  return (
    <div>
      {/* Filters */}
      <div className="filters-bar">
        <input placeholder="Search IP / domain / app..." value={filters.search}
          onChange={e => setFilter('search', e.target.value)} style={{ minWidth: 220 }} />
        <select value={filters.protocol} onChange={e => setFilter('protocol', e.target.value)}>
          <option value="">All Protocols</option>
          <option>TCP</option><option>UDP</option><option>ICMP</option><option>OTHER</option>
        </select>
        <select value={filters.action} onChange={e => setFilter('action', e.target.value)}>
          <option value="">All Actions</option>
          <option>FORWARD</option><option>DROP</option><option>INSPECT</option><option>LOG_ONLY</option>
        </select>
        <select value={filters.appType} onChange={e => setFilter('appType', e.target.value)}>
          <option value="">All Apps</option>
          {['HTTP','HTTPS','DNS','TLS','QUIC','GOOGLE','YOUTUBE','FACEBOOK','NETFLIX','ZOOM','DISCORD','GITHUB'].map(a => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <span style={{ color: 'var(--text3)', fontSize: 11, marginLeft: 'auto' }}>
          {data.total.toLocaleString()} packets
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Packet Table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Time</th><th>Src IP</th><th>Dst IP</th>
                    <th>Proto</th><th>Ports</th><th>App</th><th>Action</th><th>Bytes</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>Loading...</td></tr>
                  ) : data.packets.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>No packets found</td></tr>
                  ) : data.packets.map(p => (
                    <tr key={p._id} onClick={() => setSelected(selected?._id === p._id ? null : p)}
                      style={{ cursor: 'pointer', background: selected?._id === p._id ? 'rgba(0,212,255,0.05)' : '' }}>
                      <td style={{ color: 'var(--text3)' }}>{p.packetNumber}</td>
                      <td style={{ color: 'var(--text3)', fontSize: 11 }}>{fmtTime(p.capturedAt)}</td>
                      <td className="ip">{p.srcIp || '—'}</td>
                      <td className="ip">{p.destIp || '—'}</td>
                      <td><span className={`badge badge-${p.protocol}`}>{p.protocol || '—'}</span></td>
                      <td className="port">{p.srcPort || '—'} → {p.destPort || '—'}</td>
                      <td>
                        {p.appType && p.appType !== 'UNKNOWN'
                          ? <span className={`badge badge-${p.appType}`}>{p.appType}</span>
                          : <span style={{ color: 'var(--text3)' }}>—</span>
                        }
                      </td>
                      <td><span className={`badge badge-${p.action}`}>{p.action}</span></td>
                      <td style={{ color: 'var(--text3)' }}>{p.payloadLength || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={filters.page} pages={data.pages} setPage={setPage} />
        </div>

        {/* Packet Detail Panel */}
        {selected && <PacketDetail packet={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}

function PacketDetail({ packet: p, onClose }) {
  return (
    <div style={{ width: 280, flexShrink: 0 }}>
      <div className="card" style={{ position: 'sticky', top: 0 }}>
        <div className="card-header">
          <div className="card-title">Packet #{p.packetNumber}</div>
          <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Section title="Ethernet">
            <KV k="Src MAC" v={p.srcMac} />
            <KV k="Dst MAC" v={p.destMac} />
            <KV k="EtherType" v={p.etherType} />
          </Section>
          {p.hasIp && (
            <Section title="IP">
              <KV k="Src IP" v={p.srcIp} color="var(--accent)" />
              <KV k="Dst IP" v={p.destIp} color="var(--accent)" />
              <KV k="Protocol" v={p.protocol} />
              <KV k="TTL" v={p.ttl} />
            </Section>
          )}
          {p.hasTcp && (
            <Section title="TCP">
              <KV k="Src Port" v={p.srcPort} color="var(--yellow)" />
              <KV k="Dst Port" v={p.destPort} color="var(--yellow)" />
              <KV k="Flags" v={p.tcpFlags?.join(', ') || '—'} />
              <KV k="Seq" v={p.seqNumber} />
              <KV k="Ack" v={p.ackNumber} />
            </Section>
          )}
          {p.hasUdp && (
            <Section title="UDP">
              <KV k="Src Port" v={p.srcPort} color="var(--yellow)" />
              <KV k="Dst Port" v={p.destPort} color="var(--yellow)" />
            </Section>
          )}
          <Section title="DPI">
            <KV k="App" v={p.appType} />
            {p.sni && <KV k="SNI" v={p.sni} color="var(--accent)" />}
            <KV k="Action" v={p.action} color={p.action === 'DROP' ? 'var(--red)' : 'var(--green)'} />
            {p.blockReason && <KV k="Reason" v={p.blockReason} color="var(--red)" />}
          </Section>
          {p.payloadLength > 0 && (
            <Section title="Payload">
              <KV k="Length" v={`${p.payloadLength} bytes`} />
              {p.payloadPreview && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>HEX PREVIEW</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text2)', wordBreak: 'break-all', background: 'var(--bg)', padding: 6, borderRadius: 4 }}>
                    {p.payloadPreview.match(/.{1,2}/g)?.join(' ')}
                  </div>
                </div>
              )}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 600 }}>[{title}]</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
    </div>
  );
}

function KV({ k, v, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: 'var(--text3)', fontSize: 11, flexShrink: 0 }}>{k}</span>
      <span style={{ color: color || 'var(--text2)', fontSize: 11, textAlign: 'right', wordBreak: 'break-all' }}>{v ?? '—'}</span>
    </div>
  );
}

// ─── Connections Tab ───────────────────────────────────────────────────────
function ConnectionsTab({ sessionId }) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getConnections(sessionId).then(setConnections).catch(console.error).finally(() => setLoading(false));
  }, [sessionId]);

  const filtered = connections.filter(c =>
    !search || c.fiveTuple?.srcIp?.includes(search) || c.fiveTuple?.destIp?.includes(search) ||
    c.sni?.includes(search) || c.appType?.includes(search)
  );

  return (
    <div>
      <div className="filters-bar">
        <input placeholder="Search IP / domain / app..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ minWidth: 220 }} />
        <span style={{ color: 'var(--text3)', fontSize: 11, marginLeft: 'auto' }}>
          {filtered.length.toLocaleString()} connections
        </span>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Src IP:Port</th><th>Dst IP:Port</th><th>Proto</th>
                <th>App</th><th>SNI</th><th>State</th>
                <th>Pkts ↓</th><th>Pkts ↑</th><th>Bytes ↓</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>No connections found</td></tr>
              ) : filtered.map((c, i) => {
                const t = c.fiveTuple || {};
                return (
                  <tr key={i}>
                    <td><span className="ip">{t.srcIp}</span><span className="port">:{t.srcPort}</span></td>
                    <td><span className="ip">{t.destIp}</span><span className="port">:{t.destPort}</span></td>
                    <td><span className={`badge badge-${t.protocol}`}>{t.protocol}</span></td>
                    <td>{c.appType && c.appType !== 'UNKNOWN' ? <span className={`badge badge-${c.appType}`}>{c.appType}</span> : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                    <td style={{ color: 'var(--accent)', fontSize: 11 }}>{c.sni || '—'}</td>
                    <td><span className={`badge badge-${c.state}`}>{c.state}</span></td>
                    <td style={{ color: 'var(--text3)' }}>{(c.packetsIn || 0).toLocaleString()}</td>
                    <td style={{ color: 'var(--text3)' }}>{(c.packetsOut || 0).toLocaleString()}</td>
                    <td style={{ color: 'var(--text3)' }}>{fmtBytes(c.bytesIn || 0)}</td>
                    <td><span className={`badge badge-${c.action}`}>{c.action}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Pagination ────────────────────────────────────────────────────────────
function Pagination({ page, pages, setPage }) {
  if (pages <= 1) return null;
  const nums = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) nums.push(i);
  return (
    <div className="pagination">
      <button className="page-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
      <button className="page-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button>
      {nums.map(n => (
        <button key={n} className={`page-btn${n === page ? ' active' : ''}`} onClick={() => setPage(n)}>{n}</button>
      ))}
      <button className="page-btn" disabled={page === pages} onClick={() => setPage(page + 1)}>›</button>
      <button className="page-btn" disabled={page === pages} onClick={() => setPage(pages)}>»</button>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function fmtBytes(b) {
  if (b === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

function fmtTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString();
}

function portName(port) {
  const map = { 80: 'HTTP', 443: 'HTTPS', 53: 'DNS', 22: 'SSH', 21: 'FTP', 25: 'SMTP', 110: 'POP3', 143: 'IMAP', 3306: 'MySQL', 5432: 'Postgres', 6379: 'Redis', 853: 'DNS-TLS', 8080: 'HTTP-alt' };
  return map[port] || '';
}
