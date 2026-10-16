// P-04: transiciones preliminares. Confirmar con la empresa (reabrir, reasignar, pausar).
const ESTADOS = { 'Recibida': 1, 'Asignada': 2, 'En proceso': 3, 'Entregada': 4, 'Cancelada': 5 };

const TRANSICIONES = {
  'Recibida': ['Asignada', 'Cancelada'],
  'Asignada': ['En proceso', 'Cancelada'],
  'En proceso': ['Entregada', 'Cancelada'],
  'Entregada': [],
  'Cancelada': [],
};

function transicionValida(desde, hacia) {
  return (TRANSICIONES[desde] || []).includes(hacia);
}

module.exports = { ESTADOS, TRANSICIONES, transicionValida };
