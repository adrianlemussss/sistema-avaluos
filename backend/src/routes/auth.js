const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const pool = require('../db');

const router = express.Router();

// Hash de relleno: igualar el tiempo de respuesta cuando el usuario no existe.
const HASH_FALSO = bcrypt.hashSync('relleno-no-usado', 12);

const limitador = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta mas tarde.' },
});

router.post('/login', limitador, async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password || email.length > 190 || password.length > 72) {
    return res.status(400).json({ error: 'Datos invalidos' });
  }
  try {
    const [filas] = await pool.query(
      'SELECT u.id_usuario, u.nombre, u.password_hash, u.activo, r.nombre AS rol ' +
      'FROM usuario u JOIN rol r ON r.id_rol = u.id_rol WHERE u.email = ?',
      [email]
    );
    const u = filas[0];
    const ok = await bcrypt.compare(password, u ? u.password_hash : HASH_FALSO);
    if (!u || !ok || !u.activo) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'Error interno' });
      req.session.usuario = { id: u.id_usuario, rol: u.rol, nombre: u.nombre };
      res.json({ id: u.id_usuario, nombre: u.nombre, rol: u.rol });
    });
  } catch (e) {
    console.error('login: error interno');
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session.usuario) return res.status(401).json({ error: 'No autenticado' });
  res.json(req.session.usuario);
});

module.exports = router;

