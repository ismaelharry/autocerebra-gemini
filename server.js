require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();

// ── Security ──────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate Limits ───────────────────────────────────────────────
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  message: { error: 'Demasiados mensajes. Espera un momento.' },
  standardHeaders: true,
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
});

// ── Init data dir ─────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');
const LEADS_FILE   = path.join(DATA_DIR, 'leads.json');
const CONVS_FILE   = path.join(DATA_DIR, 'conversations.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CLIENTS_FILE)) fs.writeFileSync(CLIENTS_FILE, '[]');
if (!fs.existsSync(LEADS_FILE))   fs.writeFileSync(LEADS_FILE,   '[]');
if (!fs.existsSync(CONVS_FILE))   fs.writeFileSync(CONVS_FILE,   '[]');

// ── Static: Admin panel ───────────────────────────────────────
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/chat',     chatLimiter,  require('./routes/chat'));
app.use('/api/admin',    adminLimiter, require('./routes/admin'));
app.use('/api/bookings', require('./routes/bookings'));
app.get('/widget.js',    require('./routes/widget'));

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AutoCerebra AI Backend',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 AutoCerebra AI Backend corriendo en puerto ${PORT}`);
  console.log(`📊 Panel admin: http://localhost:${PORT}/admin`);
  console.log(`💬 Chat API:    http://localhost:${PORT}/api/chat`);
});

module.exports = app;
