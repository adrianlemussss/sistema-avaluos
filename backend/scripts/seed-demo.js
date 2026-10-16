// Datos de ejemplo FICTICIOS. Se ejecuta una vez; no duplica si ya existen.
const pool = require('../src/db');
const crypto = require('crypto');

// dias: antiguedad de la solicitud. camino: estados por los que pasa, en orden.
const MUESTRAS = [
  { cliente: 'cliente1@demo.test', tipo: 'Fiscal', origen: 'web', dias: 6,
    proposito: 'Traslado de dominio (demo)', bien: 'Casa habitacion en Coyoacan, CDMX (ficticia)',
    socio: 'socio.a@demo.test', camino: ['Asignada', 'En proceso'] },
  { cliente: 'cliente1@demo.test', tipo: 'Comercial', origen: 'llamada', dias: 3,
    proposito: 'Conocer valor comercial (demo)', bien: 'Local comercial en Polanco, CDMX (ficticio)',
    socio: 'socio.b@demo.test', camino: ['Asignada'] },
  { cliente: 'cliente1@demo.test', tipo: 'Catastral', origen: 'whatsapp', dias: 1,
    proposito: 'Actualizacion catastral (demo)', bien: 'Departamento en Narvarte, CDMX (ficticio)',
    socio: null, camino: [] },
  { cliente: 'cliente1@demo.test', tipo: 'Judicial', origen: 'recomendacion', dias: 12,
    proposito: 'Juicio intestamentario (demo)', bien: 'Casa en Azcapotzalco, CDMX (ficticia)',
    socio: 'socio.b@demo.test', camino: ['Asignada', 'En proceso', 'Entregada'],
    cotizacion: { importe: 22000, estatus: 'propuesta' } },
  { cliente: 'cliente2@demo.test', tipo: 'Judicial', origen: 'recomendacion', dias: 14,
    proposito: 'Juicio sucesorio testamentario (demo)', bien: 'Terreno en Tlalpan, CDMX (ficticio)',
    socio: 'socio.a@demo.test', camino: ['Asignada', 'En proceso', 'Entregada'],
    cotizacion: { importe: 18500, estatus: 'acordada' }, compartida: 'socio.b@demo.test' },
  { cliente: 'cliente2@demo.test', tipo: 'Credito', origen: 'empresa', dias: 9,
    proposito: 'Credito hipotecario (demo)', bien: 'Departamento en Iztapalapa, CDMX (ficticio)',
    socio: 'socio.b@demo.test', camino: ['Asignada', 'En proceso', 'Entregada'],
    cotizacion: { importe: 9800, estatus: 'acordada' } },
  { cliente: 'cliente2@demo.test', tipo: 'Comercial', origen: 'web', dias: 2,
    proposito: 'Valor de renta de bodega (demo)', bien: 'Bodega en Vallejo, CDMX (ficticia)',
    socio: null, camino: [] },
  { cliente: 'cliente2@demo.test', tipo: 'Fiscal', origen: 'llamada', dias: 5,
    proposito: 'Traslado de dominio por donacion (demo)', bien: 'Casa en Iztacalco, CDMX (ficticia)',
    socio: 'socio.a@demo.test', camino: ['Asignada', 'Cancelada'],
    motivo: 'El cliente desistio del tramite (demo)' },
];

async function idUsuario(email) {
  const [f] = await pool.query('SELECT id_usuario FROM usuario WHERE email = ?', [email]);
  if (!f[0]) throw new Error('Falta la cuenta ' + email + '. Corre npm run seed primero.');
  return f[0].id_usuario;
}

async function socioDe(email) {
  const usuario = await idUsuario(email);
  const [f] = await pool.query('SELECT id_socio FROM socio WHERE id_usuario = ?', [usuario]);
  return { usuario, socio: f[0].id_socio };
}

async function clienteDe(email) {
  const usuario = await idUsuario(email);
  const [f] = await pool.query('SELECT id_cliente FROM cliente WHERE id_usuario = ?', [usuario]);
  return { usuario, cliente: f[0].id_cliente };
}

async function main() {
  const [existentes] = await pool.query(
    "SELECT COUNT(*) AS n FROM solicitud WHERE proposito LIKE '%(demo)'");
  if (existentes[0].n > 0) {
    console.log('Ya existen datos de ejemplo. No se hizo nada.');
    await pool.end();
    return;
  }

  const [est] = await pool.query('SELECT id_estado, nombre FROM estado');
  const ESTADO = Object.fromEntries(est.map((e) => [e.nombre, e.id_estado]));
  const [tip] = await pool.query('SELECT id_tipo, nombre FROM tipo_avaluo');
  const TIPO = Object.fromEntries(tip.map((t) => [t.nombre, t.id_tipo]));
  const asistente = await idUsuario('asistente@demo.test');

  for (const m of MUESTRAS) {
    const cli = await clienteDe(m.cliente);
    const soc = m.socio ? await socioDe(m.socio) : null;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      let horas = m.dias * 24;
      const final = m.camino.length ? m.camino[m.camino.length - 1] : 'Recibida';
      const folio = 'AV-' + new Date().getUTCFullYear() + '-' +
        crypto.randomBytes(3).toString('hex').toUpperCase();
      const [ins] = await conn.query(
        'INSERT INTO solicitud (folio, id_cliente, id_tipo, id_socio, id_estado, origen, proposito, ' +
        'descripcion_bien, creada_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? HOUR))',
        [folio, cli.cliente, TIPO[m.tipo], soc ? soc.socio : null, ESTADO[final], m.origen,
          m.proposito, m.bien, horas]);
      const id = ins.insertId;

      const evento = (desde, hacia, actor, motivo, tipoEvento, h) => conn.query(
        'INSERT INTO historial_estado (id_solicitud, estado_anterior, estado_nuevo, id_usuario_actor, ' +
        'fecha_hora_utc, motivo, tipo_evento) VALUES (?, ?, ?, ?, DATE_SUB(UTC_TIMESTAMP(6), INTERVAL ? HOUR), ?, ?)',
        [id, desde, hacia, actor, h, motivo, tipoEvento]);
      const auditoria = (tipoEvento, actor, objetivo, detalle, h) => conn.query(
        'INSERT INTO auditoria_sistema (tipo_evento, id_usuario_actor, id_solicitud, id_usuario_objetivo, ' +
        'detalle, fecha_hora_utc) VALUES (?, ?, ?, ?, ?, DATE_SUB(UTC_TIMESTAMP(6), INTERVAL ? HOUR))',
        [tipoEvento, actor, id, objetivo, detalle, h]);

      await evento(null, ESTADO['Recibida'], m.origen === 'web' ? cli.usuario : asistente,
        null, 'creacion', horas);
      let anterior = 'Recibida';
      for (const paso of m.camino) {
        horas -= 6;
        const actor = paso === 'Asignada' ? asistente : soc.usuario;
        const motivo = paso === 'Cancelada' ? m.motivo : null;
        await evento(ESTADO[anterior], ESTADO[paso], actor, motivo, 'transicion', horas);
        if (paso === 'Asignada') {
          await conn.query(
            'INSERT INTO asignacion (id_solicitud, id_socio, id_usuario_asigna, asignada_en) ' +
            'VALUES (?, ?, ?, DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? HOUR))',
            [id, soc.socio, asistente, horas]);
        }
        anterior = paso;
      }

      if (m.cotizacion) {
        const [c] = await conn.query(
          'INSERT INTO cotizacion_administrativa (id_solicitud, importe, estatus, registrada_por, creada_en) ' +
          'VALUES (?, ?, ?, ?, DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? HOUR))',
          [id, m.cotizacion.importe, m.cotizacion.estatus, soc.usuario, horas + 3]);
        await auditoria('COTIZACION_REGISTRADA', soc.usuario, null, 'id_cotizacion=' + c.insertId, horas + 3);
        if (m.cotizacion.estatus !== 'propuesta') {
          await auditoria('COTIZACION_ESTATUS', soc.usuario, null,
            'id_cotizacion=' + c.insertId + ' propuesta->' + m.cotizacion.estatus, horas + 2);
        }
      }

      if (m.compartida) {
        const destino = await socioDe(m.compartida);
        const [p] = await conn.query(
          'INSERT INTO permiso_compartido (id_solicitud, id_socio_destino, autorizado_por, otorgado_en) ' +
          'VALUES (?, ?, ?, DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? HOUR))',
          [id, destino.socio, soc.usuario, horas + 1]);
        await auditoria('PERMISO_OTORGADO', soc.usuario, destino.usuario, 'id_permiso=' + p.insertId, horas + 1);
      }

      await conn.commit();
      console.log('creada:', folio, '-', m.proposito);
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
  await pool.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
