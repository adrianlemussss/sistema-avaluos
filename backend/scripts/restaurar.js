// Restaura un respaldo en una base NUEVA (por defecto avaluos_restaurada).
// Nunca restaura sobre la base real. Si la base destino ya existe, se reemplaza.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const archivo = process.argv[2];
const destino = process.argv[3] || 'avaluos_restaurada';

if (!archivo || !fs.existsSync(archivo)) {
  console.error('Uso: npm run restaurar -- <archivo.sql> [base_destino]');
  process.exit(1);
}
if (destino.length === 0 || destino.replace(/\w/g, '') !== '') {
  console.error('El nombre de la base solo puede tener letras, numeros y guion bajo.');
  process.exit(1);
}
if (destino === process.env.DB_NAME) {
  console.error('Por seguridad no se restaura sobre la base real (' + destino + ').');
  process.exit(1);
}

const hijo = spawn('mysql', ['-u', 'root', '-p', '--default-character-set=utf8mb4'],
  { stdio: ['pipe', 'inherit', 'inherit'] });

hijo.on('error', (e) => {
  console.error('No se pudo ejecutar mysql:', e.message);
  process.exit(1);
});
hijo.on('close', (codigo) => {
  if (codigo !== 0) {
    console.error('La restauracion fallo (codigo ' + codigo + ').');
    process.exit(1);
  }
  console.log('Restaurado en la base:', destino);
});

hijo.stdin.write(
  'DROP DATABASE IF EXISTS ' + destino + ';\n' +
  'CREATE DATABASE ' + destino + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;\n' +
  'USE ' + destino + ';\n');
fs.createReadStream(archivo).pipe(hijo.stdin);
