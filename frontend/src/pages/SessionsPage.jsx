import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSessions, uploadPcap, deleteSession } from '../utils/api';

export default function SessionsPage({ socket }) {
  const [sessions, setSessions] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchSessions = useCallback(async () => {
    try {
      const data = await getSessions();
      setSessions(data);
    } catch (e) {
      setError('Failed to fetch sessions');
    }
  }, []);

  useEffect(() => {
    fetchSessions();

    socket.on('session:status', ({ sessionId, status }) => {
      setSessions(prev =>
        prev.map(s => s._id === sessionId ? { ...s, status } : s)
      );
    });
    socket.on('session:completed', ({ sessionId, stats, appDistribution }) => {
      setSessions(prev =>
        prev.map(s => s._id === sessionId ? { ...s, status: 'completed', stats, appDistribution } : s)
      );
    });
    socket.on('session:error', ({ sessionId, error }) => {
      setSessions(prev =>
        prev.map(s => s._id === sessionId ? { ...s, status: 'error', error } : s)
      );
    });

    return () => {
      socket.off('session:status');
      socket.off('session:completed');
      socket.off('session:error');
    };
  }, [socket, fetchSessions]);

  const handleFile = async (file) => {
    if (!file || !file.name.endsWith('.pcap')) {
      setError('Please upload a valid .pcap file');
      return;
    }
    setError('');
    setUploading(true);
    setUploadProgress(0);
    try {
      const result = await uploadPcap(file, file.name, (e) => {
        if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      });
      await fetchSessions();
      navigate(`/sessions/${result.sessionId}`);
    } catch (e) {
      setError(e.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this session?')) return;
    await deleteSession(id);
    setSessions(prev => prev.filter(s => s._id !== id));
  };

  const fmtDate = (d) => new Date(d).toLocaleString();
  const fmtNum = (n) => (n || 0).toLocaleString();

  return (
    <div>
      <div className="top-bar">
        <div>
          <h2>Sessions</h2>
          <div className="breadcrumb">Upload .pcap files for Deep Packet Inspection analysis</div>
        </div>
        <span style={{ color: 'var(--text3)', fontSize: 11 }}>{sessions.length} sessions</span>
      </div>

      {/* Upload Zone */}
      <div
        className={`upload-zone${dragOver ? ' drag-over' : ''}`}
        style={{ marginBottom: 24 }}
        onClick={() => document.getElementById('pcap-input').click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          id="pcap-input" type="file" accept=".pcap" style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />
        {uploading ? (
          <div>
            <div className="upload-icon">⟳</div>
            <h3>Uploading & Analyzing...</h3>
            <div style={{ marginTop: 16, maxWidth: 300, margin: '16px auto 0' }}>
              <div className="progress-bar-wrap">
                <div className="progress-bar" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p style={{ marginTop: 6, color: 'var(--text3)' }}>{uploadProgress}%</p>
            </div>
          </div>
        ) : (
          <>
            <div className="upload-icon">⬆</div>
            <h3>Drop a .pcap file here</h3>
            <p>or click to browse — max 100MB</p>
          </>
        )}
      </div>

      {error && (
        <div style={{ background: 'rgba(255,59,92,0.08)', border: '1px solid rgba(255,59,92,0.2)', borderRadius: 6, padding: '10px 14px', marginBottom: 16, color: 'var(--red)', fontSize: 12 }}>
          ⚠ {error}
        </div>
      )}

      {/* Sessions Grid */}
      {sessions.length === 0 ? (
        <div className="empty-state">
          <div className="icon">◈</div>
          <p>No sessions yet. Upload a .pcap file to get started.</p>
        </div>
      ) : (
        <div className="session-grid">
          {sessions.map(s => (
            <div key={s._id} className="session-card" onClick={() => navigate(`/sessions/${s._id}`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 title={s.name}>{s.name}</h3>
                <button
                  className="btn btn-danger"
                  style={{ padding: '3px 8px', fontSize: 11 }}
                  onClick={e => handleDelete(e, s._id)}
                >✕</button>
              </div>
              <div className="meta">
                <span className={`status-dot status-${s.status}`} />
                {s.status.toUpperCase()} · {fmtDate(s.createdAt)}
              </div>
              {s.status === 'processing' && (
                <div className="progress-bar-wrap" style={{ marginBottom: 10 }}>
                  <div className="progress-bar" style={{ width: '60%', animation: 'pulse 1.5s infinite' }} />
                </div>
              )}
              {s.stats && (
                <div className="mini-stats">
                  <div className="mini-stat">Packets: <span>{fmtNum(s.stats.totalPackets)}</span></div>
                  <div className="mini-stat">Dropped: <span style={{ color: s.stats.droppedPackets > 0 ? 'var(--red)' : 'var(--green)' }}>{fmtNum(s.stats.droppedPackets)}</span></div>
                  <div className="mini-stat">Flows: <span>{fmtNum(s.stats.activeConnections)}</span></div>
                </div>
              )}
              {s.status === 'error' && (
                <div style={{ color: 'var(--red)', fontSize: 11, marginTop: 8 }}>⚠ {s.error}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
