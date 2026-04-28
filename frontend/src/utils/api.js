import axios from 'axios';

const API = axios.create({ 
  baseURL: process.env.REACT_APP_API_URL 
    ? `${process.env.REACT_APP_API_URL}/api` 
    : '/api' 
});

// ── Sessions ────────────────────────────────────────────────────────────────
export const getSessions = () => API.get('/sessions').then(r => r.data);
export const getSession = (id) => API.get(`/sessions/${id}`).then(r => r.data);
export const deleteSession = (id) => API.delete(`/sessions/${id}`).then(r => r.data);
export const uploadPcap = (file, name, onProgress) => {
  const fd = new FormData();
  fd.append('pcap', file);
  if (name) fd.append('name', name);
  return API.post('/sessions/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
  }).then(r => r.data);
};

// ── Packets ─────────────────────────────────────────────────────────────────
export const getPackets = (params) => API.get('/packets', { params }).then(r => r.data);
export const getPacket = (id) => API.get(`/packets/${id}`).then(r => r.data);
export const getConnections = (sessionId) =>
  API.get(`/packets/connections/${sessionId}`).then(r => r.data);

// ── Rules ───────────────────────────────────────────────────────────────────
export const getRules = () => API.get('/rules').then(r => r.data);
export const createRule = (data) => API.post('/rules', data).then(r => r.data);
export const updateRule = (id, data) => API.put(`/rules/${id}`, data).then(r => r.data);
export const deleteRule = (id) => API.delete(`/rules/${id}`).then(r => r.data);
export const clearRules = () => API.delete('/rules').then(r => r.data);

// ── Stats ───────────────────────────────────────────────────────────────────
export const getStats = (sessionId) => API.get(`/stats/${sessionId}`).then(r => r.data);
