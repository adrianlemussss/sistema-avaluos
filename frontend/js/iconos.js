'use strict';

// Iconos de linea fina. Los trazos son constantes de este archivo, no vienen del servidor.
const RUTAS_ICONO = {
  inicio: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  documento: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
  mas: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  grafica: '<path d="M4 20V10M10 20V4M16 20v-8M2 20h20"/>',
  usuarios: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.2.6 3.5 2.6 3.5 6"/>',
  escudo: '<path d="M12 3l8 3v6c0 4.5-3.2 8.2-8 9-4.8-.8-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
};

const ICONO_VISTA = {
  inicio: 'inicio',
  solicitudes: 'documento',
  nueva: 'mas',
  reportes: 'grafica',
  usuarios: 'usuarios',
  auditoria: 'escudo',
};

function icono(nombre) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'icono');
  svg.innerHTML = RUTAS_ICONO[nombre] || '';
  return svg;
}
