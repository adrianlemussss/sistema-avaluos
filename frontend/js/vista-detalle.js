'use strict';

const COLOR_BOTON = {
  'En proceso': 'btn-primary',
  'Entregada': 'btn-success',
  'Cancelada': 'btn-outline-danger',
};

function dato(lista, etiqueta, valor) {
  lista.appendChild(nodo('dt', etiqueta, 'col-sm-4'));
  lista.appendChild(nodo('dd', valor, 'col-sm-8'));
}

function tarjetaConTitulo(titulo) {
  const tarjeta = nodo('div', undefined, 'card shadow-sm mb-3');
  const cuerpo = nodo('div', undefined, 'card-body');
  cuerpo.appendChild(nodo('h2', titulo, 'h6 text-uppercase text-muted mb-3'));
  tarjeta.appendChild(cuerpo);
  return { tarjeta, cuerpo };
}

function grupoSelectBoton(select, boton) {
  const g = nodo('div', undefined, 'input-group');
  g.appendChild(select);
  g.appendChild(boton);
  return g;
}

async function ejecutar(contenedor, id, metodo, ruta, cuerpo, exito) {
  const r = await api(metodo, ruta, cuerpo);
  if (r.ok) {
    await pintarDetalle(contenedor, id, { tipo: 'success', texto: exito });
    return;
  }
  let texto = 'No se pudo completar la acción.';
  if (r.status === 409) texto = 'Ese cambio no está permitido en el estado actual.';
  else if (r.status === 403) texto = 'No tienes permiso para esa acción.';
  else if (r.status === 404) texto = 'La solicitud ya no está disponible.';
  else if (r.status === 400) texto = 'Revisa los datos enviados.';
  await pintarDetalle(contenedor, id, { tipo: 'danger', texto: texto });
}

async function pintarDetalle(contenedor, id, flash) {
  vaciar(contenedor);
  const volver = nodo('a', '← Volver a solicitudes', 'btn btn-link px-0 mb-2');
  volver.href = '#/solicitudes';
  contenedor.appendChild(volver);
  if (flash) contenedor.appendChild(alerta(flash.tipo, flash.texto));

  const r = await api('GET', '/solicitudes/' + id + '/detalle');
  if (!r.ok) {
    contenedor.appendChild(alerta('warning', 'La solicitud no existe o no tienes acceso a ella.'));
    return;
  }
  const s = r.json.solicitud;
  const historial = r.json.historial;
  const acciones = r.json.acciones;
  const compartida = r.json.compartida_con;

  const cab = nodo('div', undefined, 'd-flex flex-wrap align-items-center gap-3 mb-3');
  cab.appendChild(nodo('h1', s.folio, 'h3 mb-0'));
  cab.appendChild(insignia(s.estado));
  contenedor.appendChild(cab);

  const fila = nodo('div', undefined, 'row g-3');
  const izq = nodo('div', undefined, 'col-lg-7');
  const der = nodo('div', undefined, 'col-lg-5');

  const datos = tarjetaConTitulo('Datos de la solicitud');
  const dl = nodo('dl', undefined, 'row mb-0');
  dato(dl, 'Cliente', s.cliente);
  dato(dl, 'Tipo de avalúo', s.tipo);
  dato(dl, 'Origen', ORIGENES_ETIQUETA[s.origen] || s.origen);
  dato(dl, 'Propósito', s.proposito);
  dato(dl, 'Inmueble', s.descripcion_bien);
  dato(dl, 'Responsable', s.socio || 'Sin asignar');
  dato(dl, 'Creada', fechaLocal(s.creada_en));
  datos.cuerpo.appendChild(dl);
  izq.appendChild(datos.tarjeta);

  if (acciones.asignar) {
    const bloque = tarjetaConTitulo('Asignar a un socio');
    const rs = await api('GET', '/socios');
    const sel = nodo('select', undefined, 'form-select');
    sel.appendChild(opcion('', 'Selecciona un socio'));
    (rs.ok ? rs.json : []).forEach((so) => sel.appendChild(opcion(so.id_socio, so.nombre)));
    const btn = nodo('button', 'Asignar', 'btn btn-warning');
    btn.type = 'button';
    btn.addEventListener('click', () => {
      if (!sel.value) return;
      ejecutar(contenedor, id, 'POST', '/solicitudes/' + id + '/asignar',
        { id_socio: Number(sel.value) }, 'Solicitud asignada.');
    });
    bloque.cuerpo.appendChild(grupoSelectBoton(sel, btn));
    izq.appendChild(bloque.tarjeta);
  }

  if (acciones.estados.length > 0) {
    const bloque = tarjetaConTitulo('Cambiar estado');
    const botones = nodo('div', undefined, 'd-flex flex-wrap gap-2');
    const cajaMotivo = nodo('div', undefined, 'mt-3 d-none');
    const motivo = nodo('textarea', undefined, 'form-control mb-2');
    motivo.rows = 2;
    motivo.maxLength = 255;
    motivo.placeholder = 'Motivo de la cancelación (obligatorio)';
    const confirmar = nodo('button', 'Confirmar cancelación', 'btn btn-danger');
    confirmar.type = 'button';
    confirmar.addEventListener('click', () => {
      const texto = motivo.value.trim();
      if (!texto) {
        motivo.classList.add('is-invalid');
        return;
      }
      ejecutar(contenedor, id, 'POST', '/solicitudes/' + id + '/estado',
        { estado: 'Cancelada', motivo: texto }, 'Solicitud cancelada.');
    });
    cajaMotivo.appendChild(motivo);
    cajaMotivo.appendChild(confirmar);

    acciones.estados.forEach((est) => {
      const b = nodo('button',
        est === 'Cancelada' ? 'Cancelar solicitud' : 'Pasar a ' + est,
        'btn ' + (COLOR_BOTON[est] || 'btn-secondary'));
      b.type = 'button';
      b.addEventListener('click', () => {
        if (est === 'Cancelada') {
          cajaMotivo.classList.remove('d-none');
          motivo.focus();
          return;
        }
        if (window.confirm('¿Cambiar el estado a "' + est + '"?')) {
          ejecutar(contenedor, id, 'POST', '/solicitudes/' + id + '/estado',
            { estado: est }, 'Estado actualizado a ' + est + '.');
        }
      });
      botones.appendChild(b);
    });
    bloque.cuerpo.appendChild(botones);
    bloque.cuerpo.appendChild(cajaMotivo);
    izq.appendChild(bloque.tarjeta);
  }

  if (acciones.compartir) {
    const bloque = tarjetaConTitulo('Compartir con otro socio (solo consulta)');
    const rs = await api('GET', '/socios');
    const yaCompartidos = compartida.map((c) => c.id_socio);
    const disponibles = (rs.ok ? rs.json : []).filter((so) => !yaCompartidos.includes(so.id_socio));
    const sel = nodo('select', undefined, 'form-select');
    sel.appendChild(opcion('', disponibles.length ? 'Selecciona un socio' : 'No hay más socios'));
    disponibles.forEach((so) => sel.appendChild(opcion(so.id_socio, so.nombre)));
    sel.disabled = disponibles.length === 0;
    const btn = nodo('button', 'Compartir', 'btn btn-outline-primary');
    btn.type = 'button';
    btn.disabled = disponibles.length === 0;
    btn.addEventListener('click', () => {
      if (!sel.value) return;
      ejecutar(contenedor, id, 'POST', '/solicitudes/' + id + '/compartir',
        { id_socio: Number(sel.value) }, 'Solicitud compartida.');
    });
    bloque.cuerpo.appendChild(grupoSelectBoton(sel, btn));

    if (compartida.length > 0) {
      bloque.cuerpo.appendChild(nodo('p', 'Compartida con:', 'small text-muted mt-3 mb-1'));
      const lista = nodo('ul', undefined, 'list-group');
      compartida.forEach((c) => {
        const li = nodo('li', undefined, 'list-group-item d-flex justify-content-between align-items-center');
        li.appendChild(nodo('span', c.nombre));
        const quitar = nodo('button', 'Quitar acceso', 'btn btn-sm btn-outline-danger');
        quitar.type = 'button';
        quitar.addEventListener('click', () => {
          if (window.confirm('¿Quitar el acceso a ' + c.nombre + '?')) {
            ejecutar(contenedor, id, 'DELETE', '/solicitudes/' + id + '/compartir/' + c.id_socio,
              undefined, 'Acceso revocado.');
          }
        });
        li.appendChild(quitar);
        lista.appendChild(li);
      });
      bloque.cuerpo.appendChild(lista);
    }
    izq.appendChild(bloque.tarjeta);
  }
   if (acciones.cotizar && typeof bloqueCotizacion === 'function') {
    izq.appendChild(await bloqueCotizacion(contenedor, id));
  }


  const hist = tarjetaConTitulo('Historial');
  const lista = nodo('ul', undefined, 'list-group list-group-flush');
  historial.forEach((e) => {
    const li = nodo('li', undefined, 'list-group-item px-0');
    const linea = nodo('div', undefined, 'd-flex align-items-center gap-2');
    linea.appendChild(insignia(e.estado_nuevo));
    if (e.tipo_evento === 'creacion') linea.appendChild(nodo('span', 'Solicitud registrada', 'small'));
    li.appendChild(linea);
    const detalle = fechaLocal(e.fecha_hora_utc) + (e.actor ? ' · ' + e.actor : '');
    li.appendChild(nodo('div', detalle, 'small text-muted'));
    if (e.motivo) li.appendChild(nodo('div', 'Motivo: ' + e.motivo, 'small fst-italic'));
    lista.appendChild(li);
  });
  hist.cuerpo.appendChild(lista);
  der.appendChild(hist.tarjeta);

  fila.appendChild(izq);
  fila.appendChild(der);
  contenedor.appendChild(fila);
}

App.registrar({
  nombre: 'solicitud',
  titulo: 'Detalle de solicitud',
  menu: false,
  padre: 'solicitudes',
  roles: ['cliente', 'socio', 'asistente'],
  async render(contenedor, params) {
    const flash = App.flash;
    App.flash = null;
    await pintarDetalle(contenedor, Number(params[0]), flash);
  },
});
