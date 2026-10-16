'use strict';

const ROLES = {
  cliente: 'Cliente',
  socio: 'Socio',
  asistente: 'Asistente administrativa',
  admin: 'Administrador técnico',
};

const App = { vistas: {}, yo: null, catalogos: null, inicio: 'inicio' };

async function api(metodo, ruta, cuerpo) {
  const r = await fetch('/api' + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  let json = null;
  try { json = await r.json(); } catch (e) { json = null; }
  return { ok: r.ok, status: r.status, json: json };
}

// Siempre textContent: nunca se inserta texto del servidor como HTML.
function nodo(etiqueta, texto, clase) {
  const e = document.createElement(etiqueta);
  if (texto !== undefined) e.textContent = texto;
  if (clase) e.className = clase;
  return e;
}

function vaciar(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function clave(estado) {
  return estado.toLowerCase().replace(/ /g, '-');
}

function insignia(estado) {
  return nodo('span', estado, 'badge insignia-' + clave(estado));
}

function alerta(tipo, texto) {
  const a = nodo('div', texto, 'alert alert-' + tipo);
  a.setAttribute('role', 'alert');
  if (tipo === 'success') setTimeout(() => a.remove(), 4000);
  return a;
}

// El servidor guarda y entrega UTC; aqui se muestra en la hora local del navegador.
function fechaLocal(utc) {
  return new Date(utc.replace(' ', 'T') + 'Z').toLocaleString('es-MX');
}

App.registrar = function (def) { App.vistas[def.nombre] = def; };
App.ir = function (hash) { window.location.hash = hash; };

function construirMenu() {
  const menu = document.getElementById('menu');
  vaciar(menu);
  Object.values(App.vistas)
    .filter((v) => v.menu && v.roles.includes(App.yo.rol))
    .forEach((v) => {
      const a = nodo('a', undefined, 'nav-link');
      a.appendChild(icono(ICONO_VISTA[v.nombre] || 'documento'));
      a.appendChild(nodo('span', v.titulo));
      a.href = '#/' + v.nombre;
      a.dataset.vista = v.nombre;
      menu.appendChild(a);
    });
}

function marcarActivo(nombre) {
  document.querySelectorAll('#menu a').forEach((a) => {
    a.classList.toggle('active', a.dataset.vista === nombre);
  });
}

async function enrutar() {
  const partes = window.location.hash.replace(/^#\/?/, '').split('/');
  const nombre = partes[0] || App.inicio;
  const vista = App.vistas[nombre];
  const contenido = document.getElementById('contenido');
  vaciar(contenido);
  if (!vista || !vista.roles.includes(App.yo.rol)) {
    contenido.appendChild(alerta('warning', 'Esta sección no está disponible para tu rol.'));
    return;
  }
  marcarActivo(vista.menu ? nombre : vista.padre);
  document.getElementById('lateral').classList.remove('abierto');
  try {
    await vista.render(contenido, partes.slice(1));
  } catch (e) {
    vaciar(contenido);
    contenido.appendChild(alerta('danger', 'Ocurrió un error al mostrar esta sección.'));
  }
}

async function arrancar() {
  const yo = await api('GET', '/auth/me');
  if (!yo.ok) {
    window.location.href = '/login.html';
    return;
  }
  App.yo = yo.json;
  const cat = await api('GET', '/catalogos');
  App.catalogos = cat.ok ? cat.json : { tipos: [], estados: [], origenes: [] };
  document.getElementById('usuario').textContent = App.yo.nombre;
  document.getElementById('rol-etiqueta').textContent = ROLES[App.yo.rol];
  document.getElementById('salir').addEventListener('click', async () => {
    await api('POST', '/auth/logout');
    window.location.href = '/login.html';
  });
  document.getElementById('abrir-menu').addEventListener('click', () => {
    document.getElementById('lateral').classList.toggle('abierto');
  });
  construirMenu();
  window.addEventListener('hashchange', enrutar);
  enrutar();
}

if (document.body.dataset.pagina === 'panel') {
  document.addEventListener('DOMContentLoaded', arrancar);
}

