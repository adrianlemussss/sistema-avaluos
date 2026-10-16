// Pruebas de integracion CP-01..CP-09. Solo corren contra la base avaluos_test.
process.env.DB_NAME = 'avaluos_test';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const pool = require('../src/db');
const app = require('../src/app');

const PASS = 'ClavePrueba-12345';
const SUF = String(Date.now());
const mail = (n) => n + '.' + SUF + '@test.local';
const SOLICITUD = {
  id_tipo: 1,
  proposito: 'Traslado de dominio (ficticio)',
  descripcion_bien: 'Departamento ficticio',
};

let servidor;
let base;
const ids = {};
const u = {};
let idSol;

function nuevoCliente() {
  let cookie = '';
  async function llamar(metodo, ruta, cuerpo) {
    const cabeceras = { 'Content-Type': 'application/json' };
    if (cookie) cabeceras.Cookie = cookie;
    const r = await fetch(base + ruta, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const sc = r.headers.getSetCookie();
    if (sc.length) cookie = sc[0].split(';')[0];
    let json = null;
    try { json = await r.json(); } catch (e) { json = null; }
    return { status: r.status, json };
  }
  async function entrar(email) {
    const r = await llamar('POST', '/api/auth/login', { email, password: PASS });
    assert.equal(r.status, 200);
  }
  return { llamar, entrar };
}

async function crearUsuario(hash, email, nombre, rol) {
  const [r] = await pool.query(
    'INSERT INTO usuario (email, nombre, password_hash, id_rol) VALUES (?, ?, ?, ?)',
    [email, nombre, hash, rol]);
  return r.insertId;
}

async function contar(tabla) {
  const [filas] = await pool.query('SELECT COUNT(*) AS n FROM ' + tabla);
  return filas[0].n;
}

before(async () => {
  const [db] = await pool.query('SELECT DATABASE() AS d');
  assert.equal(db[0].d, 'avaluos_test', 'Las pruebas solo corren en avaluos_test');

  const hash = await bcrypt.hash(PASS, 4);
  const uA = await crearUsuario(hash, mail('socio.a'), 'Socio A', 2);
  const uB = await crearUsuario(hash, mail('socio.b'), 'Socio B', 2);
  await crearUsuario(hash, mail('asistente'), 'Asistente', 3);
  await crearUsuario(hash, mail('admin'), 'Admin', 4);
  const c1 = await crearUsuario(hash, mail('cliente1'), 'Cliente 1', 1);
  const c2 = await crearUsuario(hash, mail('cliente2'), 'Cliente 2', 1);
  const [sa] = await pool.query('INSERT INTO socio (id_usuario) VALUES (?)', [uA]);
  const [sb] = await pool.query('INSERT INTO socio (id_usuario) VALUES (?)', [uB]);
  ids.socioA = sa.insertId;
  ids.socioB = sb.insertId;
  await pool.query('INSERT INTO cliente (id_usuario, nombre, email) VALUES (?, ?, ?)',
    [c1, 'Cliente 1', mail('cliente1')]);
  await pool.query('INSERT INTO cliente (id_usuario, nombre, email) VALUES (?, ?, ?)',
    [c2, 'Cliente 2', mail('cliente2')]);

  await new Promise((ok) => { servidor = app.listen(0, '127.0.0.1', ok); });
  base = 'http://127.0.0.1:' + servidor.address().port;

  for (const [clave, correo] of [
    ['socioA', 'socio.a'], ['socioB', 'socio.b'], ['asistente', 'asistente'],
    ['admin', 'admin'], ['cliente1', 'cliente1'], ['cliente2', 'cliente2'],
  ]) {
    u[clave] = nuevoCliente();
    await u[clave].entrar(mail(correo));
  }
});

after(async () => {
  servidor.closeAllConnections();
  await new Promise((ok) => servidor.close(ok));
  await pool.end();
});

test('autenticacion: sin sesion 401 y clave incorrecta 401', async () => {
  const anonimo = nuevoCliente();
  assert.equal((await anonimo.llamar('GET', '/api/solicitudes')).status, 401);
  const r = await anonimo.llamar('POST', '/api/auth/login',
    { email: mail('socio.a'), password: 'incorrecta-12345' });
  assert.equal(r.status, 401);
});

test('CP-01 solicitud valida: folio unico, estado Recibida e historial', async () => {
  const r = await u.cliente1.llamar('POST', '/api/solicitudes', SOLICITUD);
  assert.equal(r.status, 201);
  assert.match(r.json.folio, /^AV-\d{4}-[0-9A-F]{6}/);
  assert.equal(r.json.folio.length, 14);
  assert.equal(r.json.estado, 'Recibida');
  idSol = r.json.id_solicitud;
  const [h] = await pool.query(
    'SELECT estado_anterior, estado_nuevo, tipo_evento FROM historial_estado WHERE id_solicitud = ?',
    [idSol]);
  assert.equal(h.length, 1);
  assert.equal(h[0].estado_anterior, null);
  assert.equal(h[0].estado_nuevo, 1);
  assert.equal(h[0].tipo_evento, 'creacion');
});

test('CP-02 solicitud sin campos requeridos: error y sin registro parcial', async () => {
  const sol = await contar('solicitud');
  const his = await contar('historial_estado');
  const r = await u.cliente1.llamar('POST', '/api/solicitudes', { proposito: 'solo esto' });
  assert.equal(r.status, 400);
  assert.equal(await contar('solicitud'), sol);
  assert.equal(await contar('historial_estado'), his);
});

test('CP-09 y visibilidad por rol antes de asignar', async () => {
  const ruta = '/api/solicitudes/' + idSol;
  assert.equal((await u.cliente2.llamar('GET', ruta)).status, 404);
  assert.equal((await u.socioA.llamar('GET', ruta)).status, 404);
  assert.equal((await u.admin.llamar('GET', '/api/solicitudes')).status, 403);
  const propia = await u.cliente1.llamar('GET', ruta);
  assert.equal(propia.status, 200);
  const lista = await u.asistente.llamar('GET', '/api/solicitudes');
  assert.ok(lista.json.some((s) => s.id_solicitud === idSol));
});

test('CP-05 asignar: cambia el estado y registra el historial', async () => {
  const r = await u.asistente.llamar('POST', '/api/solicitudes/' + idSol + '/asignar',
    { id_socio: ids.socioA });
  assert.equal(r.status, 200);
  assert.equal(r.json.estado, 'Asignada');
  const [h] = await pool.query(
    'SELECT COUNT(*) AS n FROM historial_estado WHERE id_solicitud = ?', [idSol]);
  assert.equal(h[0].n, 2);
});

test('CP-03 el socio B no ve la cartera del socio A', async () => {
  const lista = await u.socioB.llamar('GET', '/api/solicitudes');
  assert.deepEqual(lista.json, []);
  assert.equal((await u.socioB.llamar('GET', '/api/solicitudes/' + idSol)).status, 404);
  assert.equal((await u.socioB.llamar('POST', '/api/solicitudes/' + idSol + '/estado',
    { estado: 'En proceso' })).status, 404);
});

test('CP-06 salto de estado invalido: rechazado y estado intacto', async () => {
  const ruta = '/api/solicitudes/' + idSol;
  const r = await u.socioA.llamar('POST', ruta + '/estado', { estado: 'Entregada' });
  assert.equal(r.status, 409);
  assert.equal((await u.socioA.llamar('GET', ruta)).json.estado, 'Asignada');
});

test('CP-07 cancelar sin motivo: rechazado y estado conservado', async () => {
  const ruta = '/api/solicitudes/' + idSol;
  const r = await u.socioA.llamar('POST', ruta + '/estado', { estado: 'Cancelada' });
  assert.equal(r.status, 400);
  assert.equal((await u.socioA.llamar('GET', ruta)).json.estado, 'Asignada');
});

test('flujo completo hasta Entregada y estados finales cerrados', async () => {
  const ruta = '/api/solicitudes/' + idSol;
  assert.equal((await u.socioA.llamar('POST', ruta + '/estado', { estado: 'En proceso' })).status, 200);
  assert.equal((await u.socioA.llamar('POST', ruta + '/estado', { estado: 'Entregada' })).status, 200);
  const cancelar = await u.socioA.llamar('POST', ruta + '/estado',
    { estado: 'Cancelada', motivo: 'prueba' });
  assert.equal(cancelar.status, 409);
  const h = await u.socioA.llamar('GET', ruta + '/historial');
  assert.equal(h.status, 200);
  assert.deepEqual(h.json.map((e) => e.estado_nuevo),
    ['Recibida', 'Asignada', 'En proceso', 'Entregada']);
});

test('CP-04 compartir un caso: solo consulta, auditoria y revocacion', async () => {
  const ruta = '/api/solicitudes/' + idSol;
  const dar = await u.socioA.llamar('POST', ruta + '/compartir', { id_socio: ids.socioB });
  assert.equal(dar.status, 201);
  assert.equal((await u.socioB.llamar('GET', ruta)).status, 200);
  assert.equal((await u.socioB.llamar('POST', ruta + '/estado',
    { estado: 'Cancelada', motivo: 'x' })).status, 403);
  assert.equal((await u.socioB.llamar('POST', ruta + '/compartir',
    { id_socio: ids.socioA })).status, 403);
  assert.equal((await u.socioA.llamar('POST', ruta + '/compartir',
    { id_socio: ids.socioB })).status, 409);
  assert.equal((await u.socioA.llamar('POST', ruta + '/compartir',
    { id_socio: ids.socioA })).status, 400);
  const quitar = await u.socioA.llamar('DELETE', ruta + '/compartir/' + ids.socioB);
  assert.equal(quitar.status, 200);
  assert.equal((await u.socioB.llamar('GET', ruta)).status, 404);
  const [aud] = await pool.query(
    'SELECT tipo_evento FROM auditoria_sistema WHERE id_solicitud = ? ORDER BY id_auditoria',
    [idSol]);
  assert.deepEqual(aud.map((a) => a.tipo_evento), ['PERMISO_OTORGADO', 'PERMISO_REVOCADO']);
});

test('CP-08 las bitacoras no se pueden editar ni borrar', async () => {
  await assert.rejects(
    pool.query('UPDATE historial_estado SET motivo = ? WHERE id_solicitud = ?', ['x', idSol]),
    /solo-insercion/);
  await assert.rejects(
    pool.query('DELETE FROM historial_estado WHERE id_solicitud = ?', [idSol]),
    /solo-insercion/);
  await assert.rejects(
    pool.query('UPDATE auditoria_sistema SET detalle = ? WHERE id_solicitud = ?', ['x', idSol]),
    /solo-insercion/);
  await assert.rejects(
    pool.query('DELETE FROM auditoria_sistema WHERE id_solicitud = ?', [idSol]),
    /solo-insercion/);
});

test('RF-11 cotizacion: solo el socio duenio registra y consulta', async () => {
  const ruta = '/api/solicitudes/' + idSol + '/cotizaciones';
  assert.equal((await u.socioB.llamar('POST', ruta, { importe: 1500 })).status, 404);
  assert.equal((await u.cliente1.llamar('GET', ruta)).status, 403);
  assert.equal((await u.asistente.llamar('GET', ruta)).status, 403);
  assert.equal((await u.socioA.llamar('POST', ruta, { importe: -5 })).status, 400);
  assert.equal((await u.socioA.llamar('POST', ruta, { importe: 'abc' })).status, 400);
  assert.equal((await u.socioA.llamar('POST', ruta, { importe: 10.123 })).status, 400);
  const ok = await u.socioA.llamar('POST', ruta, { importe: 1500.5 });
  assert.equal(ok.status, 201);
  const lista = await u.socioA.llamar('GET', ruta);
  assert.equal(lista.json.length, 1);
  assert.equal(Number(lista.json[0].importe), 1500.5);
  assert.equal(lista.json[0].estatus, 'propuesta');
  const est = ruta + '/' + ok.json.id_cotizacion + '/estatus';
  assert.equal((await u.socioA.llamar('POST', est, { estatus: 'acordada' })).status, 200);
  assert.equal((await u.socioA.llamar('POST', est, { estatus: 'propuesta' })).status, 409);
  assert.equal((await u.socioA.llamar('POST', est, { estatus: 'inexistente' })).status, 400);
  assert.equal((await u.socioA.llamar('POST', est, { estatus: 'cancelada' })).status, 200);
  assert.equal((await u.socioA.llamar('POST', est, { estatus: 'acordada' })).status, 409);
  const [aud] = await pool.query(
    "SELECT tipo_evento FROM auditoria_sistema WHERE id_solicitud = ? AND tipo_evento LIKE 'COTIZACION%' ORDER BY id_auditoria",
    [idSol]);
  assert.deepEqual(aud.map((a) => a.tipo_evento),
    ['COTIZACION_REGISTRADA', 'COTIZACION_ESTATUS', 'COTIZACION_ESTATUS']);
});


test('RF-13 reportes: conteos consistentes y limitados a lo visible', async () => {
  const ruta = '/api/reportes/resumen';
  assert.equal((await u.cliente1.llamar('GET', ruta)).status, 403);
  assert.equal((await u.admin.llamar('GET', ruta)).status, 403);
  assert.equal((await u.socioA.llamar('GET', ruta + '?desde=ayer')).status, 400);
  assert.equal((await u.socioA.llamar('GET', ruta + '?socio=abc')).status, 400);

  const suma = (filas) => filas.reduce((acc, f) => acc + f.total, 0);
  const a = await u.socioA.llamar('GET', ruta);
  assert.equal(a.status, 200);
  assert.ok(a.json.total >= 1);
  assert.equal(suma(a.json.por_estado), a.json.total);
  assert.equal(suma(a.json.por_tipo), a.json.total);
  assert.equal(suma(a.json.por_responsable), a.json.total);
  assert.equal(suma(a.json.por_mes), a.json.total);

  // El socio B no es duenio de nada y su acceso compartido ya fue revocado.
  const b = await u.socioB.llamar('GET', ruta);
  assert.equal(b.json.total, 0);
  assert.deepEqual(b.json.por_estado, []);

  const asis = await u.asistente.llamar('GET', ruta);
  assert.ok(asis.json.total >= a.json.total);
  const futuro = await u.asistente.llamar('GET', ruta + '?desde=2999-01-01');
  assert.equal(futuro.json.total, 0);
});

test('RF-15 usuarios: solo admin gestiona; rol y baja aplican de inmediato', async () => {
  const datos = { nombre: 'Nuevo Socio', email: 'x@test.local', password: 'ClaveLarga-12345', rol: 'admin' };
  for (const cli of [u.socioA, u.asistente, u.cliente1]) {
    assert.equal((await cli.llamar('GET', '/api/usuarios')).status, 403);
    assert.equal((await cli.llamar('POST', '/api/usuarios', datos)).status, 403);
    assert.equal((await cli.llamar('GET', '/api/auditoria')).status, 403);
  }

  const correo = 'nuevo.' + SUF + '@test.local';
  const base = { nombre: 'Nuevo Socio', password: 'ClaveLarga-12345', rol: 'socio', email: correo };
  assert.equal((await u.admin.llamar('POST', '/api/usuarios', { ...base, password: 'corta' })).status, 400);
  assert.equal((await u.admin.llamar('POST', '/api/usuarios', { ...base, email: 'sin-arroba' })).status, 400);
  assert.equal((await u.admin.llamar('POST', '/api/usuarios', { ...base, rol: 'superusuario' })).status, 400);
  const crear = await u.admin.llamar('POST', '/api/usuarios', base);
  assert.equal(crear.status, 201);
  const idNuevo = crear.json.id_usuario;
  assert.equal((await u.admin.llamar('POST', '/api/usuarios', base)).status, 409);

  const nuevo = nuevoCliente();
  const entrada = await nuevo.llamar('POST', '/api/auth/login', { email: correo, password: base.password });
  assert.equal(entrada.status, 200);
  const lista = await nuevo.llamar('GET', '/api/solicitudes');
  assert.equal(lista.status, 200);
  assert.deepEqual(lista.json, []);

  // El cambio de rol se aplica a la sesion que ya estaba abierta.
  const cambio = await u.admin.llamar('POST', '/api/usuarios/' + idNuevo + '/rol', { rol: 'asistente' });
  assert.equal(cambio.status, 200);
  assert.equal((await nuevo.llamar('GET', '/api/auth/me')).json.rol, 'asistente');
  assert.equal((await u.admin.llamar('POST', '/api/usuarios/' + idNuevo + '/rol', { rol: 'asistente' })).status, 409);

  const yo = (await u.admin.llamar('GET', '/api/auth/me')).json.id;
  assert.equal((await u.admin.llamar('POST', '/api/usuarios/' + yo + '/rol', { rol: 'socio' })).status, 409);
  assert.equal((await u.admin.llamar('POST', '/api/usuarios/' + yo + '/activo', { activo: false })).status, 409);
  assert.equal((await u.admin.llamar('POST', '/api/usuarios/' + idNuevo + '/activo', { activo: 'no' })).status, 400);

  // La baja corta la sesion abierta y bloquea el inicio de sesion.
  const baja = await u.admin.llamar('POST', '/api/usuarios/' + idNuevo + '/activo', { activo: false });
  assert.equal(baja.status, 200);
  assert.equal((await nuevo.llamar('GET', '/api/auth/me')).status, 401);
  const otra = nuevoCliente();
  assert.equal((await otra.llamar('POST', '/api/auth/login', { email: correo, password: base.password })).status, 401);

  const aud = await u.admin.llamar('GET', '/api/auditoria');
  assert.equal(aud.status, 200);
  const eventos = aud.json.map((e) => e.tipo_evento);
  assert.ok(eventos.includes('USUARIO_CREADO'));
  assert.ok(eventos.includes('USUARIO_ROL'));
  assert.ok(eventos.includes('USUARIO_ACTIVO'));
});

test('RF-19 referencia de entrega: solo texto, solo el socio duenio, solo al entregar', async () => {
  const ruta = '/api/solicitudes/' + idSol + '/referencia';
  assert.equal((await u.socioB.llamar('POST', ruta, { referencia: 'X-1' })).status, 404);
  assert.equal((await u.cliente1.llamar('POST', ruta, { referencia: 'X-1' })).status, 403);
  assert.equal((await u.asistente.llamar('POST', ruta, { referencia: 'X-1' })).status, 403);
  assert.equal((await u.socioA.llamar('POST', ruta, { referencia: '   ' })).status, 400);
  assert.equal((await u.socioA.llamar('POST', ruta, { referencia: 'a'.repeat(121) })).status, 400);
  assert.equal((await u.socioA.llamar('POST', ruta, { referencia: 123 })).status, 400);
  const ok = await u.socioA.llamar('POST', ruta, { referencia: 'Dictamen DV-2026-014' });
  assert.equal(ok.status, 200);

  const detCliente = await u.cliente1.llamar('GET', '/api/solicitudes/' + idSol + '/detalle');
  assert.equal(detCliente.json.solicitud.referencia_entrega, 'Dictamen DV-2026-014');
  assert.equal(detCliente.json.acciones.referencia, false);
  const detSocio = await u.socioA.llamar('GET', '/api/solicitudes/' + idSol + '/detalle');
  assert.equal(detSocio.json.acciones.referencia, true);

  // Solo se registra al entregar: una solicitud recien asignada la rechaza.
  const nueva = await u.cliente1.llamar('POST', '/api/solicitudes', SOLICITUD);
  assert.equal(nueva.status, 201);
  const idN = nueva.json.id_solicitud;
  assert.equal((await u.asistente.llamar('POST', '/api/solicitudes/' + idN + '/asignar',
    { id_socio: ids.socioA })).status, 200);
  assert.equal((await u.socioA.llamar('POST', '/api/solicitudes/' + idN + '/referencia',
    { referencia: 'X-1' })).status, 409);
});

test('endurecimiento: tipo de contenido, 404 en JSON y sesiones en la base', async () => {
  const texto = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' });
  assert.equal(texto.status, 415);
  const formulario = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'email=a' });
  assert.equal(formulario.status, 415);
  const roto = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{malo' });
  assert.equal(roto.status, 400);
  assert.equal((await u.cliente1.llamar('GET', '/api/no-existe')).status, 404);
  const [filas] = await pool.query('SELECT COUNT(*) AS n FROM sesion WHERE expira > UTC_TIMESTAMP()');
  assert.ok(filas[0].n >= 6);
});

test('endurecimiento: tipo de contenido, 404 en JSON y sesiones en la base', async () => {
  const texto = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' });
  assert.equal(texto.status, 415);
  const formulario = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'email=a' });
  assert.equal(formulario.status, 415);
  const roto = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{malo' });
  assert.equal(roto.status, 400);
  assert.equal((await u.cliente1.llamar('GET', '/api/no-existe')).status, 404);
  const [filas] = await pool.query('SELECT COUNT(*) AS n FROM sesion WHERE expira > UTC_TIMESTAMP()');
  assert.ok(filas[0].n >= 6);
});
