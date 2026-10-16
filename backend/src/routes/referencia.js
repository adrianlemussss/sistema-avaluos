const express = require('express');
const { requireAuth, requireRol } = require('../middleware/auth');
const { entero, falla, responder, enTransaccion, cargarComoDuenio } = require('../services/comun');

const router = express.Router();
const acceso = [requireAuth, requireRol('socio')];

// RF-19: solo texto plano. No existe ninguna ruta que reciba archivos.
function referenciaValida(v) {
  if (typeof v !== 'string') return false;
  const t = v.trim();
  return t.length > 0 && t.length <= 120 && !/[\u0000-\u001f]/.test(t);
}

router.post('/:id/referencia', ...acceso, async (req, res) => {
  const id = Number(req.params.id);
  const referencia = (req.body || {}).referencia;
  if (!entero(id)) return res.status(404).json({ error: 'No encontrada' });
  if (!referenciaValida(referencia)) return res.status(400).json({ error: 'Datos invalidos' });
  const u = req.session.usuario;
  try {
    const r = await enTransaccion(async (conn) => {
      await cargarComoDuenio(conn, u, id, true);
      const [est] = await conn.query(
        'SELECT e.nombre AS estado FROM solicitud s JOIN estado e ON e.id_estado = s.id_estado ' +
        'WHERE s.id_solicitud = ?', [id]);
      if (est[0].estado !== 'Entregada') throw falla(409, 'Solo se registra al entregar');
      await conn.query('UPDATE solicitud SET referencia_entrega = ? WHERE id_solicitud = ?',
        [referencia.trim(), id]);
      await conn.query(
        'INSERT INTO auditoria_sistema (tipo_evento, id_usuario_actor, id_solicitud, detalle) VALUES (?, ?, ?, ?)',
        ['REFERENCIA_REGISTRADA', u.id, id, 'referencia de entrega actualizada']);
      return { id_solicitud: id };
    });
    res.json(r);
  } catch (e) {
    responder(res, e, 'referencia');
  }
});

module.exports = router;
