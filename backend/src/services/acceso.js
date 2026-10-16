const pool = require('../db');

// P-07: por defecto la asistente ve todas las solicitudes; se desactiva con false.
const asistenteGlobal = () => process.env.ASISTENTE_ACCESO_GLOBAL !== 'false';

async function perfil(u) {
  if (u.rol === 'socio') {
    const [r] = await pool.query('SELECT id_socio FROM socio WHERE id_usuario = ?', [u.id]);
    return { idSocio: r[0] ? r[0].id_socio : null };
  }
  if (u.rol === 'cliente') {
    const [r] = await pool.query('SELECT id_cliente FROM cliente WHERE id_usuario = ?', [u.id]);
    return { idCliente: r[0] ? r[0].id_cliente : null };
  }
  return {};
}

// Condicion SQL de visibilidad sobre la tabla solicitud (alias s).
async function condicionVisibilidad(u) {
  const p = await perfil(u);
  if (u.rol === 'cliente' && p.idCliente) {
    return { sql: 's.id_cliente = ?', params: [p.idCliente] };
  }
  if (u.rol === 'socio' && p.idSocio) {
    return {
      sql: '(s.id_socio = ? OR EXISTS (SELECT 1 FROM permiso_compartido pc ' +
           'WHERE pc.id_solicitud = s.id_solicitud AND pc.id_socio_destino = ? ' +
           'AND pc.revocado_en IS NULL))',
      params: [p.idSocio, p.idSocio],
    };
  }
  if (u.rol === 'asistente' && asistenteGlobal()) {
    return { sql: '1 = 1', params: [] };
  }
  return { sql: '1 = 0', params: [] };
}

module.exports = { perfil, condicionVisibilidad };
