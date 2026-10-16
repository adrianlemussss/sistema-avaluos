'use strict';

const form = document.getElementById('form-login');
const mensaje = document.getElementById('mensaje');
const boton = document.getElementById('entrar');
const verClave = document.getElementById('ver-clave');

function mostrarError(texto) {
  mensaje.textContent = texto;
  mensaje.classList.remove('d-none');
}

document.querySelectorAll('[data-correo]').forEach((tarjeta) => {
  tarjeta.addEventListener('click', () => {
    form.elements.email.value = tarjeta.dataset.correo;
    form.elements.password.focus();
  });
});

verClave.addEventListener('click', () => {
  const campo = form.elements.password;
  const oculta = campo.type === 'password';
  campo.type = oculta ? 'text' : 'password';
  verClave.textContent = oculta ? 'Ocultar' : 'Ver';
});

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  mensaje.classList.add('d-none');
  boton.disabled = true;
  boton.textContent = 'Entrando…';
  try {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        email: form.elements.email.value,
        password: form.elements.password.value,
      }),
    });
    if (r.ok) {
      window.location.href = '/panel.html';
      return;
    }
    if (r.status === 429) mostrarError('Demasiados intentos. Espera unos minutos.');
    else if (r.status === 401) mostrarError('Correo o contraseña incorrectos.');
    else mostrarError('No se pudo iniciar sesión. Intenta de nuevo.');
  } catch (e) {
    mostrarError('No hay conexión con el servidor.');
  }
  boton.disabled = false;
  boton.textContent = 'Entrar';
});
