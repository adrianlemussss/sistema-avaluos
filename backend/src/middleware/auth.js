const pool = require('../db');

// Revisa en la base el estado y el rol actuales: una baja o un cambio de rol aplican de inmediato.
async function requireAuth(req, res, next) {
  const sesion = req.session.usuario;
  if (!sesion) return res.status(401).json({ error: 'No autenticado' });
  try {
    const [f] = await pool.query(
      'SELECT u.activo, r.nombre AS rol FROM usuario u JOIN rol r ON r.id_rol = u.id_rol ' +
      'WHERE u.id_usuario = ?', [sesion.id]);
    if (!f[0] || !f[0].activo) {
      return req.session.destroy(() => res.status(401).json({ error: 'No autenticado' }));
    }
    sesion.rol = f[0].rol;
    next();
  } catch (e) {
    console.error('auth: error interno');
    res.status(500).json({ error: 'Error interno' });
  }
}

function requireRol(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.session.usuario.rol)) {
      return res.status(403).json({ error: 'Sin permiso' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRol };
