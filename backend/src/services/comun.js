const pool = require('../db');
const { perfil, condicionVisibilidad } = require('./acceso');

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

// 404 si no la ve; 403 si la ve (por comparticion) pero no es el duenio.
// Con bloquear = true bloquea la fila (usar dentro de una transaccion).
async function cargarComoDuenio(conn, u, id, bloquear) {
  const c = await condicionVisibilidad(u);
  const [f] = await conn.query(
    'SELECT s.id_solicitud, s.id_socio FROM solicitud s ' +
    'WHERE s.id_solicitud = ? AND (' + c.sql + ')' + (bloquear ? ' FOR UPDATE OF s' : ''),
    [id, ...c.params]);
  if (!f[0]) throw falla(404, 'No encontrada');
  const p = await perfil(u);
  if (f[0].id_socio !== p.idSocio) throw falla(403, 'Sin permiso');
  return { idSocio: p.idSocio };
}

module.exports = { entero, falla, responder, enTransaccion, cargarComoDuenio };
