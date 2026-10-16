'use strict';

// Tarjeta de resumen con degradado. Tambien la usa el Inicio del administrador.
function indicador(etiqueta, valor, tono, columna) {
  const col = nodo('div', undefined, columna || 'col-6 col-lg-3');
  const tarjeta = nodo('div', undefined, 'kpi kpi-' + (tono || 'azul'));
  tarjeta.appendChild(nodo('div', String(valor), 'kpi-num'));
  tarjeta.appendChild(nodo('div', etiqueta, 'kpi-et'));
  col.appendChild(tarjeta);
  return col;
}

async function pintarReporte(zona, filtros) {
  vaciar(zona);
  const partes = [];
  if (filtros.desde) partes.push('desde=' + encodeURIComponent(filtros.desde));
  if (filtros.hasta) partes.push('hasta=' + encodeURIComponent(filtros.hasta));
  if (filtros.socio) partes.push('socio=' + encodeURIComponent(filtros.socio));
  const r = await api('GET', '/reportes/resumen' + (partes.length ? '?' + partes.join('&') : ''));
  if (r.status === 400) {
    zona.appendChild(alerta('warning', 'Revisa los filtros: las fechas deben ser válidas.'));
    return;
  }
  if (!r.ok) {
    zona.appendChild(alerta('danger', 'No se pudo generar el reporte.'));
    return;
  }
  const d = r.json;

  const kpis = nodo('div', undefined, 'row g-3 mb-3');
  kpis.appendChild(indicador('Solicitudes', d.total, 'azul', 'col-12 col-md-4'));
  kpis.appendChild(indicador('Abiertas', d.abiertas, 'ambar', 'col-6 col-md-4'));
  kpis.appendChild(indicador('Cerradas', d.total - d.abiertas, 'verde', 'col-6 col-md-4'));
  zona.appendChild(kpis);

  const rejilla = nodo('div', undefined, 'row g-3');
  function panel(titulo, contenido) {
    const col = nodo('div', undefined, 'col-lg-6');
    const bloque = tarjetaConTitulo(titulo);
    bloque.cuerpo.appendChild(contenido);
    col.appendChild(bloque.tarjeta);
    rejilla.appendChild(col);
  }
  panel('Por estado', dona(d.por_estado, d.total, 'solicitudes'));
  panel('Por mes de registro', columnas(d.por_mes));
  panel('Por tipo de avalúo', barrasH(d.por_tipo, d.total));
  panel('Por responsable', dona(d.por_responsable, d.total, 'solicitudes'));
  zona.appendChild(rejilla);
}

App.registrar({
  nombre: 'reportes',
  titulo: 'Reportes',
  menu: true,
  roles: ['socio', 'asistente'],
  async render(contenedor) {
    contenedor.appendChild(nodo('h1', 'Reportes', 'h3 mb-3'));

    const tarjeta = nodo('div', undefined, 'card shadow-sm mb-3');
    const cuerpo = nodo('div', undefined, 'card-body');
    const fila = nodo('div', undefined, 'row g-2 align-items-end');

    function columna(etiqueta, control) {
      const col = nodo('div', undefined, 'col-md-3');
      col.appendChild(nodo('label', etiqueta, 'form-label small mb-1'));
      col.appendChild(control);
      fila.appendChild(col);
    }

    const desde = nodo('input', undefined, 'form-control');
    desde.type = 'date';
    const hasta = nodo('input', undefined, 'form-control');
    hasta.type = 'date';
    columna('Desde', desde);
    columna('Hasta', hasta);

    let selSocio = null;
    if (App.yo.rol === 'asistente') {
      selSocio = nodo('select', undefined, 'form-select');
      selSocio.appendChild(opcion('', 'Todos los socios'));
      const rs = await api('GET', '/socios');
      (rs.ok ? rs.json : []).forEach((s) => selSocio.appendChild(opcion(s.id_socio, s.nombre)));
      columna('Responsable', selSocio);
    }

    const colBoton = nodo('div', undefined, 'col-md-3');
    const aplicar = nodo('button', 'Aplicar filtros', 'btn btn-primary w-100');
    aplicar.type = 'button';
    colBoton.appendChild(aplicar);
    fila.appendChild(colBoton);
    cuerpo.appendChild(fila);
    tarjeta.appendChild(cuerpo);
    contenedor.appendChild(tarjeta);

    const zona = nodo('div');
    contenedor.appendChild(zona);

    function filtros() {
      return {
        desde: desde.value,
        hasta: hasta.value,
        socio: selSocio ? selSocio.value : '',
      };
    }
    aplicar.addEventListener('click', () => pintarReporte(zona, filtros()));
    await pintarReporte(zona, filtros());
  },
});
