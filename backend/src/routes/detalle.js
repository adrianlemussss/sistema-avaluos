const express = require('express');
const pool = require('../db');
const { requireAuth, requireRol } = require('../middleware/auth');
const { perfil, condicionVisibilidad } = require('../services/acceso');
const { TRANSICIONES } = require('../services/estados');

const router = express.Router();

router.get('/:id/detalle', requireAuth, requireRol('cliente', 'socio', 'asistente'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'No encontrada' });
  const u = req.session.usuario;
  try {
    const c = await condicionVisibilidad(u);
    const [filas] = await pool.query(
      'SELECT s.id_solicitud, s.folio, s.id_socio, s.origen, s.proposito, s.descripcion_bien, s.creada_en, ' +
      'e.nombre AS estado, t.nombre AS tipo, cl.nombre AS cliente, us.nombre AS socio ' +
      'FROM solicitud s ' +
      'JOIN estado e ON e.id_estado = s.id_estado ' +
      'JOIN tipo_avaluo t ON t.id_tipo = s.id_tipo ' +
      'JOIN cliente cl ON cl.id_cliente = s.id_cliente ' +
      'LEFT JOIN socio so ON so.id_socio = s.id_socio ' +
      'LEFT JOIN usuario us ON us.id_usuario = so.id_usuario ' +
      'WHERE s.id_solicitud = ? AND (' + c.sql + ')',
      [id, ...c.params]);
    const s = filas[0];
    if (!s) return res.status(404).json({ error: 'No encontrada' });

    const p = await perfil(u);
    const esDuenio = u.rol === 'socio' && p.idSocio === s.id_socio;

    const [h] = await pool.query(
      'SELECT h.fecha_hora_utc, en.nombre AS estado_nuevo, ac.nombre AS actor, h.motivo, h.tipo_evento ' +
      'FROM historial_estado h ' +
      'JOIN estado en ON en.id_estado = h.estado_nuevo ' +
      'JOIN usuario ac ON ac.id_usuario = h.id_usuario_actor ' +
      'WHERE h.id_solicitud = ? ORDER BY h.id_historial',
      [id]);
    // El cliente solo ve estados y fechas (matriz de acceso del documento).
    const historial = u.rol === 'cliente'
      ? h.map((e) => ({ fecha_hora_utc: e.fecha_hora_utc, estado_nuevo: e.estado_nuevo }))
      : h;

    let estados = [];
    if (esDuenio) {
      estados = (TRANSICIONES[s.estado] || []).filter((x) => x !== 'Asignada');
    } else if (u.rol === 'asistente' && s.estado === 'Recibida') {
      estados = ['Cancelada'];
    }
    const acciones = {
      asignar: u.rol === 'asistente' && s.estado === 'Recibida',
      estados,
      compartir: esDuenio,
    };

    let compartidaCon = [];
    if (esDuenio) {
      const [perm] = await pool.query(
        'SELECT p.id_socio_destino AS id_socio, us.nombre FROM permiso_compartido p ' +
        'JOIN socio so ON so.id_socio = p.id_socio_destino ' +
        'JOIN usuario us ON us.id_usuario = so.id_usuario ' +
        'WHERE p.id_solicitud = ? AND p.revocado_en IS NULL ORDER BY us.nombre',
        [id]);
      compartidaCon = perm;
    }

    res.json({ solicitud: s, historial, acciones, compartida_con: compartidaCon });
  } catch (e) {
    console.error('detalle: error interno');
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
