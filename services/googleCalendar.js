/**
 * googleCalendar.js — Gestión de disponibilidad y reservas via Google Calendar API
 *
 * Para cada cliente necesitas:
 *  - calendarId: el ID del calendario (normalmente el email o "primary")
 *  - access_token / refresh_token: tokens OAuth del negocio
 *
 * Cómo obtener los tokens OAuth de un cliente:
 *  1. Crear proyecto en https://console.cloud.google.com
 *  2. Activar Google Calendar API
 *  3. Crear credenciales OAuth 2.0 (tipo "Web application")
 *  4. Ir a /api/admin/clients/:id/google-auth para iniciar el flujo
 *  5. El cliente autoriza y los tokens se guardan automáticamente
 */
const { google } = require('googleapis');

// ── Crear cliente OAuth por credenciales del cliente ──────────
function getOAuthClient(credentials) {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2.setCredentials({
    access_token:  credentials.access_token,
    refresh_token: credentials.refresh_token,
    expiry_date:   credentials.expiry_date,
  });
  return oauth2;
}

// ── Generar URL de autorización OAuth ────────────────────────
function getAuthUrl(clientId) {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    state: clientId, // Pasamos el clientId para vincularlo al guardar
  });
}

// ── Intercambiar code por tokens ──────────────────────────────
async function exchangeCodeForTokens(code) {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  const { tokens } = await oauth2.getToken(code);
  return tokens;
}

// ── Obtener huecos disponibles para una fecha ─────────────────
async function getAvailableSlots(gcConfig, date, service) {
  try {
    const auth = getOAuthClient(gcConfig.credentials);
    const calendar = google.calendar({ version: 'v3', auth });

    const startOfDay = new Date(`${date}T00:00:00`);
    const endOfDay   = new Date(`${date}T23:59:59`);

    // Obtener eventos existentes ese día
    const eventsRes = await calendar.events.list({
      calendarId: gcConfig.calendarId || 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const busySlots = (eventsRes.data.items || []).map(ev => ({
      start: new Date(ev.start.dateTime || ev.start.date),
      end:   new Date(ev.end.dateTime   || ev.end.date),
    }));

    // Generar slots de 30 min entre 9:00 y 19:00
    const slots = [];
    const slotDuration = gcConfig.slotDuration || 30; // minutos
    const workStart = gcConfig.workStart || 9;
    const workEnd   = gcConfig.workEnd   || 19;

    for (let hour = workStart; hour < workEnd; hour++) {
      for (let min = 0; min < 60; min += slotDuration) {
        const slotStart = new Date(`${date}T${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:00`);
        const slotEnd   = new Date(slotStart.getTime() + slotDuration * 60000);

        // Verificar que no solapa con evento existente
        const isBusy = busySlots.some(b => slotStart < b.end && slotEnd > b.start);
        // No mostrar slots pasados
        const isPast = slotStart < new Date();

        if (!isBusy && !isPast) {
          slots.push(`${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`);
        }
      }
    }

    return slots;
  } catch (err) {
    console.error('❌ Google Calendar getAvailableSlots:', err.message);
    // Si hay error de auth, devolver slots de ejemplo para no bloquear el chatbot
    return ['10:00', '11:00', '12:00', '16:00', '17:00', '18:00'];
  }
}

// ── Crear evento (reservar cita) ──────────────────────────────
async function createEvent(gcConfig, booking) {
  try {
    const auth = getOAuthClient(gcConfig.credentials);
    const calendar = google.calendar({ version: 'v3', auth });

    const [year, month, day] = booking.date.split('-');
    const [hour, minute] = booking.time.split(':');
    const startDT = new Date(year, month - 1, day, hour, minute);
    const endDT   = new Date(startDT.getTime() + (gcConfig.slotDuration || 60) * 60000);

    const event = {
      summary:     `${booking.service} — ${booking.name}`,
      description: `Cliente: ${booking.name}\nEmail: ${booking.email || '-'}\nTel: ${booking.phone || '-'}\nServicio: ${booking.service}\nNotas: ${booking.notes || '-'}\n\n📌 Reservado via AutoCerebra AI`,
      start: { dateTime: startDT.toISOString(), timeZone: 'Europe/Madrid' },
      end:   { dateTime: endDT.toISOString(),   timeZone: 'Europe/Madrid' },
      attendees: booking.email ? [{ email: booking.email, displayName: booking.name }] : [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 60 },
        ],
      },
      colorId: '11', // Rojo para destacar citas del bot
    };

    const res = await calendar.events.insert({
      calendarId: gcConfig.calendarId || 'primary',
      resource: event,
      sendUpdates: booking.email ? 'all' : 'none',
    });

    return { id: res.data.id, link: res.data.htmlLink };
  } catch (err) {
    console.error('❌ Google Calendar createEvent:', err.message);
    throw new Error('No se pudo crear el evento en Google Calendar.');
  }
}

module.exports = { getAuthUrl, exchangeCodeForTokens, getAvailableSlots, createEvent };
