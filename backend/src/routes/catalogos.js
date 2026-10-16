const express = require('express');
const pool = require('../db');
const { requireAuth, requireRol } = require('../middleware/auth');
const { perfil } = require('../services/acceso');

const router = express.Router();
const ORIGENES = ['whatsapp', 'llamada', 'recomendacion', 'empresa', 'web'];

function fallo(res, etiqueta) {
  console.error(etiqueta + ': error interno');
  res.status(500).json({ error: 'Error interno' });
}

router.get('/catalogos', requireAuth, async (req, res) => {
  try {
    const [tipos] = await pool.query('SELECT id_tipo, nombre FROM tipo_avaluo ORDER BY id_tipo');
    const [estados] = await pool.query('SELECT id_estado, nombre FROM estado ORDER BY id_estado');
    res.json({ tipos, estados, origenes: ORIGENES });
  } catch (e) {
    fallo(res, 'catalogos');
  }
});

// P-07: la asistente registra solicitudes en nombre de cualquier cliente.
router.get('/clientes', requireAuth, requireRol('asistente'), async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT id_cliente, nombre, email FROM cliente ORDER BY nombre');
    res.json(filas);
  } catch (e) {
    fallo(res, 'clientes');
  }
});

router.get('/socios', requireAuth, requireRol('asistente', 'socio'), async (req, res) => {
  try {
    const usuario = req.session.usuario;
    let sql = 'SELECT s.id_socio, u.nombre FROM socio s ' +
      'JOIN usuario u ON u.id_usuario = s.id_usuario WHERE u.activo = 1';
    const params = [];
    if (usuario.rol === 'socio') {
      const p = await perfil(usuario);
      sql += ' AND s.id_socio <> ?';
      params.push(p.idSocio);
    }
    const [filas] = await pool.query(sql + ' ORDER BY u.nombre', params);
    res.json(filas);
  } catch (e) {
    fallo(res, 'socios');
  }
});

module.exports = router;
