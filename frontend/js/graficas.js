'use strict';

const NS_SVG = 'http://www.w3.org/2000/svg';
const COLOR_ESTADO = {
  'Recibida': '#3b82f6',
  'Asignada': '#f59e0b',
  'En proceso': '#8b5cf6',
  'Entregada': '#10b981',
  'Cancelada': '#ef4444',
};
const PALETA = ['#2563eb', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];

function elementoSvg(etiqueta, atributos) {
  const e = document.createElementNS(NS_SVG, etiqueta);
  Object.keys(atributos || {}).forEach((k) => e.setAttribute(k, atributos[k]));
  return e;
}

function porcentaje(valor, total) {
  return total ? Math.round((valor * 100) / total) : 0;
}

function colorDe(etiqueta, indice) {
  if (COLOR_ESTADO[etiqueta]) return COLOR_ESTADO[etiqueta];
  if (etiqueta === 'Sin asignar') return '#94a3b8';
  return PALETA[indice % PALETA.length];
}

function vacioGrafica() {
  return nodo('p', 'Sin datos en este periodo.', 'text-muted mb-0 py-4 text-center');
}

function sugerencia(elemento, texto) {
  const t = elementoSvg('title');
  t.textContent = texto;
  elemento.appendChild(t);
}

// Dona con total al centro y leyenda. filas: [{ etiqueta, total }]
function dona(filas, total, textoCentro) {
  if (!total) return vacioGrafica();
  const caja = nodo('div', undefined, 'd-flex flex-wrap align-items-center justify-content-center gap-4');
  const radio = 15.91549430918954;
  const lienzo = elementoSvg('svg', { viewBox: '0 0 42 42', class: 'dona', role: 'img' });
  lienzo.appendChild(elementoSvg('circle', {
    cx: 21, cy: 21, r: radio, fill: 'none', stroke: '#e9eef7', 'stroke-width': 5,
  }));

  let acumulado = 0;
  filas.forEach((f, i) => {
    const parte = (f.total * 100) / total;
    const hueco = filas.length > 1 ? 0.8 : 0;
    const visible = Math.max(parte - hueco, 0.1);
    const segmento = elementoSvg('circle', {
      cx: 21, cy: 21, r: radio, fill: 'none', stroke: colorDe(f.etiqueta, i), 'stroke-width': 5,
      'stroke-dasharray': visible + ' ' + (100 - visible),
      'stroke-dashoffset': -(acumulado + hueco / 2),
      transform: 'rotate(-90 21 21)',
      class: 'dona-seg',
    });
    sugerencia(segmento, f.etiqueta + ': ' + f.total + ' (' + porcentaje(f.total, total) + '%)');
    lienzo.appendChild(segmento);
    acumulado += parte;
  });

  const numero = elementoSvg('text', {
    x: 21, y: 22.6, 'text-anchor': 'middle', 'font-size': 8, 'font-weight': 700, fill: '#0f2744',
  });
  numero.textContent = String(total);
  const rotulo = elementoSvg('text', {
    x: 21, y: 27.5, 'text-anchor': 'middle', 'font-size': 2.8, fill: '#64748b',
  });
  rotulo.textContent = textoCentro || '';
  lienzo.appendChild(numero);
  lienzo.appendChild(rotulo);
  caja.appendChild(lienzo);

  const leyenda = nodo('ul', undefined, 'list-unstyled mb-0 flex-grow-1');
  filas.forEach((f, i) => {
    const li = nodo('li', undefined, 'd-flex align-items-center gap-2 mb-2 small');
    const punto = nodo('span', undefined, 'punto');
    punto.style.background = colorDe(f.etiqueta, i);
    li.appendChild(punto);
    li.appendChild(nodo('span', f.etiqueta, 'flex-grow-1'));
    li.appendChild(nodo('span', String(f.total), 'fw-semibold'));
    li.appendChild(nodo('span', porcentaje(f.total, total) + '%', 'text-muted ms-1'));
    leyenda.appendChild(li);
  });
  caja.appendChild(leyenda);
  return caja;
}

// Barras horizontales con un color por fila.
function barrasH(filas, total) {
  if (!total) return vacioGrafica();
  const maximo = Math.max(...filas.map((f) => f.total));
  const lista = nodo('div');
  filas.forEach((f, i) => {
    const color = colorDe(f.etiqueta, i);
    const fila = nodo('div', undefined, 'mb-3');
    const linea = nodo('div', undefined, 'd-flex justify-content-between small mb-1');
    linea.appendChild(nodo('span', f.etiqueta, 'fw-semibold'));
    linea.appendChild(nodo('span', f.total + ' · ' + porcentaje(f.total, total) + '%', 'text-muted'));
    const pista = nodo('div', undefined, 'pista');
    const relleno = nodo('div', undefined, 'relleno');
    relleno.style.width = Math.max((f.total * 100) / maximo, 4) + '%';
    relleno.style.background = 'linear-gradient(90deg, ' + color + 'bb, ' + color + ')';
    pista.appendChild(relleno);
    fila.appendChild(linea);
    fila.appendChild(pista);
    lista.appendChild(fila);
  });
  return lista;
}

function mesCorto(aaaamm) {
  const partes = aaaamm.split('-');
  return new Date(Number(partes[0]), Number(partes[1]) - 1, 1)
    .toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
}

// Columnas verticales con degradado, valores y lineas guia (ultimos 12 meses).
function columnas(filas) {
  const datos = filas.slice(-12);
  if (datos.length === 0) return vacioGrafica();
  const ancho = Math.max(datos.length * 56, 280);
  const alto = 190;
  const base = 160;
  const tope = 26;
  const maximo = Math.max(...datos.map((d) => d.total));

  const lienzo = elementoSvg('svg', { viewBox: '0 0 ' + ancho + ' ' + alto, class: 'columnas', role: 'img' });
  const defs = elementoSvg('defs');
  const degradado = elementoSvg('linearGradient', { id: 'grad-columna', x1: 0, y1: 0, x2: 0, y2: 1 });
  degradado.appendChild(elementoSvg('stop', { offset: '0%', 'stop-color': '#3b82f6' }));
  degradado.appendChild(elementoSvg('stop', { offset: '100%', 'stop-color': '#1e3a8a' }));
  defs.appendChild(degradado);
  lienzo.appendChild(defs);

  [0, 0.25, 0.5, 0.75, 1].forEach((p) => {
    const y = base - (base - tope) * p;
    lienzo.appendChild(elementoSvg('line', { x1: 0, x2: ancho, y1: y, y2: y, stroke: '#e6ecf5', 'stroke-width': 1 }));
  });

  const paso = ancho / datos.length;
  const grosor = Math.min(paso * 0.55, 34);
  datos.forEach((d, i) => {
    const h = (d.total / maximo) * (base - tope);
    const x = i * paso + (paso - grosor) / 2;
    const columna = elementoSvg('rect', {
      x: x, y: base - h, width: grosor, height: h, rx: 6, fill: 'url(#grad-columna)', class: 'columna',
    });
    sugerencia(columna, mesCorto(d.etiqueta) + ': ' + d.total + ' solicitud(es)');
    lienzo.appendChild(columna);

    const valor = elementoSvg('text', { x: x + grosor / 2, y: base - h - 7, 'text-anchor': 'middle', class: 'valor' });
    valor.textContent = String(d.total);
    lienzo.appendChild(valor);

    const mes = elementoSvg('text', { x: x + grosor / 2, y: base + 19, 'text-anchor': 'middle' });
    mes.textContent = mesCorto(d.etiqueta);
    lienzo.appendChild(mes);
  });
  return lienzo;
}
