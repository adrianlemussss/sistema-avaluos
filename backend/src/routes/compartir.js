const express = require('express');
const pool = require('../db');
const { requireAuth, requireRol } = require('../middleware/auth');
const { perfil, condicionVisibilidad } = require('../services/acceso');

const router = express.Router();
// P-05: solo el socio due?o decide compartir (pendiente de validar con los socios).
const acceso = [requireAuth, requireRol('socio')];

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

// 404 si no la ve; 403 si la ve (por compartici?n) pero no es el due?o.
async function cargarComoDuenio(conn, u, id) {
  const c = await condicionVisibilidad(u);
  const [f] = await conn.query(
    'SELECT s.id_solicitud, s.id_socio FROM solicitud s ' +
    'WHERE s.id_solicitud = ? AND (' + c.sql + ') FOR UPDATE OF s',
    [id, ...c.params]);
  if (!f[0]) throw falla(404, 'No encontrada');
  const p = await perfil(u);
  if (f[0].id_socio !== p.idSocio) throw falla(403, 'Sin permiso');
  return { idSocio: p.idSocio };
}

router.post('/:id/compartir', ...acceso, async (req, res) => {
  const id = Number(req.params.id);
  const destino = Number((req.body || {}).id_socio);
  if (!entero(id)) return res.status(404).json({ error: 'No encontrada' });
  if (!entero(destino)) return res.status(400).json({ error: 'Datos invalidos' });
  const u = req.session.usuario;
  try {
    const r = await enTransaccion(async (conn) => {
      const { idSocio } = await cargarComoDuenio(conn, u, id);
      if (destino === idSocio) throw falla(400, 'Datos invalidos');
      const [socio] = await conn.query('SELECT id_usuario FROM socio WHERE id_socio = ?', [destino]);
      if (!socio[0]) throw falla(400, 'Datos invalidos');
      const [ya] = await conn.query(
        'SELECT id_permiso FROM permiso_compartido ' +
        'WHERE id_solicitud = ? AND id_socio_destino = ? AND revocado_en IS NULL',
        [id, destino]);
      if (ya[0]) throw falla(409, 'Ya compartida');
      const [ins] = await conn.query(
        'INSERT INTO permiso_compartido (id_solicitud, id_socio_destino, autorizado_por) VALUES (?, ?, ?)',
        [id, destino, u.id]);
      await conn.query(
        'INSERT INTO auditoria_sistema (tipo_evento, id_usuario_actor, id_solicitud, id_usuario_objetivo, detalle) ' +
        'VALUES (?, ?, ?, ?, ?)',
        ['PERMISO_OTORGADO', u.id, id, socio[0].id_usuario, 'id_permiso=' + ins.insertId]);
      return { id_permiso: ins.insertId, id_solicitud: id, id_socio_destino: destino };
    });
    res.status(201).json(r);
  } catch (e) {
    responder(res, e, 'compartir');
  }
});

router.delete('/:id/compartir/:idSocio', ...acceso, async (req, res) => {
  const id = Number(req.params.id);
  const destino = Number(req.params.idSocio);
  if (!entero(id)) return res.status(404).json({ error: 'No encontrada' });
  if (!entero(destino)) return res.status(400).json({ error: 'Datos invalidos' });
  const u = req.session.usuario;
  try {
    const r = await enTransaccion(async (conn) => {
      await cargarComoDuenio(conn, u, id);
      const [permiso] = await conn.query(
        'SELECT p.id_permiso, s.id_usuario FROM permiso_compartido p ' +
        'JOIN socio s ON s.id_socio = p.id_socio_destino ' +
        'WHERE p.id_solicitud = ? AND p.id_socio_destino = ? AND p.revocado_en IS NULL',
        [id, destino]);
      if (!permiso[0]) throw falla(404, 'No encontrada');
      await conn.query(
        'UPDATE permiso_compartido SET revocado_en = UTC_TIMESTAMP(3), revocado_por = ? WHERE id_permiso = ?',
        [u.id, permiso[0].id_permiso]);
      await conn.query(
        'INSERT INTO auditoria_sistema (tipo_evento, id_usuario_actor, id_solicitud, id_usuario_objetivo, detalle) ' +
        'VALUES (?, ?, ?, ?, ?)',
        ['PERMISO_REVOCADO', u.id, id, permiso[0].id_usuario, 'id_permiso=' + permiso[0].id_permiso]);
      return { revocado: true };
    });
    res.json(r);
  } catch (e) {
    responder(res, e, 'revocar');
  }
});

module.exports = router;
