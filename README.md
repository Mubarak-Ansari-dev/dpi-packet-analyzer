# DPI Packet Analyzer — MERN Stack

A full-stack web application for **Deep Packet Inspection** of network traffic. Upload `.pcap` files and get an interactive dashboard with protocol analysis, application detection, connection tracking, and a firewall rule engine.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│               React Frontend (port 3000)             │
│  SessionsPage → Upload .pcap                         │
│  SessionDetailPage → Overview / Packets / Connections│
│  RulesPage → Manage firewall rules                   │
└────────────────────┬────────────────────────────────┘
                     │ REST API + Socket.IO
┌────────────────────▼────────────────────────────────┐
│             Express Backend (port 5000)              │
│                                                      │
│  POST /api/sessions/upload  ← multer file upload     │
│       │                                              │
│       ▼                                              │
│  pcapParser.js  (Custom Binary PCAP Parser)          │
│  ├── Ethernet / IPv4 / TCP / UDP parsing             │
│  ├── SNI extraction (TLS ClientHello)                │
│  ├── App classification (SNI + port heuristics)      │
│  ├── Connection tracking (5-tuple flow table)        │
│  └── Rule enforcement (IP / APP / DOMAIN / PORT)     │
│       │                                              │
│       ▼                                              │
│  MongoDB (via Mongoose)                              │
│  ├── Session    — analysis run metadata + stats      │
│  ├── Packet     — every parsed packet                │
│  ├── Connection — flow table                         │
│  └── Rule       — persisted firewall rules           │
└─────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router, Recharts |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Real-time | Socket.IO |
| File Upload | Multer |
| HTTP Client | Axios |
| Deployment | Docker, Nginx |

---

## Quick Start

### Option 1: Docker (recommended)

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- MongoDB: localhost:27017

### Option 2: Manual Setup

**Prerequisites:** Node.js 18+, MongoDB

```bash
# Terminal 1 — Start MongoDB
mongod

# Terminal 2 — Start Backend
cd backend
cp .env.example .env
npm install
npm run dev          # runs on port 5000

# Terminal 3 — Start Frontend
cd frontend
npm install
npm start            # runs on port 3000
```

---

## Features

### Sessions
- Drag & drop `.pcap` file upload (up to 100 MB)
- Real-time analysis progress via Socket.IO
- Per-session statistics dashboard
- Delete sessions and associated data

### Overview Tab
- Protocol distribution pie chart (TCP / UDP / ICMP)
- Packet action breakdown (FORWARD / DROP)
- Application distribution bar chart (YouTube, Netflix, Zoom, etc.)
- Top source & destination IPs with byte counts
- Top destination ports with service names
- Top SNI domains detected

### Packets Tab
- Paginated packet table (50 per page)
- Filter by: protocol, action, app type, IP, domain
- Click any packet to see full layer-by-layer detail:
  - Ethernet (src/dst MAC, EtherType)
  - IPv4 (IPs, protocol, TTL)
  - TCP (ports, flags, seq/ack numbers)
  - UDP (ports)
  - DPI result (app type, SNI, action, block reason)
  - Payload hex preview

### Connections Tab
- Flow table (5-tuple: src IP:port → dst IP:port + protocol)
- Per-flow stats: packets in/out, bytes transferred
- Connection states: NEW → ESTABLISHED → CLASSIFIED → BLOCKED → CLOSED
- App type and SNI per flow

### Firewall Rules
Rules are persisted in MongoDB and applied on every new analysis:

| Rule Type | Example | What it blocks |
|---|---|---|
| **IP** | `192.168.1.5` | All packets from this source IP |
| **APP** | `YOUTUBE` | Traffic classified as YouTube via SNI |
| **DOMAIN** | `*.facebook.com` | TLS connections to matching domains |
| **PORT** | `443` | All traffic to this destination port |

- Enable / disable rules without deleting
- Hit counter showing how many packets each rule blocked
- Wildcard domain support: `*.example.com`

---

## How It Works

Every `.pcap` file is parsed layer by layer:

```
Ethernet Layer  →  MAC addresses
      ↓
IPv4 Layer      →  Source IP, Destination IP, TTL
      ↓
TCP / UDP       →  Ports, flags, sequence numbers
      ↓
Payload         →  TLS ClientHello → extract SNI
      ↓
SNI / Port      →  Classify app (Google, Netflix, Zoom...)
      ↓
Rules Engine    →  FORWARD or DROP based on firewall rules
      ↓
MongoDB         →  Store packets, connections, stats
      ↓
Socket.IO       →  Push live progress to React frontend
```

---

## API Reference

### Sessions
```
GET    /api/sessions               — list all sessions
GET    /api/sessions/:id           — session detail
POST   /api/sessions/upload        — upload pcap (multipart: pcap, name?)
DELETE /api/sessions/:id           — delete session + all data
```

### Packets
```
GET    /api/packets?sessionId=&page=&limit=&protocol=&action=&appType=&search=
GET    /api/packets/:id            — single packet detail
GET    /api/packets/connections/:sessionId  — connection flow table
```

### Rules
```
GET    /api/rules
POST   /api/rules                  — { type, value, description? }
PUT    /api/rules/:id              — { enabled?, description? }
DELETE /api/rules/:id
DELETE /api/rules                  — clear all rules
```

### Stats
```
GET    /api/stats/:sessionId       — aggregated chart data
```

### Real-time Events (Socket.IO)
```
session:status      { sessionId, status }
session:progress    { sessionId, processed, progress }
session:completed   { sessionId, stats, appDistribution }
session:error       { sessionId, error }
```

---

## Project Structure

```
packet-analyzer-mern/
├── docker-compose.yml
├── README.md
├── backend/
│   ├── server.js              Express + Socket.IO entry point
│   ├── .env.example           Environment variables template
│   ├── Dockerfile
│   ├── models/
│   │   └── index.js           Mongoose schemas (Session, Packet, Connection, Rule)
│   ├── routes/
│   │   ├── sessions.js        Upload + async analysis pipeline
│   │   ├── packets.js         Packet queries + connection listing
│   │   ├── rules.js           Firewall rule CRUD
│   │   └── stats.js           MongoDB aggregation pipelines
│   └── utils/
│       └── pcapParser.js      Binary PCAP parser + DPI engine
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── public/
    │   └── index.html
    └── src/
        ├── App.jsx                   Router + sidebar layout
        ├── index.css                 Dark industrial theme
        ├── utils/
        │   └── api.js               Axios API client
        └── pages/
            ├── SessionsPage.jsx      Upload + session cards
            ├── SessionDetailPage.jsx Dashboard + packets + connections
            └── RulesPage.jsx         Firewall rule management
```

---

## Environment Variables

Create `backend/.env` from `.env.example`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/packet_analyzer
NODE_ENV=development
```

---

## Screenshots

| Sessions Page | Session Dashboard | Firewall Rules |
|---|---|---|
| Upload .pcap files | Charts + packet table | Manage blocking rules |

---

## License

MIT
