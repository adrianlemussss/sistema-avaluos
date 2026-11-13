"use strict";

const ROLES = {
  cliente: "Cliente",
  socio: "Socio",
  asistente: "Asistente administrativa",
  admin: "Administrador técnico",
};

// Alias visuales de las cuentas demo. No cambian identidades, datos ni permisos.
function nombreVisible(nombre) {
  const alias = {
    "Socio A (ficticio)": "Ingeniero Orlando",
    "Asistente (ficticia)": "Administradora Daniela",
    "Admin tecnico (ficticio)": "Administrador Xiuhtémoc",
  };
  return Object.prototype.hasOwnProperty.call(alias, nombre)
    ? alias[nombre]
    : nombre;
}
function cerrarMenu() {
  document.querySelector(".principal").inert = false;
  document.getElementById("lateral").classList.remove("abierto");
  document.getElementById("abrir-menu").setAttribute("aria-expanded", "false");
  document.getElementById("velo-menu").hidden = true;
}
const App = { vistas: {}, yo: null, catalogos: null, inicio: "inicio" };

async function api(metodo, ruta, cuerpo) {
  const r = await fetch("/api" + ruta, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  let json = null;
  try {
    json = await r.json();
  } catch (e) {
    json = null;
  }
  return { ok: r.ok, status: r.status, json: json };
}

// Siempre textContent: nunca se inserta texto del servidor como HTML.
function nodo(etiqueta, texto, clase) {
  const e = document.createElement(etiqueta);
  if (texto !== undefined) e.textContent = texto;
  if (clase) e.className = clase;
  return e;
}

let siguienteCampo = 0;
function etiquetaControl(texto, control) {
  if (!control.id) control.id = "campo-" + ++siguienteCampo;
  const label = nodo("label", texto, "form-label small mb-1");
  label.htmlFor = control.id;
  return label;
}

function vaciar(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function clave(estado) {
  return estado.toLowerCase().replace(/ /g, "-");
}

function insignia(estado) {
  return nodo("span", estado, "badge insignia-" + clave(estado));
}

function alerta(tipo, texto) {
  const a = nodo("div", texto, "alert alert-" + tipo);
  a.setAttribute("role", "alert");
  if (tipo === "success") setTimeout(() => a.remove(), 4000);
  return a;
}

// El servidor guarda y entrega UTC; aqui se muestra en la hora local del navegador.
function fechaLocal(utc) {
  return new Date(utc.replace(" ", "T") + "Z").toLocaleString("es-MX");
}

App.registrar = function (def) {
  App.vistas[def.nombre] = def;
};
App.ir = function (hash) {
  window.location.hash = hash;
};

function construirMenu() {
  const menu = document.getElementById("menu");
  vaciar(menu);
  Object.values(App.vistas)
    .filter((v) => v.menu && v.roles.includes(App.yo.rol))
    .forEach((v) => {
      const a = nodo("a", undefined, "nav-link");
      a.appendChild(icono(ICONO_VISTA[v.nombre] || "documento"));
      a.appendChild(nodo("span", v.titulo));
      a.href = "#/" + v.nombre;
      a.dataset.vista = v.nombre;
      menu.appendChild(a);
    });
}

function marcarActivo(nombre) {
  document.querySelectorAll("#menu a").forEach((a) => {
    a.classList.toggle("active", a.dataset.vista === nombre);
    if (a.dataset.vista === nombre) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

async function enrutar() {
  const partes = window.location.hash.replace(/^#\/?/, "").split("/");
  const nombre = partes[0] || App.inicio;
  const vista = App.vistas[nombre];
  const contenido = document.getElementById("contenido");
  vaciar(contenido);
  if (!vista || !vista.roles.includes(App.yo.rol)) {
    contenido.appendChild(
      alerta("warning", "Esta sección no está disponible para tu rol."),
    );
    return;
  }
  marcarActivo(vista.menu ? nombre : vista.padre);
  cerrarMenu();
  document.getElementById("vista-actual").textContent =
    vista.titulo || "Detalle de solicitud";
  document.title = (vista.titulo || "Solicitud") + " · Empresa Valuadora";
  try {
    await vista.render(contenido, partes.slice(1));
    if (window.matchMedia("(max-width: 767px)").matches)
      contenido.focus({ preventScroll: true });
  } catch (e) {
    vaciar(contenido);
    contenido.appendChild(
      alerta("danger", "Ocurrió un error al mostrar esta sección."),
    );
  }
}

async function arrancar() {
  const yo = await api("GET", "/auth/me");
  if (!yo.ok) {
    window.location.href = "/login.html";
    return;
  }
  App.yo = yo.json;
  const cat = await api("GET", "/catalogos");
  App.catalogos = cat.ok ? cat.json : { tipos: [], estados: [], origenes: [] };
  const nombre = nombreVisible(App.yo.nombre);
  document.getElementById("usuario").textContent = nombre;
  document.getElementById("avatar-usuario").textContent = nombre
    .split(" ")
    .slice(-2)
    .map((p) => p[0])
    .join("");
  document.getElementById("fecha-espacio").textContent =
    new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date());
  document.getElementById("rol-etiqueta").textContent = ROLES[App.yo.rol];
  document.getElementById("salir").addEventListener("click", async () => {
    await api("POST", "/auth/logout");
    window.location.href = "/login.html";
  });
  document.getElementById("abrir-menu").addEventListener("click", () => {
    const abierto = document
      .getElementById("lateral")
      .classList.toggle("abierto");
    document
      .getElementById("abrir-menu")
      .setAttribute("aria-expanded", String(abierto));
    document.getElementById("velo-menu").hidden = !abierto;
    document.querySelector(".principal").inert = abierto;
    if (abierto) document.querySelector("#menu a")?.focus();
  });
  document.getElementById("velo-menu").addEventListener("click", cerrarMenu);
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      document.getElementById("lateral").classList.contains("abierto")
    ) {
      cerrarMenu();
      document.getElementById("abrir-menu").focus();
    }
  });
  window
    .matchMedia("(max-width: 767.98px)")
    .addEventListener("change", cerrarMenu);
  construirMenu();
  window.addEventListener("hashchange", enrutar);
  enrutar();
}

if (document.body.dataset.pagina === "panel") {
  document.addEventListener("DOMContentLoaded", arrancar);
}
