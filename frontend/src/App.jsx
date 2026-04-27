import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import SessionsPage from './pages/SessionsPage';
import SessionDetailPage from './pages/SessionDetailPage';
import RulesPage from './pages/RulesPage';

const socket = io('http://localhost:5000');

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<SessionsPage socket={socket} />} />
            <Route path="/sessions/:id" element={<SessionDetailPage socket={socket} />} />
            <Route path="/rules" element={<RulesPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>⬡ DPI Engine</h1>
        <p>Packet Analyzer v2.0</p>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section-label">Analysis</div>
        <NavLink to="/" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} end>
          <span className="icon">◈</span> Sessions
        </NavLink>
        <div className="nav-section-label" style={{ marginTop: 12 }}>Config</div>
        <NavLink to="/rules" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <span className="icon">⊕</span> Firewall Rules
        </NavLink>
      </nav>
    </aside>
  );
}
