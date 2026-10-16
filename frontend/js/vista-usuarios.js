'use strict';

// Resumen del Inicio del administrador.
async function resumenAdmin(contenedor) {
  const r = await api('GET', '/usuarios');
  if (!r.ok) {
    contenedor.appendChild(alerta('danger', 'No se pudieron cargar los usuarios.'));
    return;
  }
  const lista = r.json;
  const fila = nodo('div', undefined, 'row g-3 mb-4');
  fila.appendChild(indicador('Usuarios', lista.length));
  fila.appendChild(indicador('Activos', lista.filter((x) => x.activo).length));
  fila.appendChild(indicador('Socios', lista.filter((x) => x.rol === 'socio').length));
  fila.appendChild(indicador('Clientes', lista.filter((x) => x.rol === 'cliente').length));
  contenedor.appendChild(fila);

  const accesos = nodo('div', undefined, 'd-flex flex-wrap gap-2');
  const aUsuarios = nodo('a', 'Administrar usuarios', 'btn btn-primary');
  aUsuarios.href = '#/usuarios';
  const aAuditoria = nodo('a', 'Ver auditoría', 'btn btn-outline-secondary');
  aAuditoria.href = '#/auditoria';
  accesos.appendChild(aUsuarios);
  accesos.appendChild(aAuditoria);
  contenedor.appendChild(accesos);
}

async function accionUsuario(contenedor, metodo, ruta, cuerpo, exito) {
  const r = await api(metodo, ruta, cuerpo);
  if (r.ok) {
    await pintarUsuarios(contenedor, { tipo: 'success', texto: exito });
    return;
  }
  let texto = 'No se pudo completar la acción.';
  if (r.status === 409 && r.json && r.json.error) texto = r.json.error;
  else if (r.status === 400) texto = 'Revisa los datos: el correo debe ser válido y la contraseña tener al menos 12 caracteres.';
  else if (r.status === 403) texto = 'No tienes permiso para esa acción.';
  await pintarUsuarios(contenedor, { tipo: 'danger', texto: texto });
}

function formularioNuevoUsuario(contenedor) {
  const bloque = tarjetaConTitulo('Nuevo usuario');
  const form = nodo('form', undefined, 'row g-2 align-items-end');

  function columna(clase, etiqueta, control) {
    const col = nodo('div', undefined, clase);
    col.appendChild(nodo('label', etiqueta, 'form-label small mb-1'));
    col.appendChild(control);
    form.appendChild(col);
  }

  const nombre = nodo('input', undefined, 'form-control');
  nombre.required = true;
  nombre.maxLength = 120;
  const correo = nodo('input', undefined, 'form-control');
  correo.type = 'email';
  correo.required = true;
  correo.maxLength = 190;
  correo.autocomplete = 'off';
  const rol = nodo('select', undefined, 'form-select');
  Object.keys(ROLES).forEach((k) => rol.appendChild(opcion(k, ROLES[k])));
  const clave = nodo('input', undefined, 'form-control');
  clave.type = 'password';
  clave.required = true;
  clave.minLength = 12;
  clave.maxLength = 72;
  clave.autocomplete = 'new-password';

  columna('col-md-3', 'Nombre', nombre);
  columna('col-md-3', 'Correo', correo);
  columna('col-md-2', 'Rol', rol);
  columna('col-md-3', 'Contraseña inicial (mín. 12)', clave);
  const colBoton = nodo('div', undefined, 'col-md-1');
  const crear = nodo('button', 'Crear', 'btn btn-primary w-100');
  crear.type = 'submit';
  colBoton.appendChild(crear);
  form.appendChild(colBoton);

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    accionUsuario(contenedor, 'POST', '/usuarios', {
      nombre: nombre.value.trim(),
      email: correo.value.trim(),
      rol: rol.value,
      password: clave.value,
    }, 'Usuario creado.');
  });
  bloque.cuerpo.appendChild(form);
  return bloque.tarjeta;
}

async function pintarUsuarios(contenedor, flash) {
  vaciar(contenedor);
  contenedor.appendChild(nodo('h1', 'Usuarios', 'h3 mb-1'));
  contenedor.appendChild(nodo('p',
    'Alta, baja lógica y cambio de rol de las cuentas del sistema.', 'text-muted mb-3'));
  if (flash) contenedor.appendChild(alerta(flash.tipo, flash.texto));

  const r = await api('GET', '/usuarios');
  if (!r.ok) {
    contenedor.appendChild(alerta('danger', 'No se pudieron cargar los usuarios.'));
    return;
  }
  contenedor.appendChild(formularioNuevoUsuario(contenedor));

  const tarjeta = nodo('div', undefined, 'card shadow-sm');
  const caja = nodo('div', undefined, 'table-responsive');
  const tabla = nodo('table', undefined, 'table align-middle mb-0');
  const cabecera = nodo('thead', undefined, 'table-light');
  const filaCab = nodo('tr');
  ['Nombre', 'Correo', 'Rol', 'Estado', ''].forEach((t) => filaCab.appendChild(nodo('th', t)));
  cabecera.appendChild(filaCab);
  tabla.appendChild(cabecera);
  const cuerpo = nodo('tbody');

  r.json.forEach((usr) => {
    const esYo = usr.id_usuario === App.yo.id;
    const fila = nodo('tr');
    const celdaNombre = nodo('td', usr.nombre, 'fw-semibold');
    if (esYo) celdaNombre.appendChild(nodo('span', ' (tú)', 'text-muted small fw-normal'));
    fila.appendChild(celdaNombre);
    fila.appendChild(nodo('td', usr.email, 'small'));

    const celdaRol = nodo('td');
    const selRol = nodo('select', undefined, 'form-select form-select-sm d-inline-block w-auto me-1');
    Object.keys(ROLES).forEach((k) => selRol.appendChild(opcion(k, ROLES[k])));
    selRol.value = usr.rol;
    selRol.disabled = esYo;
    const cambiar = nodo('button', 'Cambiar', 'btn btn-sm btn-outline-primary');
    cambiar.type = 'button';
    cambiar.disabled = esYo;
    cambiar.addEventListener('click', () => {
      if (selRol.value === usr.rol) return;
      if (window.confirm('¿Cambiar a ' + usr.nombre + ' al rol "' + ROLES[selRol.value] + '"?')) {
        accionUsuario(contenedor, 'POST', '/usuarios/' + usr.id_usuario + '/rol',
          { rol: selRol.value }, 'Rol actualizado.');
      }
    });
    celdaRol.appendChild(selRol);
    celdaRol.appendChild(cambiar);
    fila.appendChild(celdaRol);

    const celdaEstado = nodo('td');
    celdaEstado.appendChild(nodo('span', usr.activo ? 'Activo' : 'Inactivo',
      'badge ' + (usr.activo ? 'text-bg-success' : 'text-bg-secondary')));
    fila.appendChild(celdaEstado);

    const celdaAccion = nodo('td', undefined, 'text-end');
    const alternar = nodo('button', usr.activo ? 'Desactivar' : 'Activar',
      'btn btn-sm ' + (usr.activo ? 'btn-outline-danger' : 'btn-outline-success'));
    alternar.type = 'button';
    alternar.disabled = esYo;
    alternar.addEventListener('click', () => {
      const texto = usr.activo ? 'desactivar' : 'activar';
      if (window.confirm('¿Seguro que quieres ' + texto + ' a ' + usr.nombre + '?')) {
        accionUsuario(contenedor, 'POST', '/usuarios/' + usr.id_usuario + '/activo',
          { activo: !usr.activo }, usr.activo ? 'Usuario desactivado.' : 'Usuario activado.');
      }
    });
    celdaAccion.appendChild(alternar);
    fila.appendChild(celdaAccion);
    cuerpo.appendChild(fila);
  });
  tabla.appendChild(cuerpo);
  caja.appendChild(tabla);
  tarjeta.appendChild(caja);
  contenedor.appendChild(tarjeta);
}

App.registrar({
  nombre: 'usuarios',
  titulo: 'Usuarios',
  menu: true,
  roles: ['admin'],
  async render(contenedor) {
    await pintarUsuarios(contenedor, null);
  },
});
