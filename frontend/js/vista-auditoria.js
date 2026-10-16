'use strict';

const EVENTOS = {
  PERMISO_OTORGADO: 'Permiso otorgado',
  PERMISO_REVOCADO: 'Permiso revocado',
  COTIZACION_REGISTRADA: 'Cotización registrada',
  COTIZACION_ESTATUS: 'Cotización: cambio de estatus',
  USUARIO_CREADO: 'Usuario creado',
  USUARIO_ROL: 'Usuario: cambio de rol',
  USUARIO_ACTIVO: 'Usuario: alta o baja',
  REFERENCIA_REGISTRADA: 'Referencia de entrega registrada',
};

App.registrar({
  nombre: 'auditoria',
  titulo: 'Auditoría',
  menu: true,
  roles: ['admin'],
  async render(contenedor) {
    contenedor.appendChild(nodo('h1', 'Auditoría', 'h3 mb-1'));
    contenedor.appendChild(nodo('p',
      'Eventos de permisos, cotizaciones y usuarios. Solo lectura: nadie puede editarlos ni borrarlos.',
      'text-muted mb-3'));

    const r = await api('GET', '/auditoria?limite=200');
    if (!r.ok) {
      contenedor.appendChild(alerta('danger', 'No se pudo cargar la auditoría.'));
      return;
    }
    const datos = r.json;

    const filtro = nodo('select', undefined, 'form-select mb-3 w-auto');
    filtro.appendChild(opcion('', 'Todos los eventos'));
    Object.keys(EVENTOS).forEach((k) => filtro.appendChild(opcion(k, EVENTOS[k])));
    contenedor.appendChild(filtro);

    const tarjeta = nodo('div', undefined, 'card shadow-sm');
    const caja = nodo('div', undefined, 'table-responsive');
    const tabla = nodo('table', undefined, 'table table-sm align-middle mb-0');
    const cabecera = nodo('thead', undefined, 'table-light');
    const filaCab = nodo('tr');
    ['Fecha', 'Evento', 'Hecho por', 'Sobre', 'Solicitud', 'Detalle']
      .forEach((t) => filaCab.appendChild(nodo('th', t)));
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
      const visibles = datos.filter((e) => !filtro.value || e.tipo_evento === filtro.value);
      if (visibles.length === 0) {
        const vacia = nodo('tr');
        const celda = nodo('td', 'No hay eventos.', 'text-center text-muted py-4');
        celda.colSpan = 6;
        vacia.appendChild(celda);
        cuerpo.appendChild(vacia);
      }
      visibles.forEach((e) => {
        const fila = nodo('tr');
        fila.appendChild(nodo('td', fechaLocal(e.fecha_hora_utc), 'small text-nowrap'));
        fila.appendChild(nodo('td', EVENTOS[e.tipo_evento] || e.tipo_evento, 'fw-semibold'));
        fila.appendChild(nodo('td', e.actor));
        fila.appendChild(nodo('td', e.objetivo || '—'));
        fila.appendChild(nodo('td', e.id_solicitud ? '#' + e.id_solicitud : '—'));
        fila.appendChild(nodo('td', e.detalle || '', 'small text-muted'));
        cuerpo.appendChild(fila);
      });
      contador.textContent = visibles.length + ' de ' + datos.length + ' evento(s)';
    }
    filtro.addEventListener('change', pintar);
    pintar();
  },
});

