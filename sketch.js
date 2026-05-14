// ═══════════════════════════════════════════════════════════════════
//  COLECCIÓN — OBRA V  |  sketch.js
//  Arte generativo en p5.js
//
//  Mecánica: cola deslizante (máximo 12 stamps visibles).
//  Cada pulsación de tecla coloca UN solo brush PNG en el canvas.
//  Al superar el límite, el stamp más antiguo desaparece.
//
//  Controles:
//    Cualquier tecla → coloca un brush nuevo
//    R               → nueva composición (fondo + cola vacía)
// ═══════════════════════════════════════════════════════════════════


// ─── PALETAS ────────────────────────────────────────────────────────

const WARM = [
  [242, 193,  46],   // amarillo intenso
  [232, 140,  22],   // naranja
  [215,  62,  24],   // rojo-naranja
  [200,  35,  35],   // rojo
  [228,  78, 118],   // rosa
  [198,  52, 130],   // fucsia
  [255, 220,  80],   // amarillo claro
];

const COOL = [
  [ 38, 118,  44],   // verde esmeralda
  [ 18,  82,  28],   // verde oscuro
  [ 10,  98,  98],   // verde-teal
  [  0, 138, 148],   // turquesa
  [ 22,  80, 158],   // azul profundo
  [ 48, 118, 188],   // azul medio
  [ 98,  60, 158],   // violeta
  [ 78,  40, 128],   // púrpura
];

let ALL_PAL;


// ─── BRUSHES ────────────────────────────────────────────────────────
// brushes[0] = Brush1.png … brushes[5] = Brush6.png
// PNG con canal alpha: blanco = pincelada, transparente = vacío.
// tint(r, g, b, alpha) coloriza los blancos con cualquier color.

let brushes = [];


// ─── ESTADO ─────────────────────────────────────────────────────────

const MAX_QUEUE = 12;

let queue        = [];
let bgImg;
let swirlX, swirlY;
let figIdx       = 0;
let lastLabel    = '';
let removedLabel = '';


// ═══════════════════════════════════════════════════════════════════
//  CICLO p5.js
// ═══════════════════════════════════════════════════════════════════

function preload() {
  for (let i = 1; i <= 6; i++) {
    brushes.push(loadImage(`Brushes/Brush${i}.png`));
  }
}

function setup() {
  createCanvas(900, 700).parent('canvas-wrap');
  noLoop();

  ALL_PAL = [...WARM, ...COOL];

  // Normaliza el canal alpha de todos los brushes antes de usarlos.
  for (let br of brushes) {
    normalizeBrushAlpha(br);
  }

  initArtwork();
}


// Detecta si un brush tiene fondo blanco opaco, sin canal alpha real.
// En ese caso convierte la luminancia en transparencia:
//
//   píxel oscuro  → trazo opaco blanco → tint() lo coloriza correctamente
//   píxel blanco  → transparente       → sin rectángulo visible
//
// Si el brush ya tiene canal alpha activo, no se modifica.

function normalizeBrushAlpha(img) {
  img.loadPixels();

  let hasAlpha = false;

  for (let i = 3; i < img.pixels.length; i += 4) {
    if (img.pixels[i] < 128) {
      hasAlpha = true;
      break;
    }
  }

  if (!hasAlpha) {
    for (let i = 0; i < img.pixels.length; i += 4) {
      let lum =
        img.pixels[i]     * 0.299 +
        img.pixels[i + 1] * 0.587 +
        img.pixels[i + 2] * 0.114;

      img.pixels[i]     = 255;
      img.pixels[i + 1] = 255;
      img.pixels[i + 2] = 255;
      img.pixels[i + 3] = 255 - floor(lum);
    }

    img.updatePixels();
  }
}

function keyPressed() {
  if (key === 'r' || key === 'R') {
    initArtwork();
    return;
  }

  let fig = newFigure();

  removedLabel = '';
  queue.push(fig);
  lastLabel = fig.label;

  if (queue.length > MAX_QUEUE) {
    removedLabel = queue.shift().label;
  }

  redrawAll();
  renderHUD();
}


// ═══════════════════════════════════════════════════════════════════
//  INIT / REDRAW
// ═══════════════════════════════════════════════════════════════════

function initArtwork() {
  let seed = floor(random(999999));

  randomSeed(seed);
  noiseSeed(seed);

  swirlX = random(250, 650);
  swirlY = random(200, 500);

  drawBackground();

  // Importante:
  // antes de capturar el fondo, restauramos estados globales.
  imageMode(CORNER);
  noTint();

  bgImg = get();

  queue        = [];
  figIdx       = 0;
  lastLabel    = '';
  removedLabel = '';

  renderHUD();
}

function redrawAll() {
  // SOLUCIÓN DEL CUADRADO:
  // imageMode() es un estado global de p5.js.
  // Como los brushes se dibujan con imageMode(CENTER),
  // antes de volver a pintar el fondo hay que restaurar CORNER.
  imageMode(CORNER);
  noTint();

  image(bgImg, 0, 0);

  for (let fig of queue) {
    fig.draw();
  }

  // Dejamos el estado limpio para el siguiente redraw.
  imageMode(CORNER);
  noTint();
}


// ═══════════════════════════════════════════════════════════════════
//  FONDO
// ═══════════════════════════════════════════════════════════════════

function drawBackground() {
  background(238, 205, 118);
  noStroke();

  // Halo cálido centrado en el foco compositivo.
  for (let r = 560; r > 0; r -= 14) {
    fill(255, 244, 148, map(r, 0, 560, 40, 0));
    ellipse(swirlX, swirlY, r * 2.3, r * 1.65);
  }

  // Segundo halo desplazado para romper la simetría.
  let hx = swirlX + random(-210, 210);
  let hy = swirlY + random(-150, 150);

  for (let r = 340; r > 0; r -= 12) {
    fill(255, 215, 105, map(r, 0, 340, 22, 0));
    ellipse(hx, hy, r * 1.9, r * 1.35);
  }

  // Manchas frías en bordes para equilibrar.
  let ec = COOL[floor(random(COOL.length))];

  fill(ec[0], ec[1], ec[2], 26);
  ellipse(random(-60, 160), random(-60, 160), 520, 390);

  fill(ec[0], ec[1], ec[2], 18);
  ellipse(random(740, 960), random(540, 760), 440, 330);

  // Grano de lienzo.
  for (let i = 0; i < 6000; i++) {
    let x   = random(width);
    let y   = random(height);
    let len = random(10, 65);
    let ang = random(-0.42, 0.42);

    push();

    translate(x, y);
    rotate(ang);

    let c = random() < 0.48
      ? WARM[floor(random(WARM.length))]
      : [255, 250, 205];

    fill(c[0], c[1], c[2], random(4, 24));
    noStroke();
    ellipse(0, 0, len, random(1.5, 5));

    pop();
  }

  imageMode(CORNER);
  noTint();
}


// ═══════════════════════════════════════════════════════════════════
//  GENERADORES DE FIGURAS
//  Cada función pre-computa todos los parámetros usando random()
//  y devuelve { label, draw() } donde draw() es determinista.
//  Cada figura = exactamente 1 brush PNG en pantalla.
// ═══════════════════════════════════════════════════════════════════

function newFigure() {
  figIdx++;

  let r = random();

  if (r < 0.28) return makeMass();
  if (r < 0.72) return makeRibbon();
  if (r < 0.88) return makeSweep();

  return makeStem();
}


// ─── MASA ORGÁNICA — brush grande, forma de mancha ──────────────────

function makeMass() {
  let t = random();
  let col;
  let label;

  if (t < 0.33) {
    col = WARM[floor(random(2))];
    label = 'Masa cálida';
  } else if (t < 0.66) {
    col = COOL[floor(random(3))];
    label = 'Masa fría';
  } else {
    col = WARM[floor(random(3, 6))];
    label = 'Acento rojo / fucsia';
  }

  // Brush1 preferido.
  // Brush5 y Brush6 aparecen con menor frecuencia.
  let _b = random();

  let brushIdx =
    _b < 0.70 ? 0 :
    _b < 0.85 ? 4 :
                5;

  let stampW = random(160, 480);
  let alpha  = floor(random(155, 222));

  // Posición: principalmente cerca del swirl,
  // a veces hacia los bordes.
  let x = random() < 0.62
    ? swirlX + random(-270, 270)
    : random(-80, width + 80);

  let y = random() < 0.62
    ? swirlY + random(-200, 200)
    : random(-60, height + 60);

  let angle = random(TWO_PI);

  return stamp(label, brushIdx, col, x, y, angle, stampW, alpha);
}


// ─── CINTA CURVA — brush medio, orientación diagonal/horizontal ──────

function makeRibbon() {
  let col = figIdx % 2 === 0
    ? COOL[floor(random(COOL.length))]
    : WARM[floor(random(WARM.length))];

  // Brush2, Brush3 o Brush4.
  let brushIdx = 1 + floor(random(3));

  // Ancho suficiente para cruzar parte del canvas.
  let stampW = random(280, 680);
  let alpha  = floor(random(162, 228));

  // Posición distribuida por todo el canvas, incluyendo bordes.
  let x = random(-60, width  + 60);
  let y = random(-60, height + 60);

  // Ángulo principalmente direccional.
  let angle = random(PI);

  return stamp('Cinta curva', brushIdx, col, x, y, angle, stampW, alpha);
}


// ─── BARRIDO AMPLIO — brush grande, cubre zonas amplias ─────────────

function makeSweep() {
  let col = ALL_PAL[floor(random(ALL_PAL.length))];

  // Circulares solo el 20% del tiempo en barridos.
  // El resto usa brushes curvos.
  let brushIdx = random() < 0.80
    ? floor(random(4))
    : 4 + floor(random(2));

  let stampW = random(450, 920);
  let alpha  = floor(random(108, 168));

  let x = random(-120, width  + 120);
  let y = random( -90, height +  90);

  let angle = random(TWO_PI);

  return stamp('Barrido amplio', brushIdx, col, x, y, angle, stampW, alpha);
}


// ─── TALLO — brush fino, orientación vertical ────────────────────────

function makeStem() {
  let col = random() < 0.72
    ? COOL[floor(random(2))]
    : COOL[floor(random(COOL.length))];

  // Brush1 o Brush2.
  let brushIdx = floor(random(2));

  let stampW = random(20, 55);
  let alpha  = floor(random(205, 252));

  let x = random(60, width - 60);
  let y = random(height * 0.2, height * 0.8);

  // Mayormente vertical con ligera inclinación.
  let angle = random(-PI / 5, PI / 5) + (random() < 0.5 ? 0 : HALF_PI);

  return stamp('Tallo', brushIdx, col, x, y, angle, stampW, alpha);
}


// ═══════════════════════════════════════════════════════════════════
//  STAMP — constructor de figura individual
//  Devuelve un objeto { label, draw() } donde draw coloca exactamente
//  UNA imagen de brush con tint.
// ═══════════════════════════════════════════════════════════════════

function stamp(label, brushIdx, col, x, y, angle, stampW, alpha) {
  // Todos los parámetros quedan fijos en el closure.
  // draw() no llama a random().
  // Es completamente determinista.

  return {
    label,

    draw() {
      let br = brushes[brushIdx];

      if (!br || br.width === 0) {
        // Fallback si el PNG no cargó.
        push();

        noStroke();
        fill(col[0], col[1], col[2], alpha);

        translate(x, y);
        rotate(angle);
        ellipse(0, 0, stampW, stampW * 0.38);

        pop();

        imageMode(CORNER);
        noTint();

        return;
      }

      let stampH = stampW * (br.height / br.width);

      // Importante:
      // imageMode(CENTER) queda dentro de push/pop.
      // Así no contamina el estado global y no afecta al fondo.
      push();

      imageMode(CENTER);
      tint(col[0], col[1], col[2], alpha);

      translate(x, y);
      rotate(angle);

      image(br, 0, 0, stampW, stampH);

      pop();

      // Por seguridad, dejamos el modo global limpio.
      imageMode(CORNER);
      noTint();
    },
  };
}


// ═══════════════════════════════════════════════════════════════════
//  HUD
// ═══════════════════════════════════════════════════════════════════

function renderHUD() {
  let nameEl = document.getElementById('phase-name');
  let stepEl = document.getElementById('step-counter');

  if (queue.length === 0) {
    nameEl.textContent = 'Presiona una tecla para colocar el primer brush';
    stepEl.textContent = 'R · reiniciar';
  } else {
    let note = removedLabel ? `  ·  −${removedLabel}` : '';

    nameEl.textContent = `+${lastLabel}${note}`;
    stepEl.textContent = `${queue.length} / ${MAX_QUEUE}  ·  R · reiniciar`;
  }
}