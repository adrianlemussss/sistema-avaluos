const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { requireAuth, requireRol } = require('../middleware/auth');
const { entero, falla, responder, enTransaccion } = require('../services/comun');

const router = express.Router();
const admin = [requireAuth, requireRol('admin')];
const ROLES = ['cliente', 'socio', 'asistente', 'admin'];

function textoValido(v, max) {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;
}
function correoValido(v) {
  return typeof v === 'string' && v.length <= 190 && !/\s/.test(v) && /^[^\s@]+@[^\s@]+\.[^\s@]+/.test(v);
}
function claveValida(v) {
  return typeof v === 'string' && v.length >= 12 && Buffer.byteLength(v, 'utf8') <= 72;
}

// Un socio o un cliente necesitan su fila de perfil; los demas roles no.
async function asegurarPerfil(conn, idUsuario, rol, nombre, email) {
  if (rol === 'socio') {
    const [f] = await conn.query('SELECT id_socio FROM socio WHERE id_usuario = ?', [idUsuario]);
    if (!f[0]) await conn.query('INSERT INTO socio (id_usuario) VALUES (?)', [idUsuario]);
  }
  if (rol === 'cliente') {
    const [f] = await conn.query('SELECT id_cliente FROM cliente WHERE id_usuario = ?', [idUsuario]);
    if (!f[0]) {
      await conn.query('INSERT INTO cliente (id_usuario, nombre, email) VALUES (?, ?, ?)',
        [idUsuario, nombre, email]);
    }
  }
}

async function otrosAdminsActivos(conn, idExcluido) {
  const [f] = await conn.query(
    "SELECT COUNT(*) AS n FROM usuario u JOIN rol r ON r.id_rol = u.id_rol " +
    "WHERE r.nombre = 'admin' AND u.activo = 1 AND u.id_usuario <> ?", [idExcluido]);
  return f[0].n;
}

function auditar(conn, tipo, actor, objetivo, detalle) {
  return conn.query(
    'INSERT INTO auditoria_sistema (tipo_evento, id_usuario_actor, id_usuario_objetivo, detalle) VALUES (?, ?, ?, ?)',
    [tipo, actor, objetivo, detalle]);
}

router.get('/', ...admin, async (req, res) => {
  try {
    const [filas] = await pool.query(
      'SELECT u.id_usuario, u.nombre, u.email, r.nombre AS rol, u.activo, u.creado_en ' +
      'FROM usuario u JOIN rol r ON r.id_rol = u.id_rol ORDER BY u.id_usuario');
    res.json(filas);
  } catch (e) {
    responder(res, e, 'usuarios GET');
  }
});

router.post('/', ...admin, async (req, res) => {
  const b = req.body || {};
  const actor = req.session.usuario;
  if (!textoValido(b.nombre, 120) || !correoValido(b.email) || !claveValida(b.password) ||
      !ROLES.includes(b.rol)) {
    return res.status(400).json({ error: 'Datos invalidos' });
  }
  const email = b.email.trim().toLowerCase();
  const nombre = b.nombre.trim();
  try {
    const hash = await bcrypt.hash(b.password, 12);
    const r = await enTransaccion(async (conn) => {
      const [rol] = await conn.query('SELECT id_rol FROM rol WHERE nombre = ?', [b.rol]);
      const [ins] = await conn.query(
        'INSERT INTO usuario (email, nombre, password_hash, id_rol) VALUES (?, ?, ?, ?)',
        [email, nombre, hash, rol[0].id_rol]);
      await asegurarPerfil(conn, ins.insertId, b.rol, nombre, email);
      await auditar(conn, 'USUARIO_CREADO', actor.id, ins.insertId, 'rol=' + b.rol);
      return { id_usuario: ins.insertId };
    });
    res.status(201).json(r);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Correo ya registrado' });
    responder(res, e, 'usuarios POST');
  }
});

router.post('/:id/rol', ...admin, async (req, res) => {
  const id = Number(req.params.id);
  const nuevo = (req.body || {}).rol;
  const actor = req.session.usuario;
  if (!entero(id)) return res.status(404).json({ error: 'No encontrado' });
  if (typeof nuevo !== 'string' || !ROLES.includes(nuevo)) {
    return res.status(400).json({ error: 'Datos invalidos' });
  }
  if (id === actor.id) return res.status(409).json({ error: 'No puedes cambiar tu propio rol' });
  try {
    const r = await enTransaccion(async (conn) => {
      const [f] = await conn.query(
        'SELECT u.id_usuario, u.nombre, u.email, u.activo, r.nombre AS rol ' +
        'FROM usuario u JOIN rol r ON r.id_rol = u.id_rol WHERE u.id_usuario = ? FOR UPDATE', [id]);
      if (!f[0]) throw falla(404, 'No encontrado');
      if (f[0].rol === nuevo) throw falla(409, 'Sin cambios');
      if (f[0].rol === 'admin' && f[0].activo && (await otrosAdminsActivos(conn, id)) === 0) {
        throw falla(409, 'Debe quedar al menos un administrador activo');
      }
      const [rol] = await conn.query('SELECT id_rol FROM rol WHERE nombre = ?', [nuevo]);
      await conn.query('UPDATE usuario SET id_rol = ? WHERE id_usuario = ?', [rol[0].id_rol, id]);
      await asegurarPerfil(conn, id, nuevo, f[0].nombre, f[0].email);
      await auditar(conn, 'USUARIO_ROL', actor.id, id, 'rol=' + f[0].rol + '->' + nuevo);
      return { id_usuario: id, rol: nuevo };
    });
    res.json(r);
  } catch (e) {
    responder(res, e, 'usuarios rol');
  }
});

router.post('/:id/activo', ...admin, async (req, res) => {
  const id = Number(req.params.id);
  const activo = (req.body || {}).activo;
  const actor = req.session.usuario;
  if (!entero(id)) return res.status(404).json({ error: 'No encontrado' });
  if (typeof activo !== 'boolean') return res.status(400).json({ error: 'Datos invalidos' });
  if (id === actor.id && !activo) {
    return res.status(409).json({ error: 'No puedes desactivarte a ti mismo' });
  }
  try {
    const r = await enTransaccion(async (conn) => {
      const [f] = await conn.query(
        'SELECT u.id_usuario, u.activo, r.nombre AS rol ' +
        'FROM usuario u JOIN rol r ON r.id_rol = u.id_rol WHERE u.id_usuario = ? FOR UPDATE', [id]);
      if (!f[0]) throw falla(404, 'No encontrado');
      if (Boolean(f[0].activo) === activo) throw falla(409, 'Sin cambios');
      if (!activo && f[0].rol === 'admin' && (await otrosAdminsActivos(conn, id)) === 0) {
        throw falla(409, 'Debe quedar al menos un administrador activo');
      }
      await conn.query('UPDATE usuario SET activo = ? WHERE id_usuario = ?', [activo ? 1 : 0, id]);
      await auditar(conn, 'USUARIO_ACTIVO', actor.id, id, 'activo=' + (activo ? 1 : 0));
      return { id_usuario: id, activo };
    });
    res.json(r);
  } catch (e) {
    responder(res, e, 'usuarios activo');
  }
});

module.exports = router;
