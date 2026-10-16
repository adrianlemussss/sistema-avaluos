const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { requireAuth, requireRol } = require('../middleware/auth');
const { perfil, condicionVisibilidad } = require('../services/acceso');

const router = express.Router();
router.use(requireAuth, requireRol('cliente', 'socio', 'asistente'));

const ORIGENES = ['whatsapp', 'llamada', 'recomendacion', 'empresa', 'web'];
const texto = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;
const entero = (v) => Number.isInteger(v) && v > 0;

const SELECT_BASE =
  'SELECT s.id_solicitud, s.folio, s.id_cliente, s.id_socio, s.origen, s.proposito, ' +
  's.descripcion_bien, s.creada_en, e.nombre AS estado, t.nombre AS tipo ' +
  'FROM solicitud s JOIN estado e ON e.id_estado = s.id_estado ' +
  'JOIN tipo_avaluo t ON t.id_tipo = s.id_tipo ';

router.get('/', async (req, res) => {
  try {
    const c = await condicionVisibilidad(req.session.usuario);
    const [filas] = await pool.query(
      SELECT_BASE + 'WHERE ' + c.sql + ' ORDER BY s.creada_en DESC LIMIT 200', c.params);
    res.json(filas);
  } catch (e) {
    console.error('solicitudes GET: error interno');
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!entero(id)) return res.status(404).json({ error: 'No encontrada' });
  try {
    const c = await condicionVisibilidad(req.session.usuario);
    const [filas] = await pool.query(
      SELECT_BASE + 'WHERE s.id_solicitud = ? AND (' + c.sql + ')', [id, ...c.params]);
    if (!filas[0]) return res.status(404).json({ error: 'No encontrada' });
    res.json(filas[0]);
  } catch (e) {
    console.error('solicitudes GET id: error interno');
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/', requireRol('cliente', 'asistente'), async (req, res) => {
  const b = req.body || {};
  const u = req.session.usuario;
  const idTipo = Number(b.id_tipo);
  if (!entero(idTipo) || !texto(b.proposito, 255) || !texto(b.descripcion_bien, 255)) {
    return res.status(400).json({ error: 'Datos invalidos' });
  }
  let idCliente;
  let origen;
  if (u.rol === 'cliente') {
    idCliente = (await perfil(u)).idCliente;
    origen = 'web';
  } else {
    idCliente = Number(b.id_cliente);
    origen = b.origen;
  }
  if (!entero(idCliente) || !ORIGENES.includes(origen)) {
    return res.status(400).json({ error: 'Datos invalidos' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const folio = 'AV-' + new Date().getUTCFullYear() + '-' +
      crypto.randomBytes(3).toString('hex').toUpperCase();
    const [r] = await conn.query(
      'INSERT INTO solicitud (folio, id_cliente, id_tipo, id_estado, origen, proposito, descripcion_bien) ' +
      'VALUES (?, ?, ?, 1, ?, ?, ?)',
      [folio, idCliente, idTipo, origen, b.proposito.trim(), b.descripcion_bien.trim()]);
    await conn.query(
      'INSERT INTO historial_estado (id_solicitud, estado_anterior, estado_nuevo, id_usuario_actor, tipo_evento) ' +
      'VALUES (?, NULL, 1, ?, ?)',
      [r.insertId, u.id, 'creacion']);
    await conn.commit();
    res.status(201).json({ id_solicitud: r.insertId, folio, estado: 'Recibida' });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'Datos invalidos' });
    console.error('solicitudes POST: error interno');
    res.status(500).json({ error: 'Error interno' });
  } finally {
    conn.release();
  }
});

module.exports = router;
