/**
 * db.js — Capa de datos con JSON (Railway-ready)
 * Fácilmente migrable a PostgreSQL añadiendo un adaptador.
 */
const fs   = require('fs');
const path = require('path');

const DATA_DIR    = path.join(__dirname, '..', 'data');
const CLIENTS_F   = path.join(DATA_DIR, 'clients.json');
const LEADS_F     = path.join(DATA_DIR, 'leads.json');
const CONVS_F     = path.join(DATA_DIR, 'conversations.json');

// ── Helpers ───────────────────────────────────────────────────
function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return []; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ── CLIENTS ───────────────────────────────────────────────────
function getClients() { return readJSON(CLIENTS_F); }

function getClientById(id) {
  return getClients().find(c => c.id === id) || null;
}

function getClientBySlug(slug) {
  return getClients().find(c => c.slug === slug) || null;
}

function saveClient(clientData) {
  const clients = getClients();
  const idx = clients.findIndex(c => c.id === clientData.id);
  if (idx >= 0) {
    clients[idx] = { ...clients[idx], ...clientData, updatedAt: new Date().toISOString() };
  } else {
    clients.push({ ...clientData, createdAt: new Date().toISOString(), stats: { conversations: 0, leadsCapture: 0, appointmentsBooked: 0 } });
  }
  writeJSON(CLIENTS_F, clients);
  return idx >= 0 ? clients[idx] : clients[clients.length - 1];
}

function deleteClient(id) {
  const clients = getClients().filter(c => c.id !== id);
  writeJSON(CLIENTS_F, clients);
}

// ── LEADS ─────────────────────────────────────────────────────
function getLeads(clientId) {
  const all = readJSON(LEADS_F);
  return clientId ? all.filter(l => l.clientId === clientId) : all;
}

function saveLead(lead) {
  const leads = readJSON(LEADS_F);
  leads.push({ ...lead, id: `lead_${Date.now()}` });
  writeJSON(LEADS_F, leads);
}

// ── CONVERSATIONS ─────────────────────────────────────────────
const conversationCache = new Map(); // In-memory cache for active sessions

function saveConversation(sessionId, clientId, messages) {
  // Cache in memory (fast)
  conversationCache.set(sessionId, { clientId, messages, updatedAt: Date.now() });

  // Persist only last 100 conversations to avoid huge files
  const convs = readJSON(CONVS_F);
  const idx = convs.findIndex(c => c.sessionId === sessionId);
  const entry = { sessionId, clientId, messages: messages.slice(-30), updatedAt: new Date().toISOString() };

  if (idx >= 0) convs[idx] = entry;
  else convs.push(entry);

  // Keep only last 500 conversations in file
  if (convs.length > 500) convs.splice(0, convs.length - 500);
  writeJSON(CONVS_F, convs);
}

function getConversationHistory(sessionId) {
  // Try cache first
  if (conversationCache.has(sessionId)) {
    return conversationCache.get(sessionId).messages;
  }
  // Fallback to file
  const convs = readJSON(CONVS_F);
  const found = convs.find(c => c.sessionId === sessionId);
  return found?.messages || [];
}

function getConversationsByClient(clientId, limit = 50) {
  const convs = readJSON(CONVS_F);
  return convs
    .filter(c => c.clientId === clientId)
    .slice(-limit)
    .reverse();
}

// Limpiar sesiones viejas de memoria cada hora
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of conversationCache.entries()) {
    if (now - val.updatedAt > 3600000) conversationCache.delete(key); // 1h
  }
}, 3600000);

// ── STATS ─────────────────────────────────────────────────────
async function updateClientStats(clientId, field) {
  const clients = getClients();
  const idx = clients.findIndex(c => c.id === clientId);
  if (idx < 0) return;
  if (!clients[idx].stats) clients[idx].stats = {};
  clients[idx].stats[field] = (clients[idx].stats[field] || 0) + 1;
  clients[idx].stats.lastActivity = new Date().toISOString();
  writeJSON(CLIENTS_F, clients);
}

module.exports = {
  getClients, getClientById, getClientBySlug,
  saveClient, deleteClient,
  getLeads, saveLead,
  saveConversation, getConversationHistory, getConversationsByClient,
  updateClientStats,
};
