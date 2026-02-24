const express = require('express');
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const router  = express.Router();

const { requireAuth, generateToken } = require('../middleware/auth');
const {
  getClients, getClientById, saveClient, deleteClient,
  getLeads, getConversationsByClient,
} = require('../services/db');
const googleCalendar = require('../services/googleCalendar');

// ── Credenciales admin (en .env) ──────────────────────────────
const ADMIN_USER = process.env.ADMIN_USER || 'ismael';
const ADMIN_PASS = process.env.ADMIN_PASS || 'autocerebra2025';

// ══════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════

/** POST /api/admin/login */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }
  const token = generateToken({ username, role: 'admin' });
  res.json({ token, username });
});

/** GET /api/admin/me */
router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.admin.username, role: req.admin.role });
});

// ══════════════════════════════════════════════════
//  CLIENTS
// ══════════════════════════════════════════════════

/** GET /api/admin/clients — Listar todos */
router.get('/clients', requireAuth, (req, res) => {
  const clients = getClients().map(c => ({
    ...c,
    // No devolver tokens OAuth ni claves API en el listado
    booking: c.booking ? {
      ...c.booking,
      googleCalendar: c.booking.googleCalendar ? { calendarId: c.booking.googleCalendar.calendarId, connected: !!c.booking.googleCalendar.credentials?.access_token } : null,
      calendly: c.booking.calendly ? { username: c.booking.calendly.username, connected: !!c.booking.calendly.apiKey } : null,
    } : null,
  }));
  res.json(clients);
});

/** GET /api/admin/clients/:id */
router.get('/clients/:id', requireAuth, (req, res) => {
  const c = getClientById(req.params.id);
  if (!c) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json(c);
});

/** POST /api/admin/clients — Crear nuevo cliente */
router.post('/clients', requireAuth, (req, res) => {
  const data = req.body;

  if (!data.business?.name) return res.status(400).json({ error: 'business.name requerido' });
  if (!data.bot?.name)      return res.status(400).json({ error: 'bot.name requerido' });

  const slug = (data.business.name)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .substring(0, 50);

  const newClient = {
    id:     uuidv4(),
    slug:   `${slug}-${Date.now().toString(36)}`,
    active: true,
    ...data,
  };

  const saved = saveClient(newClient);
  res.status(201).json(saved);
});

/** PUT /api/admin/clients/:id — Actualizar cliente */
router.put('/clients/:id', requireAuth, (req, res) => {
  const existing = getClientById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Cliente no encontrado' });

  const updated = saveClient({ ...existing, ...req.body, id: req.params.id });
  res.json(updated);
});

/** DELETE /api/admin/clients/:id */
router.delete('/clients/:id', requireAuth, (req, res) => {
  const existing = getClientById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Cliente no encontrado' });
  deleteClient(req.params.id);
  res.json({ success: true });
});

/** PATCH /api/admin/clients/:id/toggle — Activar/desactivar */
router.patch('/clients/:id/toggle', requireAuth, (req, res) => {
  const existing = getClientById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Cliente no encontrado' });
  const updated = saveClient({ ...existing, active: !existing.active });
  res.json({ active: updated.active });
});

// ══════════════════════════════════════════════════
//  GOOGLE CALENDAR AUTH FLOW
// ══════════════════════════════════════════════════

/** GET /api/admin/clients/:id/google-auth — Iniciar OAuth */
router.get('/clients/:id/google-auth', requireAuth, (req, res) => {
  const url = googleCalendar.getAuthUrl(req.params.id);
  res.json({ authUrl: url });
});

/** GET /api/admin/google-callback — Recibir tokens */
router.get('/google-callback', async (req, res) => {
  const { code, state: clientId } = req.query;
  if (!code || !clientId) return res.status(400).send('Parámetros inválidos');

  try {
    const tokens   = await googleCalendar.exchangeCodeForTokens(code);
    const existing = getClientById(clientId);
    if (!existing) return res.status(404).send('Cliente no encontrado');

    saveClient({
      ...existing,
      booking: {
        ...existing.booking,
        googleCalendar: {
          ...existing.booking?.googleCalendar,
          credentials: tokens,
        },
      },
    });

    // Redirigir al admin con éxito
    res.send(`<script>window.opener?.postMessage({type:'google-auth-success',clientId:'${clientId}'},'*');window.close();</script>`);
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

// ══════════════════════════════════════════════════
//  LEADS
// ══════════════════════════════════════════════════

/** GET /api/admin/leads — Todos los leads */
router.get('/leads', requireAuth, (req, res) => {
  const { clientId } = req.query;
  res.json(getLeads(clientId));
});

/** GET /api/admin/leads/:clientId */
router.get('/leads/:clientId', requireAuth, (req, res) => {
  res.json(getLeads(req.params.clientId));
});

// ══════════════════════════════════════════════════
//  CONVERSATIONS
// ══════════════════════════════════════════════════

/** GET /api/admin/conversations/:clientId */
router.get('/conversations/:clientId', requireAuth, (req, res) => {
  const convs = getConversationsByClient(req.params.clientId, 100);
  res.json(convs);
});

// ══════════════════════════════════════════════════
//  DASHBOARD STATS
// ══════════════════════════════════════════════════

/** GET /api/admin/stats */
router.get('/stats', requireAuth, (req, res) => {
  const clients = getClients();
  const leads   = getLeads();

  const totalConversations   = clients.reduce((sum, c) => sum + (c.stats?.conversations || 0), 0);
  const totalLeads           = clients.reduce((sum, c) => sum + (c.stats?.leadsCapture || 0), 0);
  const totalAppointments    = clients.reduce((sum, c) => sum + (c.stats?.appointmentsBooked || 0), 0);
  const activeClients        = clients.filter(c => c.active).length;

  res.json({
    totalClients: clients.length,
    activeClients,
    totalConversations,
    totalLeads,
    totalAppointments,
    recentLeads: leads.slice(-5).reverse(),
  });
});

module.exports = router;
