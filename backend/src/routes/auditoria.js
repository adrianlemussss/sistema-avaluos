const express = require('express');
const pool = require('../db');
const { requireAuth, requireRol } = require('../middleware/auth');
const { responder } = require('../services/comun');

const router = express.Router();

router.get('/', requireAuth, requireRol('admin'), async (req, res) => {
  let limite = Number(req.query.limite);
  if (!Number.isInteger(limite) || limite < 1 || limite > 200) limite = 100;
  try {
    const [filas] = await pool.query(
      'SELECT a.id_auditoria, a.tipo_evento, ac.nombre AS actor, ob.nombre AS objetivo, ' +
      'a.id_solicitud, a.detalle, a.fecha_hora_utc ' +
      'FROM auditoria_sistema a ' +
      'JOIN usuario ac ON ac.id_usuario = a.id_usuario_actor ' +
      'LEFT JOIN usuario ob ON ob.id_usuario = a.id_usuario_objetivo ' +
      'ORDER BY a.id_auditoria DESC LIMIT ?', [limite]);
    res.json(filas);
  } catch (e) {
    responder(res, e, 'auditoria');
  }
});

module.exports = router;
