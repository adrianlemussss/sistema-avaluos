'use strict';

const ESTATUS_ETIQUETA = { propuesta: 'Propuesta', acordada: 'Acordada', cancelada: 'Cancelada' };
const ESTATUS_COLOR = {
  propuesta: 'text-bg-secondary',
  acordada: 'text-bg-success',
  cancelada: 'text-bg-danger',
};

function pesos(valor) {
  return Number(valor).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function botonEstatus(contenedor, id, c, estatus, texto, clase) {
  const b = nodo('button', texto, 'btn btn-sm ms-1 ' + clase);
  b.type = 'button';
  b.addEventListener('click', () => {
    if (window.confirm('¿' + texto + ' esta cotización?')) {
      ejecutar(contenedor, id, 'POST',
        '/solicitudes/' + id + '/cotizaciones/' + c.id_cotizacion + '/estatus',
        { estatus: estatus }, 'Cotización actualizada.');
    }
  });
  return b;
}

async function bloqueCotizacion(contenedor, id) {
  const bloque = tarjetaConTitulo('Cotización (precio acordado)');
  const r = await api('GET', '/solicitudes/' + id + '/cotizaciones');
  const lista = r.ok ? r.json : [];

  if (lista.length === 0) {
    bloque.cuerpo.appendChild(nodo('p', 'Aún no hay cotizaciones registradas.', 'text-muted small'));
  } else {
    const caja = nodo('div', undefined, 'table-responsive');
    const tabla = nodo('table', undefined, 'table table-sm align-middle');
    const cabecera = nodo('thead');
    const filaCab = nodo('tr');
    ['Importe', 'Estatus', 'Registrada', ''].forEach((t) => filaCab.appendChild(nodo('th', t)));
    cabecera.appendChild(filaCab);
    tabla.appendChild(cabecera);
    const cuerpo = nodo('tbody');
    lista.forEach((c) => {
      const fila = nodo('tr');
      fila.appendChild(nodo('td', pesos(c.importe), 'fw-semibold'));
      const celdaEstatus = nodo('td');
      celdaEstatus.appendChild(nodo('span', ESTATUS_ETIQUETA[c.estatus], 'badge ' + ESTATUS_COLOR[c.estatus]));
      fila.appendChild(celdaEstatus);
      fila.appendChild(nodo('td', fechaLocal(c.creada_en), 'small text-nowrap'));
      const celdaAcciones = nodo('td', undefined, 'text-end text-nowrap');
      if (c.estatus === 'propuesta') {
        celdaAcciones.appendChild(botonEstatus(contenedor, id, c, 'acordada', 'Acordar', 'btn-success'));
      }
      if (c.estatus !== 'cancelada') {
        celdaAcciones.appendChild(botonEstatus(contenedor, id, c, 'cancelada', 'Cancelar', 'btn-outline-danger'));
      }
      fila.appendChild(celdaAcciones);
      cuerpo.appendChild(fila);
    });
    tabla.appendChild(cuerpo);
    caja.appendChild(tabla);
    bloque.cuerpo.appendChild(caja);
  }

  const form = nodo('form', undefined, 'input-group mt-2');
  const entrada = nodo('input', undefined, 'form-control');
  entrada.type = 'number';
  entrada.step = '0.01';
  entrada.min = '0.01';
  entrada.max = '99999999.99';
  entrada.required = true;
  entrada.placeholder = 'Importe en pesos (MXN)';
  const enviar = nodo('button', 'Registrar cotización', 'btn btn-outline-primary');
  enviar.type = 'submit';
  form.appendChild(entrada);
  form.appendChild(enviar);
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const valor = Number(entrada.value);
    if (!(valor > 0)) {
      entrada.classList.add('is-invalid');
      return;
    }
    ejecutar(contenedor, id, 'POST', '/solicitudes/' + id + '/cotizaciones',
      { importe: valor }, 'Cotización registrada.');
  });
  bloque.cuerpo.appendChild(form);
  bloque.cuerpo.appendChild(nodo('p',
    'Solo la ve el socio responsable. El importe se captura a mano; el sistema no calcula valores.',
    'small text-muted mt-2 mb-0'));
  return bloque.tarjeta;
}
