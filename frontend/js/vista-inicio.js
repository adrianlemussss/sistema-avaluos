"use strict";
function listaPendientes(titulo, items, vacio) {
  const bloque = tarjetaConTitulo(titulo);
  if (!items.length) {
    bloque.cuerpo.appendChild(nodo("p", vacio, "text-muted mb-0 py-4"));
    return bloque.tarjeta;
  }
  const lista = nodo("div", undefined, "list-group list-group-flush");
  items.slice(0, 5).forEach((s) => {
    const enlace = nodo(
      "a",
      undefined,
      "list-group-item list-group-item-action d-flex justify-content-between align-items-center px-0",
    );
    enlace.href = "#/solicitud/" + s.id_solicitud;
    const texto = nodo("span");
    texto.appendChild(nodo("span", s.folio, "fw-semibold me-2"));
    texto.appendChild(
      nodo("span", s.tipo + " · " + s.proposito, "text-muted small"),
    );
    enlace.append(texto, insignia(s.estado));
    lista.appendChild(enlace);
  });
  bloque.cuerpo.appendChild(lista);
  const mas = nodo("a", "Consultar solicitudes →", "btn btn-link px-0 mt-2");
  mas.href = "#/solicitudes";
  bloque.cuerpo.appendChild(mas);
  return bloque.tarjeta;
}
App.registrar({
  nombre: "inicio",
  titulo: "Inicio",
  menu: true,
  roles: ["cliente", "socio", "asistente", "admin"],
  async render(contenedor) {
    const rol = App.yo.rol;
    const cab = nodo("div", undefined, "resumen-cab");
    const texto = nodo("div");
    texto.appendChild(
      nodo("p", "Perspectiva de trabajo / " + ROLES[rol], "sobrelinea"),
    );
    texto.appendChild(
      nodo("h1", "Hola, " + nombreVisible(App.yo.nombre), "h3"),
    );
    texto.appendChild(nodo("p", DESCRIPCION_ROL[rol]));
    cab.appendChild(texto);
    if (App.vistas.nueva && ["cliente", "asistente"].includes(rol)) {
      const nueva = nodo("a", "Nueva solicitud ↗", "btn btn-primary");
      nueva.href = "#/nueva";
      cab.appendChild(nueva);
    }
    contenedor.appendChild(cab);
    if (rol === "admin") {
      await resumenAdmin(contenedor);
      return;
    }
    const r = await api("GET", "/solicitudes");
    if (!r.ok) {
      contenedor.appendChild(
        alerta("danger", "No se pudieron cargar los datos."),
      );
      return;
    }
    const datos = r.json;
    const fila = nodo("div", undefined, "resumen-estados");
    fila.setAttribute("aria-label", "Resumen de solicitudes por estado");
    App.catalogos.estados.forEach((est, i) => {
      const metrica = nodo("div", undefined, "estado-metrica");
      metrica.appendChild(
        nodo(
          "span",
          String(i + 1).padStart(2, "0") + " / ESTADO",
          "metrica-numero",
        ),
      );
      metrica.appendChild(
        nodo(
          "span",
          String(datos.filter((s) => s.estado === est.nombre).length),
          "metrica-valor",
        ),
      );
      metrica.appendChild(nodo("span", est.nombre, "metrica-etiqueta"));
      fila.appendChild(metrica);
    });
    contenedor.appendChild(fila);
    const zona = nodo("div", undefined, "resumen-operativo");
    if (rol === "cliente")
      zona.appendChild(
        listaPendientes(
          "Mis solicitudes más recientes",
          datos,
          "Aún no has registrado solicitudes.",
        ),
      );
    else if (rol === "socio")
      zona.appendChild(
        listaPendientes(
          "Solicitudes por atender",
          datos.filter((s) => ["Asignada", "En proceso"].includes(s.estado)),
          "No tienes solicitudes pendientes.",
        ),
      );
    else
      zona.appendChild(
        listaPendientes(
          "Solicitudes sin asignar",
          datos.filter((s) => s.estado === "Recibida"),
          "No hay solicitudes por asignar.",
        ),
      );
    const nota = nodo("aside", undefined, "nota-operativa");
    nota.appendChild(nodo("p", "Seguimiento", "sobrelinea"));
    nota.appendChild(nodo("h2", "Cada etapa cuenta."));
    nota.appendChild(
      nodo(
        "p",
        "Consulta el detalle de cada solicitud para conocer su estado y las acciones disponibles para tu cuenta.",
      ),
    );
    const enlace = nodo("a", "Ver solicitudes →");
    enlace.href = "#/solicitudes";
    nota.appendChild(enlace);
    zona.appendChild(nota);
    contenedor.appendChild(zona);
  },
});
