const pool = require('../src/db');
const bcrypt = require('bcrypt');

const password = process.env.SEED_PASSWORD;
if (!password || password.length < 12) {
  console.error('Define SEED_PASSWORD (12+ caracteres) en backend/.env');
  process.exit(1);
}

async function main() {
  const hash = await bcrypt.hash(password, 12);
  const [r] = await pool.query(
    "UPDATE usuario SET password_hash = ? WHERE email LIKE '%@demo.test'", [hash]);
  console.log('Cuentas demo actualizadas:', r.affectedRows);
  await pool.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
