'use strict';

function bloqueReferencia(contenedor, id, s) {
  const bloque = tarjetaConTitulo('Referencia de entrega');
  bloque.cuerpo.appendChild(nodo('p',
    s.referencia_entrega ? 'Registrada: ' + s.referencia_entrega : 'Aún no hay una referencia registrada.',
    'mb-2'));

  const form = nodo('form', undefined, 'input-group');
  const entrada = nodo('input', undefined, 'form-control');
  entrada.maxLength = 120;
  entrada.required = true;
  entrada.value = s.referencia_entrega || '';
  entrada.placeholder = 'Ej. Dictamen DV-2026-014';
  const boton = nodo('button', s.referencia_entrega ? 'Actualizar' : 'Registrar', 'btn btn-outline-primary');
  boton.type = 'submit';
  form.appendChild(entrada);
  form.appendChild(boton);
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const texto = entrada.value.trim();
    if (!texto) {
      entrada.classList.add('is-invalid');
      return;
    }
    ejecutar(contenedor, id, 'POST', '/solicitudes/' + id + '/referencia',
      { referencia: texto }, 'Referencia registrada.');
  });
  bloque.cuerpo.appendChild(form);
  bloque.cuerpo.appendChild(nodo('p',
    'Solo texto: número de dictamen, oficio o folio interno. No se adjuntan archivos.',
    'small text-muted mt-2 mb-0'));
  return bloque.tarjeta;
}
