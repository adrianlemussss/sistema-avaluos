const pool = require('../src/db');
const bcrypt = require('bcrypt');

const password = process.env.SEED_PASSWORD;
if (!password || password.length < 12) {
  console.error('Define SEED_PASSWORD (12+ caracteres) en backend/.env');
  process.exit(1);
}

// Roles: 1 cliente, 2 socio, 3 asistente, 4 admin
const cuentas = [
  { email: 'socio.a@demo.test', nombre: 'Socio A (ficticio)', rol: 2, tipo: 'socio' },
  { email: 'socio.b@demo.test', nombre: 'Socio B (ficticio)', rol: 2, tipo: 'socio' },
  { email: 'asistente@demo.test', nombre: 'Asistente (ficticia)', rol: 3, tipo: 'asistente' },
  { email: 'cliente1@demo.test', nombre: 'Cliente 1 (ficticio)', rol: 1, tipo: 'cliente' },
  { email: 'cliente2@demo.test', nombre: 'Cliente 2 (ficticio)', rol: 1, tipo: 'cliente' },
  { email: 'admin@demo.test', nombre: 'Admin tecnico (ficticio)', rol: 4, tipo: 'admin' },
];

async function main() {
  const hash = await bcrypt.hash(password, 12);
  for (const c of cuentas) {
    const [existe] = await pool.query('SELECT id_usuario FROM usuario WHERE email = ?', [c.email]);
    if (existe.length) { console.log('ya existe:', c.email); continue; }
    const [r] = await pool.query(
      'INSERT INTO usuario (email, nombre, password_hash, id_rol) VALUES (?, ?, ?, ?)',
      [c.email, c.nombre, hash, c.rol]
    );
    if (c.tipo === 'socio') {
      await pool.query('INSERT INTO socio (id_usuario) VALUES (?)', [r.insertId]);
    }
    if (c.tipo === 'cliente') {
      await pool.query('INSERT INTO cliente (id_usuario, nombre, email) VALUES (?, ?, ?)', [r.insertId, c.nombre, c.email]);
    }
    console.log('creada:', c.email);
  }
  await pool.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
