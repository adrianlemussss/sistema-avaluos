const express = require('express');
const pool = require('../db');
const { requireAuth, requireRol } = require('../middleware/auth');
const { entero, responder } = require('../services/comun');
const { condicionVisibilidad } = require('../services/acceso');

const router = express.Router();

function fechaValida(v) {
  if (typeof v !== 'string' || v.length !== 10) return false;
  return /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'));
}

// RF-13: conteos sobre las solicitudes que el usuario puede ver, con filtros opcionales.
router.get('/resumen', requireAuth, requireRol('socio', 'asistente'), async (req, res) => {
  const u = req.session.usuario;
  const desde = req.query.desde;
  const hasta = req.query.hasta;
  const socio = req.query.socio === undefined ? null : Number(req.query.socio);
  if (desde !== undefined && !fechaValida(desde)) return res.status(400).json({ error: 'Datos invalidos' });
  if (hasta !== undefined && !fechaValida(hasta)) return res.status(400).json({ error: 'Datos invalidos' });
  if (socio !== null && !entero(socio)) return res.status(400).json({ error: 'Datos invalidos' });
  try {
    const c = await condicionVisibilidad(u);
    let donde = '(' + c.sql + ')';
    const params = [...c.params];
    if (desde) { donde += ' AND s.creada_en >= ?'; params.push(desde); }
    if (hasta) { donde += ' AND s.creada_en < DATE_ADD(?, INTERVAL 1 DAY)'; params.push(hasta); }
    if (socio !== null) { donde += ' AND s.id_socio = ?'; params.push(socio); }

    const base =
      'FROM solicitud s JOIN estado e ON e.id_estado = s.id_estado ' +
      'JOIN tipo_avaluo t ON t.id_tipo = s.id_tipo ' +
      'LEFT JOIN socio so ON so.id_socio = s.id_socio ' +
      'LEFT JOIN usuario us ON us.id_usuario = so.id_usuario WHERE ' + donde;

    const [total] = await pool.query('SELECT COUNT(*) AS n ' + base, params);
    const [abiertas] = await pool.query(
      "SELECT COUNT(*) AS n " + base + " AND e.nombre NOT IN ('Entregada', 'Cancelada')", params);
    const [porEstado] = await pool.query(
      'SELECT e.nombre AS etiqueta, COUNT(*) AS total ' + base +
      ' GROUP BY e.id_estado, e.nombre ORDER BY e.id_estado', params);
    const [porTipo] = await pool.query(
      'SELECT t.nombre AS etiqueta, COUNT(*) AS total ' + base +
      ' GROUP BY t.id_tipo, t.nombre ORDER BY total DESC, t.nombre', params);
    const [porResponsable] = await pool.query(
      "SELECT COALESCE(us.nombre, 'Sin asignar') AS etiqueta, COUNT(*) AS total " + base +
      ' GROUP BY s.id_socio, us.nombre ORDER BY total DESC', params);
    const [porMes] = await pool.query(
      "SELECT DATE_FORMAT(s.creada_en, '%Y-%m') AS etiqueta, COUNT(*) AS total " + base +
      ' GROUP BY etiqueta ORDER BY etiqueta', params);

    res.json({
      total: total[0].n,
      abiertas: abiertas[0].n,
      por_estado: porEstado,
      por_tipo: porTipo,
      por_responsable: porResponsable,
      por_mes: porMes,
    });
  } catch (e) {
    responder(res, e, 'reportes');
  }
});

module.exports = router;
