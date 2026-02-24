const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const { processMessage } = require('../services/claude');
const { getClientById, getConversationHistory } = require('../services/db');

/**
 * POST /api/chat
 * Body: { clientId, message, sessionId? }
 * Returns: { response, sessionId }
 */
router.post('/', async (req, res) => {
  const { clientId, message, sessionId: existingSession } = req.body;

  // ── Validaciones básicas ──────────────────────────────────
  if (!clientId) return res.status(400).json({ error: 'clientId requerido' });
  if (!message  || typeof message !== 'string') return res.status(400).json({ error: 'message requerido' });
  if (message.length > 2000) return res.status(400).json({ error: 'Mensaje demasiado largo' });

  // ── Cargar configuración del cliente ─────────────────────
  const clientConfig = getClientById(clientId);
  if (!clientConfig) return res.status(404).json({ error: 'Cliente no encontrado' });
  if (!clientConfig.active) return res.status(403).json({ error: 'Chatbot inactivo' });

  // ── Gestionar sesión ──────────────────────────────────────
  const sessionId = existingSession || uuidv4();
  const history   = getConversationHistory(sessionId);

  try {
    const result = await processMessage(message, history, clientConfig, sessionId);

    res.json({
      response:  result.response,
      sessionId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('❌ Chat error:', err.message);
    res.status(500).json({
      error: 'Error procesando tu mensaje. Inténtalo de nuevo.',
      sessionId,
    });
  }
});

/**
 * GET /api/chat/config/:clientId
 * Devuelve la configuración pública del widget (sin datos sensibles)
 */
router.get('/config/:clientId', (req, res) => {
  const clientConfig = getClientById(req.params.clientId);
  if (!clientConfig || !clientConfig.active) {
    return res.status(404).json({ error: 'Cliente no encontrado' });
  }

  // Solo datos públicos para el widget
  res.json({
    botName:      clientConfig.bot.name,
    greeting:     clientConfig.bot.greeting,
    avatar:       clientConfig.bot.avatar || '🤖',
    primaryColor: clientConfig.widget?.primaryColor || '#e8341c',
    position:     clientConfig.widget?.position || 'bottom-right',
    initialOpen:  clientConfig.widget?.initialOpen || false,
    businessName: clientConfig.business.name,
  });
});

module.exports = router;
