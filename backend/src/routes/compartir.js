const express = require('express');
const { requireAuth, requireRol } = require('../middleware/auth');
const { entero, falla, responder, enTransaccion, cargarComoDuenio } = require('../services/comun');

const router = express.Router();
// P-05: solo el socio duenio decide compartir (pendiente de validar con los socios).
const acceso = [requireAuth, requireRol('socio')];

router.post('/:id/compartir', ...acceso, async (req, res) => {
  const id = Number(req.params.id);
  const destino = Number((req.body || {}).id_socio);
  if (!entero(id)) return res.status(404).json({ error: 'No encontrada' });
  if (!entero(destino)) return res.status(400).json({ error: 'Datos invalidos' });
  const u = req.session.usuario;
  try {
    const r = await enTransaccion(async (conn) => {
      const { idSocio } = await cargarComoDuenio(conn, u, id, true);
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
      await cargarComoDuenio(conn, u, id, true);
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
