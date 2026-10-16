const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const pool = require('./db');
const AlmacenMySQL = require('./services/almacen-sesiones');

const app = express();
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      // Solo se fuerza HTTPS en produccion; en local se sirve por http.
      'upgrade-insecure-requests': process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
}));
app.use(express.json({ limit: '100kb' }));
app.use(session({
  store: new AlmacenMySQL(pool),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8,
  },
}));

// Defensa CSRF adicional: las acciones que cambian datos solo aceptan JSON.
// Un formulario de otro sitio no puede enviar ese tipo de contenido.
app.use('/api', (req, res, next) => {
  const cambia = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const tipo = req.headers['content-type'] || '';
  if (cambia && !tipo.startsWith('application/json')) {
    return res.status(415).json({ error: 'Tipo de contenido no permitido' });
  }
  next();
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (err) {
    console.error('health: error de base de datos');
    res.status(500).json({ ok: false });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/solicitudes', require('./routes/solicitudes'));
app.use('/api/solicitudes', require('./routes/flujo'));
app.use('/api/solicitudes', require('./routes/compartir'));
app.use('/api/solicitudes', require('./routes/referencia'));
app.use('/api/solicitudes', require('./routes/cotizaciones'));
app.use('/api/solicitudes', require('./routes/detalle'));
app.use('/api/reportes', require('./routes/reportes'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/auditoria', require('./routes/auditoria'));
app.use('/api', require('./routes/catalogos'));

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'No encontrada' });
});

app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

// Ningun error devuelve la traza del servidor.
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON invalido' });
  }
  console.error('error no controlado');
  res.status(500).json({ error: 'Error interno' });
});

module.exports = app;
