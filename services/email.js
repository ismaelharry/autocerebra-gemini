/**
 * email.js — Notificaciones por email via SMTP (Gmail, Resend, etc.)
 */
const nodemailer = require('nodemailer');

function getTransporter() {
  return nodemailer.createTransporter({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const FROM = process.env.SMTP_FROM || `"AutoCerebra AI" <${process.env.SMTP_USER}>`;

// ── Email de confirmación al cliente ─────────────────────────
async function sendBookingConfirmation(booking, clientConfig, result) {
  if (!booking.email) return;
  const t = getTransporter();
  const biz = clientConfig.business;

  await t.sendMail({
    from: FROM,
    to: booking.email,
    subject: `✅ Cita confirmada — ${biz.name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#07090f;padding:24px;border-radius:12px 12px 0 0;">
          <h1 style="color:white;margin:0;font-size:1.4rem;">✅ Cita confirmada</h1>
        </div>
        <div style="background:#f9f9f9;padding:28px;border-radius:0 0 12px 12px;">
          <p style="color:#333;">Hola <strong>${booking.name}</strong>,</p>
          <p style="color:#333;">Tu cita en <strong>${biz.name}</strong> ha sido confirmada.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr style="background:white;"><td style="padding:12px;color:#666;border-bottom:1px solid #eee;">📅 Fecha</td><td style="padding:12px;font-weight:bold;">${booking.date}</td></tr>
            <tr style="background:#f9f9f9;"><td style="padding:12px;color:#666;border-bottom:1px solid #eee;">⏰ Hora</td><td style="padding:12px;font-weight:bold;">${booking.time}</td></tr>
            <tr style="background:white;"><td style="padding:12px;color:#666;border-bottom:1px solid #eee;">🔧 Servicio</td><td style="padding:12px;font-weight:bold;">${booking.service}</td></tr>
            <tr style="background:#f9f9f9;"><td style="padding:12px;color:#666;">📍 Dirección</td><td style="padding:12px;font-weight:bold;">${biz.address || 'Consulta con el negocio'}</td></tr>
          </table>
          ${booking.notes ? `<p style="color:#666;">📝 Notas: ${booking.notes}</p>` : ''}
          <p style="color:#333;">Si necesitas cancelar o modificar, contacta con nosotros:<br>
            📞 ${biz.phone || '-'} · ✉️ ${biz.email || '-'}</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
          <p style="color:#aaa;font-size:0.8rem;">Reserva gestionada por AutoCerebra AI</p>
        </div>
      </div>
    `,
  });
}

// ── Notificar al negocio: nueva cita ─────────────────────────
async function notifyBusinessNewBooking(booking, clientConfig) {
  const t = getTransporter();
  const notifyEmail = clientConfig.leads?.notifyEmail;
  if (!notifyEmail) return;

  await t.sendMail({
    from: FROM,
    to: notifyEmail,
    subject: `📅 Nueva cita: ${booking.name} — ${booking.service}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#e8341c;padding:20px 24px;border-radius:12px 12px 0 0;">
          <h2 style="color:white;margin:0;">📅 Nueva cita reservada via chatbot</h2>
        </div>
        <div style="background:#f9f9f9;padding:24px;border-radius:0 0 12px 12px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:10px;color:#666;">👤 Cliente</td><td style="padding:10px;font-weight:bold;">${booking.name}</td></tr>
            <tr style="background:white;"><td style="padding:10px;color:#666;">📅 Fecha</td><td style="padding:10px;font-weight:bold;">${booking.date} a las ${booking.time}</td></tr>
            <tr><td style="padding:10px;color:#666;">🔧 Servicio</td><td style="padding:10px;">${booking.service}</td></tr>
            <tr style="background:white;"><td style="padding:10px;color:#666;">📧 Email</td><td style="padding:10px;">${booking.email || '-'}</td></tr>
            <tr><td style="padding:10px;color:#666;">📞 Teléfono</td><td style="padding:10px;">${booking.phone || '-'}</td></tr>
            ${booking.notes ? `<tr style="background:white;"><td style="padding:10px;color:#666;">📝 Notas</td><td style="padding:10px;">${booking.notes}</td></tr>` : ''}
          </table>
        </div>
      </div>
    `,
  });
}

// ── Notificar al negocio: nuevo lead ─────────────────────────
async function notifyBusinessNewLead(lead, clientConfig) {
  const t = getTransporter();
  const notifyEmail = clientConfig.leads?.notifyEmail;
  if (!notifyEmail) return;

  await t.sendMail({
    from: FROM,
    to: notifyEmail,
    subject: `🎯 Nuevo lead: ${lead.name} — ${clientConfig.business.name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1a40ff;padding:20px 24px;border-radius:12px 12px 0 0;">
          <h2 style="color:white;margin:0;">🎯 Nuevo lead capturado</h2>
        </div>
        <div style="background:#f9f9f9;padding:24px;border-radius:0 0 12px 12px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:10px;color:#666;">👤 Nombre</td><td style="padding:10px;font-weight:bold;">${lead.name}</td></tr>
            <tr style="background:white;"><td style="padding:10px;color:#666;">📧 Email</td><td style="padding:10px;">${lead.email || '-'}</td></tr>
            <tr><td style="padding:10px;color:#666;">📞 Teléfono</td><td style="padding:10px;">${lead.phone || '-'}</td></tr>
            <tr style="background:white;"><td style="padding:10px;color:#666;">🎯 Interés</td><td style="padding:10px;">${lead.interest || '-'}</td></tr>
            <tr><td style="padding:10px;color:#666;">📝 Notas</td><td style="padding:10px;">${lead.notes || '-'}</td></tr>
            <tr style="background:white;"><td style="padding:10px;color:#666;">⏰ Captado</td><td style="padding:10px;">${new Date().toLocaleString('es-ES')}</td></tr>
          </table>
          <p style="color:#888;font-size:0.8rem;margin-top:16px;">📊 Ve todos tus leads en el panel: ${process.env.APP_URL || 'tu-dominio.railway.app'}/admin</p>
        </div>
      </div>
    `,
  });
}

// ── Notificar al negocio: escalado a humano ───────────────────
async function notifyBusinessEscalation(alert, clientConfig) {
  const t = getTransporter();
  const notifyEmail = clientConfig.leads?.notifyEmail || clientConfig.escalation?.email;
  if (!notifyEmail) return;

  const urgencyEmoji = alert.urgency === 'urgente' ? '🚨' : '⚠️';

  await t.sendMail({
    from: FROM,
    to: notifyEmail,
    subject: `${urgencyEmoji} ${alert.urgency === 'urgente' ? 'URGENTE' : 'Aviso'}: Cliente requiere atención humana`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:${alert.urgency === 'urgente' ? '#dc2626' : '#f59e0b'};padding:20px 24px;border-radius:12px 12px 0 0;">
          <h2 style="color:white;margin:0;">${urgencyEmoji} Escalado de chatbot — ${alert.urgency?.toUpperCase()}</h2>
        </div>
        <div style="background:#f9f9f9;padding:24px;border-radius:0 0 12px 12px;">
          <p><strong>Motivo:</strong> ${alert.reason}</p>
          <p><strong>Resumen de la conversación:</strong></p>
          <div style="background:white;padding:16px;border-radius:8px;border-left:4px solid #e8341c;font-size:0.9rem;color:#333;">${alert.summary}</div>
          <p style="margin-top:16px;color:#666;font-size:0.85rem;">⏰ ${new Date().toLocaleString('es-ES')}</p>
        </div>
      </div>
    `,
  });
}

module.exports = {
  sendBookingConfirmation,
  notifyBusinessNewBooking,
  notifyBusinessNewLead,
  notifyBusinessEscalation,
};
