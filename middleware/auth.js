const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'autocerebra-secret-cambia-esto-en-produccion';

// ── Verificar token ───────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  const token  = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// ── Generar token ─────────────────────────────────────────────
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

module.exports = { requireAuth, generateToken };
