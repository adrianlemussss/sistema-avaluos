'use strict';

function listaPendientes(titulo, items, vacio) {
  const bloque = tarjetaConTitulo(titulo);
  if (items.length === 0) {
    bloque.cuerpo.appendChild(nodo('p', vacio, 'text-muted mb-0'));
    return bloque.tarjeta;
  }
  const lista = nodo('div', undefined, 'list-group list-group-flush');
  items.slice(0, 5).forEach((s) => {
    const enlace = nodo('a', undefined,
      'list-group-item list-group-item-action d-flex justify-content-between align-items-center px-0');
    enlace.href = '#/solicitud/' + s.id_solicitud;
    const texto = nodo('span');
    texto.appendChild(nodo('span', s.folio, 'fw-semibold me-2'));
    texto.appendChild(nodo('span', s.tipo + ' Â· ' + s.proposito, 'text-muted small'));
    enlace.appendChild(texto);
    enlace.appendChild(insignia(s.estado));
    lista.appendChild(enlace);
  });
  bloque.cuerpo.appendChild(lista);
  if (items.length > 5) {
    const mas = nodo('a', 'Ver las ' + items.length + ' solicitudes', 'btn btn-link px-0 mt-2');
    mas.href = '#/solicitudes';
    bloque.cuerpo.appendChild(mas);
  }
  return bloque.tarjeta;
}

App.registrar({
  nombre: 'inicio',
  titulo: 'Inicio',
  menu: true,
  roles: ['cliente', 'socio', 'asistente', 'admin'],
  async render(contenedor) {
    const rol = App.yo.rol;
    const cab = nodo('div', undefined, 'd-flex flex-wrap justify-content-between align-items-center gap-2 mb-1');
    cab.appendChild(nodo('h1', 'Hola, ' + App.yo.nombre, 'h3 mb-0'));
    if (App.vistas.nueva && (rol === 'cliente' || rol === 'asistente')) {
      const nueva = nodo('a', 'Nueva solicitud', 'btn btn-primary');
      nueva.href = '#/nueva';
      cab.appendChild(nueva);
    }
    contenedor.appendChild(cab);
    contenedor.appendChild(nodo('p', DESCRIPCION_ROL[rol], 'text-muted mb-4'));
    if (rol === 'admin') { await resumenAdmin(contenedor); return; }

    const r = await api('GET', '/solicitudes');
    if (!r.ok) {
      contenedor.appendChild(alerta('danger', 'No se pudieron cargar los datos.'));
      return;
    }
    const datos = r.json;

    const fila = nodo('div', undefined, 'row g-3 mb-4');
    for (const est of App.catalogos.estados) {
      const total = datos.filter((s) => s.estado === est.nombre).length;
      const col = nodo('div', undefined, 'col-6 col-lg');
      const tarjeta = nodo('div', undefined, 'card shadow-sm h-100 borde-' + clave(est.nombre));
      const cuerpo = nodo('div', undefined, 'card-body');
      cuerpo.appendChild(nodo('div', String(total), 'display-6'));
      cuerpo.appendChild(nodo('div', est.nombre, 'text-muted'));
      tarjeta.appendChild(cuerpo);
      col.appendChild(tarjeta);
      fila.appendChild(col);
    }
    contenedor.appendChild(fila);

    if (rol === 'cliente') {
      contenedor.appendChild(listaPendientes('Mis solicitudes mÃ¡s recientes', datos,
        'AÃºn no has registrado solicitudes.'));
    } else if (rol === 'socio') {
      contenedor.appendChild(listaPendientes('Por atender',
        datos.filter((s) => s.estado === 'Asignada' || s.estado === 'En proceso'),
        'No tienes solicitudes pendientes.'));
    } else {
      contenedor.appendChild(listaPendientes('Sin asignar',
        datos.filter((s) => s.estado === 'Recibida'),
        'No hay solicitudes por asignar.'));
    }
  },
});

