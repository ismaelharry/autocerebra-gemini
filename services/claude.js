/**
 * ai.js — Cerebro del chatbot usando Google Gemini (GRATIS)
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const googleCalendarService = require('./googleCalendar');
const emailService = require('./email');
const { saveConversation, saveLead, updateClientStats } = require('./db');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function buildSystemPrompt(clientConfig) {
  const { bot, business, services, faq, booking, escalation } = clientConfig;
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const servicesList = services?.map(s =>
    `• ${s.name}: ${s.price}${s.duration ? ` (${s.duration} min)` : ''}${s.description ? ` — ${s.description}` : ''}`
  ).join('\n') || 'Consultar con el equipo.';

  const faqText = faq?.map(f => `P: ${f.question}\nR: ${f.answer}`).join('\n\n') || '';
  const hoursText = business.hours || 'Consultar con el equipo';

  return `Eres ${bot.name}, el asistente virtual de ${business.name}.
Fecha y hora actual: ${dateStr}, ${timeStr}.
Tu tono es: ${bot.tone || 'profesional y cercano'}.

INFORMACIÓN DEL NEGOCIO:
Nombre: ${business.name}
Descripción: ${business.description || ''}
Dirección: ${business.address || 'Ver web'}
Teléfono: ${business.phone || 'Ver web'}
Email: ${business.email || 'Ver web'}
Horario: ${hoursText}

SERVICIOS:
${servicesList}

${faq?.length ? `PREGUNTAS FRECUENTES:\n${faqText}\n` : ''}

INSTRUCCIONES:
1. Responde siempre en español salvo que te hablen en otro idioma.
2. Sé conciso. Máximo 3-4 frases.
3. Si preguntan precio, dáselo directamente.
4. Si quieren cita, pregunta qué servicio y qué día.
5. NUNCA inventes información.
6. Usa emojis con moderación (1-2 por mensaje).
7. Si mencionan: ${escalation?.triggerKeywords?.join(', ') || 'urgencia, emergencia'} → muestra urgencia, pide su teléfono.
8. Tu objetivo: resolver dudas, capturar contactos y cerrar citas.

ACCIONES — cuando necesites hacer algo, pon esto al FINAL de tu mensaje (solo si es necesario):
[ACTION:capture_lead:{"name":"nombre","email":"email o vacío","phone":"tel o vacío","interest":"qué quiere"}]
[ACTION:book_appointment:{"name":"nombre","email":"email","phone":"tel","date":"YYYY-MM-DD","time":"HH:MM","service":"servicio","notes":"notas"}]
[ACTION:transfer_to_human:{"reason":"motivo","urgency":"normal o urgente","summary":"resumen corto"}]

Solo incluye una acción si tienes todos los datos necesarios. El texto normal va ANTES.`;
}

async function parseAndExecuteActions(text, clientConfig, sessionId) {
  const actionRegex = /\[ACTION:(\w+):(\{[^}]*\})\]/g;
  let match;
  let cleanText = text;

  while ((match = actionRegex.exec(text)) !== null) {
    try {
      const name = match[1];
      const input = JSON.parse(match[2]);
      cleanText = cleanText.replace(match[0], '').trim();
      await executeAction(name, input, clientConfig, sessionId);
    } catch (e) {
      console.error('Error parsing/executing action:', e.message);
    }
  }

  return cleanText;
}

async function executeAction(actionName, input, clientConfig, sessionId) {
  console.log(`🔧 Action: ${actionName}`, input);

  if (actionName === 'book_appointment' && clientConfig.booking?.enabled) {
    if (clientConfig.booking.type === 'google_calendar' && clientConfig.booking.googleCalendar?.credentials?.access_token) {
      await googleCalendarService.createEvent(clientConfig.booking.googleCalendar, input);
    }
    if (input.email) await emailService.sendBookingConfirmation(input, clientConfig, {});
    if (clientConfig.leads?.notifyEmail) await emailService.notifyBusinessNewBooking(input, clientConfig);
    await updateClientStats(clientConfig.id, 'appointmentsBooked');
  }

  if (actionName === 'capture_lead') {
    const lead = { ...input, clientId: clientConfig.id, clientName: clientConfig.business.name, sessionId, capturedAt: new Date().toISOString(), source: 'chatbot' };
    await saveLead(lead);
    if (clientConfig.leads?.notifyEmail) await emailService.notifyBusinessNewLead(lead, clientConfig);
    await updateClientStats(clientConfig.id, 'leadsCapture');
  }

  if (actionName === 'transfer_to_human') {
    await emailService.notifyBusinessEscalation({ ...input, clientId: clientConfig.id, clientName: clientConfig.business.name, sessionId, timestamp: new Date().toISOString() }, clientConfig);
  }
}

async function processMessage(userMessage, conversationHistory, clientConfig, sessionId) {
  const systemPrompt = buildSystemPrompt(clientConfig);

  const geminiHistory = conversationHistory
    .filter(m => typeof m.content === 'string' && m.content.trim())
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: systemPrompt,
    generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
  });

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(userMessage);
  const rawText = result.response.text();
  const cleanResponse = await parseAndExecuteActions(rawText, clientConfig, sessionId);

  const updatedHistory = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
    { role: 'assistant', content: cleanResponse },
  ];

  await saveConversation(sessionId, clientConfig.id, updatedHistory);
  await updateClientStats(clientConfig.id, 'conversations');

  return {
    response: cleanResponse || 'Lo siento, no pude procesar tu mensaje.',
    messages: updatedHistory.slice(-20),
  };
}

module.exports = { processMessage, buildSystemPrompt };
