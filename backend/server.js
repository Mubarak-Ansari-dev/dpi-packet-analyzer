require('dotenv').config();
const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const cors         = require('cors');
const path         = require('path');
const fs           = require('fs');

const connectDB      = require('./config/db');
const errorHandler   = require('./middleware/errorHandler');

const sessionRoutes  = require('./routes/session.routes');
const packetRoutes   = require('./routes/packet.routes');
const ruleRoutes     = require('./routes/rule.routes');
const statsRoutes    = require('./routes/stats.routes');

// ─── App Setup ────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.set('io', io); // make socket accessible in controllers

// ─── Ensure uploads folder exists ────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/sessions', sessionRoutes);
app.use('/api/packets',  packetRoutes);
app.use('/api/rules',    ruleRoutes);
app.use('/api/stats',    statsRoutes);

app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', timestamp: new Date() })
);

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
});
