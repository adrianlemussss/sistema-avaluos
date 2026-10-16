const session = require('express-session');

// Almacen de sesiones en MySQL: las sesiones sobreviven a un reinicio del servidor.
// La vida de la sesion es absoluta (la fija la cookie al iniciar sesion); por eso no hay touch().
class AlmacenMySQL extends session.Store {
  constructor(pool) {
    super();
    this.pool = pool;
    const limpiar = () => {
      pool.query('DELETE FROM sesion WHERE expira < UTC_TIMESTAMP()').catch(() => {});
    };
    this.temporizador = setInterval(limpiar, 15 * 60 * 1000);
    this.temporizador.unref();
  }

  get(sid, cb) {
    this.pool.query('SELECT datos FROM sesion WHERE sid = ? AND expira > UTC_TIMESTAMP()', [sid])
      .then(([filas]) => cb(null, filas[0] ? JSON.parse(filas[0].datos) : null))
      .catch((e) => cb(e));
  }

  set(sid, sesion, cb) {
    const expira = sesion.cookie && sesion.cookie.expires
      ? new Date(sesion.cookie.expires)
      : new Date(Date.now() + 8 * 60 * 60 * 1000);
    this.pool.query(
      'INSERT INTO sesion (sid, datos, expira) VALUES (?, ?, ?) AS nueva ' +
      'ON DUPLICATE KEY UPDATE datos = nueva.datos, expira = nueva.expira',
      [sid, JSON.stringify(sesion), expira])
      .then(() => cb(null))
      .catch((e) => cb(e));
  }

  destroy(sid, cb) {
    this.pool.query('DELETE FROM sesion WHERE sid = ?', [sid])
      .then(() => cb(null))
      .catch((e) => cb(e));
  }
}

module.exports = AlmacenMySQL;
