'use strict';

function barra(porcentaje) {
  const caja = nodo('div', undefined, 'progress');
  const b = nodo('div', undefined, 'progress-bar');
  b.style.width = porcentaje + '%';
  caja.appendChild(b);
  return caja;
}

function bloqueConteos(titulo, filas, total) {
  const bloque = tarjetaConTitulo(titulo);
  if (filas.length === 0) {
    bloque.cuerpo.appendChild(nodo('p', 'Sin datos en este periodo.', 'text-muted mb-0'));
    return bloque.tarjeta;
  }
  filas.forEach((f) => {
    const fila = nodo('div', undefined, 'mb-2');
    const linea = nodo('div', undefined, 'd-flex justify-content-between small');
    linea.appendChild(nodo('span', f.etiqueta));
    linea.appendChild(nodo('span', String(f.total), 'fw-semibold'));
    fila.appendChild(linea);
    fila.appendChild(barra(total ? Math.round((f.total * 100) / total) : 0));
    bloque.cuerpo.appendChild(fila);
  });
  return bloque.tarjeta;
}

function indicador(etiqueta, valor) {
  const col = nodo('div', undefined, 'col-6 col-lg-3');
  const tarjeta = nodo('div', undefined, 'card shadow-sm h-100');
  const cuerpo = nodo('div', undefined, 'card-body');
  cuerpo.appendChild(nodo('div', String(valor), 'display-6'));
  cuerpo.appendChild(nodo('div', etiqueta, 'text-muted'));
  tarjeta.appendChild(cuerpo);
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
  const indicadores = nodo('div', undefined, 'row g-3 mb-3');
  indicadores.appendChild(indicador('Solicitudes', d.total));
  indicadores.appendChild(indicador('Abiertas', d.abiertas));
  indicadores.appendChild(indicador('Cerradas', d.total - d.abiertas));
  zona.appendChild(indicadores);

  const rejilla = nodo('div', undefined, 'row g-3');
  [
    ['Por estado', d.por_estado],
    ['Por tipo de avalúo', d.por_tipo],
    ['Por responsable', d.por_responsable],
    ['Por mes de registro', d.por_mes],
  ].forEach((par) => {
    const col = nodo('div', undefined, 'col-lg-6');
    col.appendChild(bloqueConteos(par[0], par[1], d.total));
    rejilla.appendChild(col);
  });
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
