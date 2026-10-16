const express = require('express');
const pool = require('../db');
const { requireAuth, requireRol } = require('../middleware/auth');
const { entero, falla, responder, enTransaccion, cargarComoDuenio } = require('../services/comun');

const router = express.Router();
// RF-11: solo el socio duenio ve y registra precios (supuesto por validar con la empresa).
const acceso = [requireAuth, requireRol('socio')];

const TRANSICIONES = {
  propuesta: ['acordada', 'cancelada'],
  acordada: ['cancelada'],
  cancelada: [],
};

// Importe en pesos, mayor a 0 y con hasta 2 decimales. Devuelve null si no es valido.
function importeValido(v) {
  if (typeof v !== 'number' && typeof v !== 'string') return null;
  const n = Number(String(v).trim());
  if (!Number.isFinite(n) || n <= 0 || n > 99999999.99) return null;
  if (Math.round(n * 100) / 100 !== n) return null;
  return n;
}

router.get('/:id/cotizaciones', ...acceso, async (req, res) => {
  const id = Number(req.params.id);
  if (!entero(id)) return res.status(404).json({ error: 'No encontrada' });
  try {
    await cargarComoDuenio(pool, req.session.usuario, id, false);
    const [filas] = await pool.query(
      'SELECT c.id_cotizacion, c.importe, c.estatus, c.creada_en, u.nombre AS registrada_por ' +
      'FROM cotizacion_administrativa c JOIN usuario u ON u.id_usuario = c.registrada_por ' +
      'WHERE c.id_solicitud = ? ORDER BY c.id_cotizacion DESC',
      [id]);
    res.json(filas);
  } catch (e) {
    responder(res, e, 'cotizaciones GET');
  }
});

router.post('/:id/cotizaciones', ...acceso, async (req, res) => {
  const id = Number(req.params.id);
  if (!entero(id)) return res.status(404).json({ error: 'No encontrada' });
  const importe = importeValido((req.body || {}).importe);
  if (importe === null) return res.status(400).json({ error: 'Datos invalidos' });
  const u = req.session.usuario;
  try {
    const r = await enTransaccion(async (conn) => {
      await cargarComoDuenio(conn, u, id, true);
      const [est] = await conn.query(
        'SELECT e.nombre AS estado FROM solicitud s JOIN estado e ON e.id_estado = s.id_estado ' +
        'WHERE s.id_solicitud = ?', [id]);
      if (est[0].estado === 'Cancelada') throw falla(409, 'Solicitud cancelada');
      const [ins] = await conn.query(
        'INSERT INTO cotizacion_administrativa (id_solicitud, importe, registrada_por) VALUES (?, ?, ?)',
        [id, importe, u.id]);
      await conn.query(
        'INSERT INTO auditoria_sistema (tipo_evento, id_usuario_actor, id_solicitud, detalle) VALUES (?, ?, ?, ?)',
        ['COTIZACION_REGISTRADA', u.id, id, 'id_cotizacion=' + ins.insertId]);
      return { id_cotizacion: ins.insertId };
    });
    res.status(201).json(r);
  } catch (e) {
    responder(res, e, 'cotizaciones POST');
  }
});

router.post('/:id/cotizaciones/:idCot/estatus', ...acceso, async (req, res) => {
  const id = Number(req.params.id);
  const idCot = Number(req.params.idCot);
  const nuevo = (req.body || {}).estatus;
  if (!entero(id) || !entero(idCot)) return res.status(404).json({ error: 'No encontrada' });
  if (typeof nuevo !== 'string' || !Object.hasOwn(TRANSICIONES, nuevo)) {
    return res.status(400).json({ error: 'Datos invalidos' });
  }
  const u = req.session.usuario;
  try {
    const r = await enTransaccion(async (conn) => {
      await cargarComoDuenio(conn, u, id, true);
      const [c] = await conn.query(
        'SELECT id_cotizacion, estatus FROM cotizacion_administrativa ' +
        'WHERE id_cotizacion = ? AND id_solicitud = ? FOR UPDATE', [idCot, id]);
      if (!c[0]) throw falla(404, 'No encontrada');
      if (!TRANSICIONES[c[0].estatus].includes(nuevo)) throw falla(409, 'Transicion no permitida');
      await conn.query('UPDATE cotizacion_administrativa SET estatus = ? WHERE id_cotizacion = ?', [nuevo, idCot]);
      await conn.query(
        'INSERT INTO auditoria_sistema (tipo_evento, id_usuario_actor, id_solicitud, detalle) VALUES (?, ?, ?, ?)',
        ['COTIZACION_ESTATUS', u.id, id, 'id_cotizacion=' + idCot + ' ' + c[0].estatus + '->' + nuevo]);
      return { id_cotizacion: idCot, estatus: nuevo };
    });
    res.json(r);
  } catch (e) {
    responder(res, e, 'cotizaciones estatus');
  }
});

module.exports = router;
