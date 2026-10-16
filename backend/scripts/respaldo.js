// Copia de seguridad con mysqldump. Pide la contrasena de root en la terminal.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const base = process.env.DB_NAME;
const carpeta = path.join(__dirname, '..', '..', 'respaldos');
fs.mkdirSync(carpeta, { recursive: true });
const marca = new Date().toISOString().replace(/[:.]/g, '-');
const archivo = path.join(carpeta, base + '_' + marca + '.sql');
const salida = fs.openSync(archivo, 'w');

const hijo = spawn('mysqldump', [
  '-u', 'root', '-p', '--single-transaction', '--routines', '--triggers', '--events',
  '--no-tablespaces', '--set-gtid-purged=OFF', '--default-character-set=utf8mb4', base,
], { stdio: ['inherit', salida, 'inherit'] });

hijo.on('error', (e) => {
  console.error('No se pudo ejecutar mysqldump:', e.message);
  process.exit(1);
});
hijo.on('close', (codigo) => {
  fs.closeSync(salida);
  if (codigo !== 0) {
    fs.unlinkSync(archivo);
    console.error('El respaldo fallo (codigo ' + codigo + ').');
    process.exit(1);
  }
  console.log('Respaldo creado:', archivo);
});

