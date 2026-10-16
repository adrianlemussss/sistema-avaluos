const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const pool = require('./db');

const app = express();
app.use(helmet());
app.use(express.json({ limit: '100kb' }));
app.use(session({
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

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log('API escuchando en http://localhost:' + port));



