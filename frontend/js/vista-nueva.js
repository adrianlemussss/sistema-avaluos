'use strict';

const ORIGENES_ETIQUETA = {
  whatsapp: 'WhatsApp',
  llamada: 'Llamada',
  recomendacion: 'Recomendación',
  empresa: 'Empresa',
  web: 'Sitio web',
};

let contadorCampos = 0;

function campo(etiqueta, control) {
  const grupo = nodo('div', undefined, 'mb-3');
  contadorCampos += 1;
  control.id = 'campo-' + contadorCampos;
  const rotulo = nodo('label', etiqueta, 'form-label');
  rotulo.htmlFor = control.id;
  grupo.appendChild(rotulo);
  grupo.appendChild(control);
  return grupo;
}

App.registrar({
  nombre: 'nueva',
  titulo: 'Nueva solicitud',
  menu: true,
  roles: ['cliente', 'asistente'],
  async render(contenedor) {
    const esAsistente = App.yo.rol === 'asistente';
    contenedor.appendChild(nodo('h1', 'Nueva solicitud', 'h3 mb-3'));
    const aviso = nodo('div');
    contenedor.appendChild(aviso);

    let clientes = [];
    if (esAsistente) {
      const rc = await api('GET', '/clientes');
      if (!rc.ok) {
        aviso.appendChild(alerta('danger', 'No se pudieron cargar los clientes.'));
        return;
      }
      clientes = rc.json;
    }

    const tarjeta = nodo('div', undefined, 'card shadow-sm');
    const cuerpo = nodo('div', undefined, 'card-body');
    const form = nodo('form');

    let selCliente = null;
    let selOrigen = null;
    if (esAsistente) {
      selCliente = nodo('select', undefined, 'form-select');
      selCliente.required = true;
      selCliente.appendChild(opcion('', 'Selecciona un cliente'));
      clientes.forEach((c) => selCliente.appendChild(opcion(c.id_cliente, c.nombre + ' (' + c.email + ')')));
      form.appendChild(campo('Cliente', selCliente));
    }

    const selTipo = nodo('select', undefined, 'form-select');
    selTipo.required = true;
    selTipo.appendChild(opcion('', 'Selecciona el tipo de avalúo'));
    App.catalogos.tipos.forEach((t) => selTipo.appendChild(opcion(t.id_tipo, t.nombre)));
    form.appendChild(campo('Tipo de avalúo', selTipo));

    if (esAsistente) {
      selOrigen = nodo('select', undefined, 'form-select');
      selOrigen.required = true;
      selOrigen.appendChild(opcion('', 'Selecciona cómo llegó la solicitud'));
      App.catalogos.origenes.forEach((o) => selOrigen.appendChild(opcion(o, ORIGENES_ETIQUETA[o] || o)));
      form.appendChild(campo('Origen del contacto', selOrigen));
    }

    const proposito = nodo('input', undefined, 'form-control');
    proposito.required = true;
    proposito.maxLength = 255;
    proposito.placeholder = 'Ej. Traslado de dominio';
    form.appendChild(campo('Propósito del avalúo', proposito));

    const bien = nodo('textarea', undefined, 'form-control');
    bien.required = true;
    bien.maxLength = 255;
    bien.rows = 3;
    bien.placeholder = 'Ej. Departamento de 80 m2 en la colonia Roma, CDMX';
    form.appendChild(campo('Descripción del inmueble', bien));

    const boton = nodo('button', 'Registrar solicitud', 'btn btn-primary');
    boton.type = 'submit';
    form.appendChild(boton);

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      vaciar(aviso);
      boton.disabled = true;
      const datos = {
        id_tipo: Number(selTipo.value),
        proposito: proposito.value.trim(),
        descripcion_bien: bien.value.trim(),
      };
      if (esAsistente) {
        datos.id_cliente = Number(selCliente.value);
        datos.origen = selOrigen.value;
      }
      const r = await api('POST', '/solicitudes', datos);
      if (r.status === 201) {
        App.flash = { tipo: 'success', texto: 'Solicitud ' + r.json.folio + ' registrada.' };
        App.ir('#/solicitud/' + r.json.id_solicitud);
        return;
      }
      boton.disabled = false;
      aviso.appendChild(alerta('danger',
        r.status === 400 ? 'Revisa los datos: todos los campos son obligatorios.' : 'No se pudo registrar la solicitud.'));
    });

    cuerpo.appendChild(form);
    tarjeta.appendChild(cuerpo);
    contenedor.appendChild(tarjeta);
  },
});
