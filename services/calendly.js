/**
 * calendly.js — Integración con Calendly v2 API
 *
 * Para cada cliente necesitas:
 *  - apiKey: Personal Access Token de Calendly (Settings > Integrations > API)
 *  - eventTypeUri: URI del tipo de evento (ej: "https://api.calendly.com/event_types/XXXX")
 */
const fetch = require('node-fetch');

const CALENDLY_BASE = 'https://api.calendly.com';

// ── Helper request ────────────────────────────────────────────
async function calendlyRequest(endpoint, apiKey, options = {}) {
  const res = await fetch(`${CALENDLY_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Calendly API error ${res.status}: ${err}`);
  }

  return res.json();
}

// ── Obtener info del usuario ──────────────────────────────────
async function getUserInfo(apiKey) {
  const data = await calendlyRequest('/users/me', apiKey);
  return data.resource;
}

// ── Listar event types del usuario ────────────────────────────
async function getEventTypes(apiKey) {
  const user = await getUserInfo(apiKey);
  const data = await calendlyRequest(
    `/event_types?user=${encodeURIComponent(user.uri)}&active=true`,
    apiKey
  );
  return data.collection || [];
}

// ── Obtener slots disponibles para una fecha ──────────────────
async function getAvailableSlots(calendlyConfig, date) {
  try {
    const { apiKey, eventTypeUri } = calendlyConfig;

    // Calendly usa rangos de tiempo para disponibilidad
    const startTime = `${date}T00:00:00.000000Z`;
    const endTime   = `${date}T23:59:59.000000Z`;

    const data = await calendlyRequest(
      `/event_type_available_times?event_type=${encodeURIComponent(eventTypeUri)}&start_time=${startTime}&end_time=${endTime}`,
      apiKey
    );

    const slots = (data.collection || []).map(slot => {
      const d = new Date(slot.start_time);
      return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
    });

    return slots;
  } catch (err) {
    console.error('❌ Calendly getAvailableSlots:', err.message);
    return ['10:00', '11:00', '12:00', '16:00', '17:00'];
  }
}

// ── Crear una invitación (reserva) ────────────────────────────
// Nota: Calendly no permite crear eventos directamente via API para invitados.
// La forma estándar es generar un link de scheduling personalizado.
async function getSchedulingLink(calendlyConfig, booking) {
  try {
    const { apiKey, eventTypeUri } = calendlyConfig;

    const data = await calendlyRequest('/scheduling_links', apiKey, {
      method: 'POST',
      body: JSON.stringify({
        max_event_count: 1,
        owner: eventTypeUri,
        owner_type: 'EventType',
      }),
    });

    return {
      link: data.resource?.booking_url,
      id:   data.resource?.uri,
    };
  } catch (err) {
    console.error('❌ Calendly scheduling link:', err.message);
    return null;
  }
}

// ── Obtener eventos próximos (para verificar reservas) ────────
async function getUpcomingEvents(apiKey, count = 10) {
  try {
    const user = await getUserInfo(apiKey);
    const data = await calendlyRequest(
      `/scheduled_events?user=${encodeURIComponent(user.uri)}&status=active&count=${count}&sort=start_time:asc`,
      apiKey
    );
    return data.collection || [];
  } catch (err) {
    console.error('❌ Calendly getUpcomingEvents:', err.message);
    return [];
  }
}

// ── Webhook: procesar evento de Calendly ─────────────────────
// Llama a esto desde POST /api/bookings/calendly-webhook
function processWebhookEvent(payload) {
  const { event, payload: data } = payload;

  switch (event) {
    case 'invitee.created':
      return {
        type: 'booking_created',
        name:    data.name,
        email:   data.email,
        date:    data.scheduled_event?.start_time,
        eventId: data.scheduled_event?.uri,
      };
    case 'invitee.canceled':
      return {
        type: 'booking_canceled',
        name:  data.name,
        email: data.email,
      };
    default:
      return { type: 'unknown', event };
  }
}

module.exports = {
  getUserInfo, getEventTypes,
  getAvailableSlots, getSchedulingLink, getUpcomingEvents,
  processWebhookEvent,
};
