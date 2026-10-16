const express = require('express');
const pool = require('../db');
const { requireAuth, requireRol } = require('../middleware/auth');
const { perfil, condicionVisibilidad } = require('../services/acceso');
const { ESTADOS, transicionValida } = require('../services/estados');

const router = express.Router();
const acceso = [requireAuth, requireRol('socio', 'asistente')];

const entero = (v) => Number.isInteger(v) && v > 0;
const falla = (http, mensaje) => Object.assign(new Error(mensaje), { http });

function responder(res, e, etiqueta) {
  if (e.http) return res.status(e.http).json({ error: e.message });
  console.error(etiqueta + ': error interno');
  res.status(500).json({ error: 'Error interno' });
}

async function enTransaccion(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const r = await fn(conn);
    await conn.commit();
    return r;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// Bloquea la fila solo si el usuario puede verla; si no, 404 (no revela que existe).
async function cargarBloqueada(conn, u, id) {
  const c = await condicionVisibilidad(u);
  const [f] = await conn.query(
    'SELECT s.id_solicitud, s.id_socio, s.id_estado, e.nombre AS estado ' +
    'FROM solicitud s JOIN estado e ON e.id_estado = s.id_estado ' +
    'WHERE s.id_solicitud = ? AND (' + c.sql + ') FOR UPDATE OF s',
    [id, ...c.params]);
  if (!f[0]) throw falla(404, 'No encontrada');
  return f[0];
}

function registrarTransicion(conn, id, desde, hacia, actor, motivo) {
  return conn.query(
    'INSERT INTO historial_estado (id_solicitud, estado_anterior, estado_nuevo, id_usuario_actor, motivo, tipo_evento) ' +
    'VALUES (?, ?, ?, ?, ?, ?)',
    [id, desde, hacia, actor, motivo, 'transicion']);
}

// P-07: por ahora solo la asistente asigna.
router.post('/:id/asignar', ...acceso, requireRol('asistente'), async (req, res) => {
  const id = Number(req.params.id);
  const idSocio = Number((req.body || {}).id_socio);
  if (!entero(id)) return res.status(404).json({ error: 'No encontrada' });
  if (!entero(idSocio)) return res.status(400).json({ error: 'Datos invalidos' });
  const u = req.session.usuario;
  try {
    const r = await enTransaccion(async (conn) => {
      const s = await cargarBloqueada(conn, u, id);
      if (s.estado !== 'Recibida') throw falla(409, 'Transicion no permitida');
      const [socio] = await conn.query('SELECT id_socio FROM socio WHERE id_socio = ?', [idSocio]);
      if (!socio[0]) throw falla(400, 'Datos invalidos');
      await conn.query(
        'UPDATE solicitud SET id_socio = ?, id_estado = ? WHERE id_solicitud = ?',
        [idSocio, ESTADOS['Asignada'], id]);
      await conn.query(
        'INSERT INTO asignacion (id_solicitud, id_socio, id_usuario_asigna) VALUES (?, ?, ?)',
        [id, idSocio, u.id]);
      await registrarTransicion(conn, id, s.id_estado, ESTADOS['Asignada'], u.id, null);
      return { id_solicitud: id, estado: 'Asignada', id_socio: idSocio };
    });
    res.json(r);
  } catch (e) {
    responder(res, e, 'asignar');
  }
});

router.post('/:id/estado', ...acceso, async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  if (!entero(id)) return res.status(404).json({ error: 'No encontrada' });
  if (typeof b.estado !== 'string' || !Object.hasOwn(ESTADOS, b.estado)) {
    return res.status(400).json({ error: 'Datos invalidos' });
  }
  const motivo = typeof b.motivo === 'string' ? b.motivo.trim() : '';
  if (motivo.length > 255) return res.status(400).json({ error: 'Datos invalidos' });
  if (b.estado === 'Cancelada' && !motivo) {
    return res.status(400).json({ error: 'Motivo requerido' });
  }
  const u = req.session.usuario;
  try {
    const r = await enTransaccion(async (conn) => {
      const s = await cargarBloqueada(conn, u, id);
      const p = await perfil(u);
      const esDuenio = u.rol === 'socio' && p.idSocio === s.id_socio;
      const asistenteCancela = u.rol === 'asistente' && s.estado === 'Recibida' && b.estado === 'Cancelada';
      if (!esDuenio && !asistenteCancela) throw falla(403, 'Sin permiso');
      if (b.estado === 'Asignada' || !transicionValida(s.estado, b.estado)) {
        throw falla(409, 'Transicion no permitida');
      }
      await conn.query('UPDATE solicitud SET id_estado = ? WHERE id_solicitud = ?', [ESTADOS[b.estado], id]);
      await registrarTransicion(conn, id, s.id_estado, ESTADOS[b.estado], u.id, motivo || null);
      return { id_solicitud: id, estado: b.estado };
    });
    res.json(r);
  } catch (e) {
    responder(res, e, 'estado');
  }
});

router.get('/:id/historial', ...acceso, async (req, res) => {
  const id = Number(req.params.id);
  if (!entero(id)) return res.status(404).json({ error: 'No encontrada' });
  try {
    const c = await condicionVisibilidad(req.session.usuario);
    const [vis] = await pool.query(
      'SELECT s.id_solicitud FROM solicitud s WHERE s.id_solicitud = ? AND (' + c.sql + ')',
      [id, ...c.params]);
    if (!vis[0]) return res.status(404).json({ error: 'No encontrada' });
    const [filas] = await pool.query(
      'SELECT h.fecha_hora_utc, ea.nombre AS estado_anterior, en.nombre AS estado_nuevo, ' +
      'u.nombre AS actor, h.motivo, h.tipo_evento ' +
      'FROM historial_estado h ' +
      'LEFT JOIN estado ea ON ea.id_estado = h.estado_anterior ' +
      'JOIN estado en ON en.id_estado = h.estado_nuevo ' +
      'JOIN usuario u ON u.id_usuario = h.id_usuario_actor ' +
      'WHERE h.id_solicitud = ? ORDER BY h.id_historial',
      [id]);
    res.json(filas);
  } catch (e) {
    responder(res, e, 'historial');
  }
});

module.exports = router;
