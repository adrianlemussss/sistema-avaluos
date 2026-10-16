'use strict';

const DESCRIPCION_ROL = {
  cliente: 'Aquí puedes registrar solicitudes de avalúo y consultar su avance.',
  socio: 'Aquí ves las solicitudes de tu cartera y las que otro socio te comparta.',
  asistente: 'Aquí registras solicitudes, las asignas a un socio y das seguimiento.',
  admin: 'Tu rol administra los usuarios del sistema. Esa sección llegará en un paso siguiente.',
};

function opcion(valor, texto) {
  const o = nodo('option', texto);
  o.value = valor;
  return o;
}

App.registrar({
  nombre: 'inicio',
  titulo: 'Inicio',
  menu: true,
  roles: ['cliente', 'socio', 'asistente', 'admin'],
  async render(contenedor) {
    contenedor.appendChild(nodo('h1', 'Hola, ' + App.yo.nombre, 'h3 mb-1'));
    contenedor.appendChild(nodo('p', DESCRIPCION_ROL[App.yo.rol], 'text-muted mb-4'));
    if (App.yo.rol === 'admin') return;
    const r = await api('GET', '/solicitudes');
    if (!r.ok) {
      contenedor.appendChild(alerta('danger', 'No se pudieron cargar los datos.'));
      return;
    }
    const fila = nodo('div', undefined, 'row g-3');
    for (const est of App.catalogos.estados) {
      const total = r.json.filter((s) => s.estado === est.nombre).length;
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
  },
});

App.registrar({
  nombre: 'solicitudes',
  titulo: 'Solicitudes',
  menu: true,
  roles: ['cliente', 'socio', 'asistente'],
  async render(contenedor) {
    const encabezado = nodo('div', undefined, 'd-flex justify-content-between align-items-center mb-3');
    encabezado.appendChild(nodo('h1', 'Solicitudes', 'h3 mb-0'));
    if (App.vistas.nueva) {
      const nueva = nodo('a', 'Nueva solicitud', 'btn btn-primary');
      nueva.href = '#/nueva';
      encabezado.appendChild(nueva);
    }
    contenedor.appendChild(encabezado);

    const r = await api('GET', '/solicitudes');
    if (!r.ok) {
      contenedor.appendChild(alerta('danger', 'No se pudieron cargar las solicitudes.'));
      return;
    }
    const datos = r.json;

    const filtros = nodo('div', undefined, 'row g-2 mb-3');
    const buscar = nodo('input', undefined, 'form-control');
    buscar.placeholder = 'Buscar por folio o propósito';
    const selEstado = nodo('select', undefined, 'form-select');
    selEstado.appendChild(opcion('', 'Todos los estados'));
    App.catalogos.estados.forEach((e) => selEstado.appendChild(opcion(e.nombre, e.nombre)));
    const selTipo = nodo('select', undefined, 'form-select');
    selTipo.appendChild(opcion('', 'Todos los tipos'));
    App.catalogos.tipos.forEach((t) => selTipo.appendChild(opcion(t.nombre, t.nombre)));
    [buscar, selEstado, selTipo].forEach((control, i) => {
      const col = nodo('div', undefined, i === 0 ? 'col-md-6' : 'col-md-3');
      col.appendChild(control);
      filtros.appendChild(col);
    });
    contenedor.appendChild(filtros);

    const tarjeta = nodo('div', undefined, 'card shadow-sm');
    const caja = nodo('div', undefined, 'table-responsive');
    const tabla = nodo('table', undefined, 'table table-hover align-middle mb-0');
    const cabecera = nodo('thead', undefined, 'table-light');
    const filaCab = nodo('tr');
    ['Folio', 'Tipo', 'Estado', 'Propósito', 'Creada'].forEach((t) => filaCab.appendChild(nodo('th', t)));
    cabecera.appendChild(filaCab);
    tabla.appendChild(cabecera);
    const cuerpo = nodo('tbody');
    tabla.appendChild(cuerpo);
    caja.appendChild(tabla);
    tarjeta.appendChild(caja);
    contenedor.appendChild(tarjeta);
    const contador = nodo('p', undefined, 'text-muted small mt-2');
    contenedor.appendChild(contador);

    function pintar() {
      vaciar(cuerpo);
      const q = buscar.value.trim().toLowerCase();
      const visibles = datos.filter((s) =>
        (!selEstado.value || s.estado === selEstado.value) &&
        (!selTipo.value || s.tipo === selTipo.value) &&
        (!q || s.folio.toLowerCase().includes(q) || s.proposito.toLowerCase().includes(q)));
      if (visibles.length === 0) {
        const vacia = nodo('tr');
        const celda = nodo('td', 'No hay solicitudes que coincidan.', 'text-center text-muted py-4');
        celda.colSpan = 5;
        vacia.appendChild(celda);
        cuerpo.appendChild(vacia);
      }
      for (const s of visibles) {
        const fila = nodo('tr');
        fila.appendChild(nodo('td', s.folio, 'fw-semibold'));
        fila.appendChild(nodo('td', s.tipo));
        const celdaEstado = nodo('td');
        celdaEstado.appendChild(insignia(s.estado));
        fila.appendChild(celdaEstado);
        fila.appendChild(nodo('td', s.proposito));
        fila.appendChild(nodo('td', fechaLocal(s.creada_en), 'text-nowrap'));
        if (App.vistas.solicitud) {
          fila.classList.add('fila-click');
          fila.addEventListener('click', () => App.ir('#/solicitud/' + s.id_solicitud));
        }
        cuerpo.appendChild(fila);
      }
      contador.textContent = visibles.length + ' de ' + datos.length + ' solicitud(es)';
    }

    buscar.addEventListener('input', pintar);
    selEstado.addEventListener('change', pintar);
    selTipo.addEventListener('change', pintar);
    pintar();
  },
});
