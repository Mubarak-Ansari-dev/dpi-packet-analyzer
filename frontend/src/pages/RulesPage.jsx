import React, { useState, useEffect } from 'react';
import { getRules, createRule, deleteRule, updateRule, clearRules } from '../utils/api';

const RULE_TYPES = ['IP', 'APP', 'DOMAIN', 'PORT'];

const APP_OPTIONS = [
  'HTTP', 'HTTPS', 'DNS', 'TLS', 'QUIC',
  'GOOGLE', 'FACEBOOK', 'YOUTUBE', 'TWITTER', 'INSTAGRAM',
  'NETFLIX', 'AMAZON', 'MICROSOFT', 'APPLE', 'WHATSAPP',
  'TELEGRAM', 'TIKTOK', 'SPOTIFY', 'ZOOM', 'DISCORD',
  'GITHUB', 'CLOUDFLARE',
];

const TYPE_PLACEHOLDERS = {
  IP: '192.168.1.100',
  APP: 'Select application',
  DOMAIN: '*.facebook.com',
  PORT: '443',
};

const TYPE_HINTS = {
  IP: 'Block all packets from this source IP address',
  APP: 'Block application detected via SNI or port heuristics',
  DOMAIN: 'Block by domain name — supports wildcards (*.example.com)',
  PORT: 'Block all packets to this destination port',
};

export default function RulesPage() {
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState({ type: 'IP', value: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const data = await getRules();
      setRules(data);
    } catch (e) {
      setError('Failed to load rules');
    }
  };

  const handleCreate = async () => {
    if (!form.value.trim()) { setError('Value is required'); return; }
    setError(''); setSuccess('');
    setLoading(true);
    try {
      const rule = await createRule(form);
      setRules(prev => [rule, ...prev]);
      setForm(f => ({ ...f, value: '', description: '' }));
      setSuccess(`Rule created: Block ${form.type} "${form.value}"`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to create rule');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this rule?')) return;
    await deleteRule(id);
    setRules(prev => prev.filter(r => r._id !== id));
  };

  const handleToggle = async (rule) => {
    const updated = await updateRule(rule._id, { enabled: !rule.enabled });
    setRules(prev => prev.map(r => r._id === rule._id ? updated : r));
  };

  const handleClearAll = async () => {
    if (!window.confirm('Delete ALL rules? This cannot be undone.')) return;
    await clearRules();
    setRules([]);
  };

  const grouped = RULE_TYPES.reduce((acc, type) => {
    acc[type] = rules.filter(r => r.type === type);
    return acc;
  }, {});

  const totalHits = rules.reduce((s, r) => s + (r.hitCount || 0), 0);

  return (
    <div>
      <div className="top-bar">
        <div>
          <h2>Firewall Rules</h2>
          <div className="breadcrumb">Block IPs, applications, domains, and ports — applied on next analysis</div>
        </div>
        {rules.length > 0 && (
          <button className="btn btn-danger" onClick={handleClearAll}>Clear All Rules</button>
        )}
      </div>

      {/* Stats banner */}
      {rules.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <StatTile label="Total Rules" value={rules.length} />
          <StatTile label="Active" value={rules.filter(r => r.enabled).length} color="var(--green)" />
          <StatTile label="Disabled" value={rules.filter(r => !r.enabled).length} color="var(--text3)" />
          <StatTile label="Total Hits" value={totalHits.toLocaleString()} color="var(--red)" />
        </div>
      )}

      {/* Rule Builder */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Add Rule</div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Rule Type</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, value: '' }))}>
              {RULE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
            <label>Value</label>
            {form.type === 'APP' ? (
              <select value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}>
                <option value="">Select application...</option>
                {APP_OPTIONS.map(a => <option key={a}>{a}</option>)}
              </select>
            ) : (
              <input
                placeholder={TYPE_PLACEHOLDERS[form.type]}
                value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            )}
          </div>

          <div className="form-group" style={{ flex: 2, minWidth: 200 }}>
            <label>Description (optional)</label>
            <input
              placeholder="e.g. Block office social media"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label style={{ visibility: 'hidden' }}>Add</label>
            <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
              {loading ? '...' : '⊕ Add Rule'}
            </button>
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: -8 }}>
          💡 {TYPE_HINTS[form.type]}
        </div>

        {error && (
          <div style={{ background: 'rgba(255,59,92,0.08)', border: '1px solid rgba(255,59,92,0.2)', borderRadius: 6, padding: '8px 12px', marginTop: 12, color: 'var(--red)', fontSize: 12 }}>
            ⚠ {error}
          </div>
        )}
        {success && (
          <div style={{ background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)', borderRadius: 6, padding: '8px 12px', marginTop: 12, color: 'var(--green)', fontSize: 12 }}>
            ✓ {success}
          </div>
        )}
      </div>

      {/* Rules by Type */}
      {rules.length === 0 ? (
        <div className="empty-state">
          <div className="icon">⊕</div>
          <p>No rules yet. Add a rule above to block IPs, apps, domains, or ports.</p>
          <p style={{ marginTop: 8, fontSize: 11 }}>Rules are applied the next time you analyze a .pcap file.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {RULE_TYPES.filter(type => grouped[type].length > 0).map(type => (
            <div key={type} className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="card-title">
                    <span className={`badge badge-${type}`}>{type}</span>
                  </div>
                  <span style={{ color: 'var(--text3)', fontSize: 11 }}>{grouped[type].length} rule{grouped[type].length !== 1 ? 's' : ''}</span>
                </div>
                <span style={{ color: 'var(--text3)', fontSize: 11 }}>
                  {grouped[type].reduce((s, r) => s + (r.hitCount || 0), 0).toLocaleString()} hits
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Value</th><th>Description</th><th>Hits</th><th>Status</th><th>Created</th><th></th></tr>
                  </thead>
                  <tbody>
                    {grouped[type].map(rule => (
                      <tr key={rule._id} style={{ opacity: rule.enabled ? 1 : 0.45 }}>
                        <td style={{ fontFamily: 'var(--font-mono)', color: rule.enabled ? 'var(--red)' : 'var(--text3)', fontWeight: 600 }}>
                          {rule.value}
                        </td>
                        <td style={{ color: 'var(--text3)' }}>{rule.description || '—'}</td>
                        <td>
                          {rule.hitCount > 0
                            ? <span style={{ color: 'var(--red)', fontWeight: 600 }}>{rule.hitCount.toLocaleString()}</span>
                            : <span style={{ color: 'var(--text3)' }}>0</span>
                          }
                        </td>
                        <td>
                          <button
                            onClick={() => handleToggle(rule)}
                            style={{
                              background: rule.enabled ? 'rgba(0,230,118,0.1)' : 'rgba(75,90,110,0.2)',
                              color: rule.enabled ? 'var(--green)' : 'var(--text3)',
                              border: `1px solid ${rule.enabled ? 'rgba(0,230,118,0.25)' : 'var(--border)'}`,
                              borderRadius: 4,
                              padding: '3px 10px',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {rule.enabled ? 'ACTIVE' : 'DISABLED'}
                          </button>
                        </td>
                        <td style={{ color: 'var(--text3)', fontSize: 11 }}>
                          {new Date(rule.createdAt).toLocaleDateString()}
                        </td>
                        <td>
                          <button className="btn btn-danger" style={{ padding: '3px 8px', fontSize: 11 }}
                            onClick={() => handleDelete(rule._id)}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, color }) {
  return (
    <div className="stat-tile">
      <div className="label">{label}</div>
      <div className="value" style={color ? { color, fontSize: 22 } : { fontSize: 22 }}>{value}</div>
    </div>
  );
}
