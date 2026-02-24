const express = require('express');
const router  = express.Router();
const calendly = require('../services/calendly');
const email    = require('../services/email');
const { getClients, saveLead, updateClientStats } = require('../services/db');

/** POST /api/bookings/calendly-webhook
 *  Recibir eventos de Calendly en tiempo real
 */
router.post('/calendly-webhook', async (req, res) => {
  // Responder rápido (Calendly requiere < 3s)
  res.status(200).json({ received: true });

  try {
    const event = calendly.processWebhookEvent(req.body);
    if (event.type === 'booking_created') {
      // Buscar a qué cliente pertenece (por email de Calendly configurado)
      const clients = getClients();
      const client = clients.find(c =>
        c.booking?.calendly?.username &&
        (c.booking.calendly.notifyEmail === req.body.payload?.scheduled_event?.event_memberships?.[0]?.user_email)
      );

      if (client) {
        await updateClientStats(client.id, 'appointmentsBooked');
        const lead = {
          name:      event.name,
          email:     event.email,
          interest:  'Reserva via Calendly',
          clientId:  client.id,
          clientName: client.business.name,
          source:    'calendly_webhook',
          capturedAt: new Date().toISOString(),
        };
        await saveLead(lead);
        await email.notifyBusinessNewLead(lead, client);
      }
    }
  } catch (err) {
    console.error('❌ Calendly webhook error:', err.message);
  }
});

/** GET /api/bookings/slots/:clientId?date=YYYY-MM-DD
 *  Consultar disponibilidad directamente (útil para testing)
 */
router.get('/slots/:clientId', async (req, res) => {
  const { getClientById } = require('../services/db');
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date requerido' });

  const clientConfig = getClientById(req.params.clientId);
  if (!clientConfig) return res.status(404).json({ error: 'Cliente no encontrado' });

  const gcConfig = clientConfig.booking?.googleCalendar;
  if (!gcConfig?.credentials?.access_token) {
    return res.status(400).json({ error: 'Google Calendar no configurado' });
  }

  const { getAvailableSlots } = require('../services/googleCalendar');
  const slots = await getAvailableSlots(gcConfig, date);
  res.json({ date, slots });
});

module.exports = router;
