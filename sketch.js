// ═══════════════════════════════════════════════════════════════════
//  COLECCIÓN — OBRA V  |  sketch.js
//  Arte generativo en p5.js
//
//  Versión modificada:
//    • Punto de fuga como campo de tensión, no solo zona prohibida.
//    • Vacío central irregular mediante noise().
//    • Composición con direcciones dominantes.
//    • Orientación espiralada/tangencial de los brushes.
//    • Orden de capas por función visual: barrido > masa > cinta > tallo.
//    • Semilla visible y exportación PNG con tecla S.
//
//  Mecánica:
//    Cada inicio de sonido (onset) coloca UN solo brush PNG en el canvas.
//    Sonidos graves tienden a brushes cálidos; sonidos agudos, a fríos.
//    Al superar el límite, el stamp más antiguo se funde al sedimento.
//    Un chasquido de lengua reinicia la composición.
//
//  Controles:
//    Clic inicial    → activa el micrófono (requisito del navegador)
//    Sonido grave    → coloca un brush cálido
//    Sonido agudo    → coloca un brush frío
//    Sonido sostenido→ pinta brushes en cadencia
//    Chasquido       → nueva composición
//    R               → nueva composición
//    S               → guardar PNG
//    V               → mostrar/ocultar punto de fuga
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


// ─── BRUSHES ────────────────────────────────────────────────────────
// Mantiene la estructura original:
//
//   Brushes/Calidos/Brush03.png
//   Brushes/Frios/Brush01.png
//
// Los PNG conservan su color original. El sketch solo usa tint()
// para el borde blanco y, en algunos casos, una leve transparencia.

let warmBrushes = [];
let coolBrushes = [];

const WARM_BRUSH_FILES = [
  'Brush03.png',
  'Brush05.png',
  'Brush06.png',
  'Brush07.png',
  'Brush08.png',
  'Brush09.png',
  'Brush10.png',
  'Brush16.png',
  'Brush18.png',
  'Brush19.png',
  'Brush20.png',
  'Brush21.png',
  'Brush23.png',
  'Brush28.png',
  'Brush30.png',
  'Brush31.png',
  'Brush33.png',
  'Brush34.png',
];

const COOL_BRUSH_FILES = [
  'Brush01.png',
  'Brush02.png',
  'Brush04.png',
  'Brush11.png',
  'Brush12.png',
  'Brush13.png',
  'Brush14.png',
  'Brush15.png',
  'Brush17.png',
  'Brush22.png',
  'Brush24.png',
  'Brush25.png',
  'Brush26.png',
  'Brush27.png',
  'Brush29.png',
  'Brush32.png',
  'Brush35.png',
];


// ─── ESTADO GENERAL ─────────────────────────────────────────────────

const MAX_QUEUE = 90;
const VANISHING_CLEAR_RADIUS = 50;  // radio base del vacío; se deforma con noise()
const OUTLINE_PAD = 3 / 4;
const OUTLINE_ALPHA = 155;
const MAX_BRUSH_REPEATS = 2;

// Cuánto del stamp original sobrevive cuando es expulsado de la cola
// y se funde al sedimento. Más alto: la acumulación crece rápido y satura.
// Más bajo: la obra mantiene aire pero la sedimentación se hace sutil.
const SEDIMENT_ALPHA_MUL = 0.5;

// ─── INTERACCIÓN SONORA ─────────────────────────────────────────────

// Umbral mínimo de amplitud para considerar que hay sonido.
// Filtra ruido de fondo del ambiente / micrófono.
const AUDIO_THRESHOLD = 0.038;

// Factor de suavizado de la señal: 0 = sin amortiguar, 1 = totalmente pegado al valor anterior.
// Valores altos evitan que un transitorio breve se cuele como onset.
const AUDIO_SMOOTHING = 0.6;

// Intervalo entre brushes durante un sonido sostenido (ms).
// Más bajo: trazo rápido y denso. Más alto: cadencia pausada.
const SUSTAINED_INTERVAL_MS = 140;

// Lectura de tono / brillo para decidir familia cromática.
const FFT_SMOOTHING = 0.36;
const FFT_BINS = 2048;
const PITCH_CONFIDENCE_MIN = 0.36;
const LOW_PITCH_MAX = 190;    // Hz: voces/sonidos graves tienden a cálidos.
const HIGH_PITCH_MIN = 235;   // Hz: voces/sonidos agudos tienden a fríos.

// Chasquido de lengua: transitorio corto, brillante y sin tono estable.
// Se confirma con una ventana breve para evitar falsos resets por silencio o voz.
const CLICK_COOLDOWN_MS = 2000;
const CLICK_CONFIRM_MS = 130;
const CLICK_RAW_THRESHOLD = 0.018;
const CLICK_RMS_MIN = 0.012;
const CLICK_RISE_THRESHOLD = 0.006;
const CLICK_PEAK_THRESHOLD = 0.065;
const CLICK_PEAK_TO_RMS_MIN = 2.7;
const CLICK_HIGH_ENERGY_MIN = 30;
const CLICK_HIGH_RISE_MIN = 7;
const CLICK_CENTROID_MIN = 1100;
const CLICK_BRIGHT_RATIO = 0.2;
const CLICK_ZCR_MIN = 0.065;

// Probabilidad de orientar cada brush como remolino en vez de radial.
// Valores mayores: composición más circular / espiralada.
// Valores menores: composición más explosiva / radial.
const SPIRAL_MIX = 0.68;

// Intensidad de agrupación en direcciones dominantes.
// Valores altos generan diagonales y zonas de insistencia más claras.
const DOMINANT_DIRECTION_CHANCE = 0.72;

// Distancia del campo de tensión desde el borde del punto de fuga.
const FOCUS_FIELD_SIZE = 280;

let queue = [];
let bgImg;
let sedimentLayer;

let vanishingX;
let vanishingY;
let figIdx = 0;

let lastLabel = '';
let removedLabel = '';
let nextFamily = 'warm';

let currentSeed;
let spiralDir = 1;
let dominantAngles = [];
let clearNoiseOffset = 0;
let showVanishingPoint = false;

// ─── Audio ──────────────────────────────────────────────────────────
let mic;
let fft;
let gestor;
let micActivo = false;
let antesHabiaSonido = false;
let ultimoBrushMs = 0;
let ultimoResetPorChasquidoMs = -9999;
let lastRawLevel = 0;
let lastClickHighEnergy = 0;
let clickCandidate = null;
let resetNotice = '';


// ═══════════════════════════════════════════════════════════════════
//  CLASE GESTOR — normaliza y amortigua la señal del micrófono
// ═══════════════════════════════════════════════════════════════════

class Gestor {
  constructor(smoothing, threshold) {
    this.smoothing = smoothing;
    this.threshold = threshold;
    this.nivel = 0;
  }

  // Recibe la amplitud cruda (0..1) y devuelve el nivel suavizado.
  // El suavizado es un filtro pasa-bajos de primer orden: evita que
  // picos instantáneos disparen falsos onsets.
  update(rawLevel) {
    let normalizado = constrain(rawLevel, 0, 1);
    this.nivel = this.nivel * this.smoothing + normalizado * (1 - this.smoothing);
    return this.nivel;
  }

  haySonido() {
    return this.nivel > this.threshold;
  }
}


// ═══════════════════════════════════════════════════════════════════
//  LECTURA SONORA — grave/agudo + chasquido
// ═══════════════════════════════════════════════════════════════════

function analyzeSound(rawLevel) {
  let waveform = fft.waveform();
  let waveformStats = getWaveformStats(waveform);
  let pitch = estimatePitchFromWaveform(waveform);
  let lowEnergy = fft.getEnergy(80, 260);
  let highVoiceEnergy = fft.getEnergy(900, 3200);
  let clickHighEnergy = fft.getEnergy(3500, 9000);
  let centroid = fft.getCentroid ? fft.getCentroid() : spectralCentroid(fft.analyze());

  let family = null;

  if (pitch.confidence >= PITCH_CONFIDENCE_MIN) {
    if (pitch.hz <= LOW_PITCH_MAX) {
      family = 'warm';
    } else if (pitch.hz >= HIGH_PITCH_MIN) {
      family = 'cool';
    }
  }

  // Si el tono cae en una zona media o la lectura no es estable, usamos el
  // brillo de la voz: más cuerpo grave = cálido; más energía alta = frío.
  if (!family) {
    let brightnessRatio = highVoiceEnergy / max(1, lowEnergy);

    if (brightnessRatio < 0.85 || centroid < 1250) {
      family = 'warm';
    } else if (brightnessRatio > 1.18 || centroid > 1750) {
      family = 'cool';
    }
  }

  return {
    rawLevel,
    family,
    pitchHz: pitch.hz,
    pitchConfidence: pitch.confidence,
    lowEnergy,
    highVoiceEnergy,
    clickHighEnergy,
    centroid,
    rms: waveformStats.rms,
    peak: waveformStats.peak,
    peakToRms: waveformStats.peakToRms,
    zeroCrossingRate: waveformStats.zeroCrossingRate,
  };
}

function getWaveformStats(waveform) {
  let sumSquares = 0;
  let peak = 0;
  let crossings = 0;

  for (let i = 0; i < waveform.length; i++) {
    let v = waveform[i];
    let av = abs(v);

    sumSquares += v * v;
    peak = max(peak, av);

    if (i > 0 && ((waveform[i - 1] < 0 && v >= 0) || (waveform[i - 1] >= 0 && v < 0))) {
      crossings++;
    }
  }

  let rms = sqrt(sumSquares / max(1, waveform.length));

  return {
    rms,
    peak,
    peakToRms: peak / max(0.000001, rms),
    zeroCrossingRate: crossings / max(1, waveform.length - 1),
  };
}

function estimatePitchFromWaveform(waveform) {
  let sampleRate = 44100;

  if (typeof getAudioContext === 'function') {
    sampleRate = getAudioContext().sampleRate || sampleRate;
  }

  let minLag = floor(sampleRate / 520);
  let maxLag = floor(sampleRate / 70);
  maxLag = min(maxLag, waveform.length - 2);

  let rms = 0;
  for (let i = 0; i < waveform.length; i++) {
    rms += waveform[i] * waveform[i];
  }
  rms = sqrt(rms / waveform.length);

  if (rms < 0.012 || maxLag <= minLag) {
    return { hz: 0, confidence: 0 };
  }

  let bestLag = 0;
  let bestCorrelation = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let energyA = 0;
    let energyB = 0;

    for (let i = 0; i < waveform.length - lag; i++) {
      let a = waveform[i];
      let b = waveform[i + lag];

      sum += a * b;
      energyA += a * a;
      energyB += b * b;
    }

    let correlation = sum / sqrt(max(0.000001, energyA * energyB));

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  if (!bestLag) {
    return { hz: 0, confidence: 0 };
  }

  return {
    hz: sampleRate / bestLag,
    confidence: constrain(bestCorrelation, 0, 1),
  };
}

function spectralCentroid(spectrum) {
  let nyquist = 22050;

  if (typeof getAudioContext === 'function') {
    nyquist = (getAudioContext().sampleRate || 44100) / 2;
  }

  let weighted = 0;
  let total = 0;

  for (let i = 0; i < spectrum.length; i++) {
    let freq = map(i, 0, spectrum.length - 1, 0, nyquist);
    let energy = spectrum[i];

    weighted += freq * energy;
    total += energy;
  }

  return total > 0 ? weighted / total : 0;
}

function updateTongueClickDetector(rawLevel, profile, nowMs) {
  if (nowMs - ultimoResetPorChasquidoMs < CLICK_COOLDOWN_MS) {
    clickCandidate = null;
    return null;
  }

  if (clickCandidate) {
    updateClickCandidate(rawLevel, profile);

    if (nowMs - clickCandidate.startedAt < CLICK_CONFIRM_MS) {
      return 'pending';
    }

    let candidate = clickCandidate;
    clickCandidate = null;

    // Un chasquido real ya debería haber terminado al confirmar. Si la energía
    // sigue alta y con tono, probablemente era voz o ruido sostenido.
    let endedQuickly = rawLevel < AUDIO_THRESHOLD || profile.rms < CLICK_RMS_MIN * 1.45;
    let notVoiced = candidate.voicedFrames <= 1;
    let hadEnoughGesture = candidate.score >= 2 || candidate.strongDryClick;

    return endedQuickly && notVoiced && hadEnoughGesture ? 'reset' : null;
  }

  let seed = clickSignal(rawLevel, profile);

  if (!seed.isCandidate) {
    return null;
  }

  clickCandidate = {
    startedAt: nowMs,
    score: seed.score,
    strongDryClick: seed.strongDryClick,
    voicedFrames: isVoicedSound(rawLevel, profile) ? 1 : 0,
  };

  return 'pending';
}

function updateClickCandidate(rawLevel, profile) {
  let signal = clickSignal(rawLevel, profile);

  clickCandidate.score = max(clickCandidate.score, signal.score);
  clickCandidate.strongDryClick = clickCandidate.strongDryClick || signal.strongDryClick;

  if (isVoicedSound(rawLevel, profile)) {
    clickCandidate.voicedFrames++;
  }
}

function clickSignal(rawLevel, profile) {
  let rise = rawLevel - lastRawLevel;
  let highRise = profile.clickHighEnergy - lastClickHighEnergy;
  let brightRatio = profile.clickHighEnergy / max(1, profile.lowEnergy);
  let hasMinimumEnergy = rawLevel > CLICK_RAW_THRESHOLD ||
    profile.rms > CLICK_RMS_MIN ||
    profile.clickHighEnergy > CLICK_HIGH_ENERGY_MIN;
  let hasRawSpike = rawLevel > CLICK_RAW_THRESHOLD && rise > CLICK_RISE_THRESHOLD;
  let hasWavePeak = profile.peak > CLICK_PEAK_THRESHOLD &&
    profile.peakToRms > CLICK_PEAK_TO_RMS_MIN;
  let hasHighSpike = profile.clickHighEnergy > CLICK_HIGH_ENERGY_MIN ||
    highRise > CLICK_HIGH_RISE_MIN;
  let isBrightOrNoisy = profile.centroid > CLICK_CENTROID_MIN ||
    brightRatio > CLICK_BRIGHT_RATIO ||
    profile.zeroCrossingRate > CLICK_ZCR_MIN;

  let clickVotes = 0;
  if (hasRawSpike) clickVotes++;
  if (hasWavePeak) clickVotes++;
  if (hasHighSpike && isBrightOrNoisy) clickVotes++;
  let strongDryClick = hasWavePeak && hasHighSpike && isBrightOrNoisy;

  return {
    score: clickVotes,
    strongDryClick,
    isCandidate: hasMinimumEnergy && (clickVotes >= 2 || strongDryClick),
  };
}

function isVoicedSound(rawLevel, profile) {
  return rawLevel > AUDIO_THRESHOLD &&
    profile.pitchConfidence > 0.78 &&
    profile.peakToRms < CLICK_PEAK_TO_RMS_MIN * 1.45;
}


// ═══════════════════════════════════════════════════════════════════
//  CICLO p5.js
// ═══════════════════════════════════════════════════════════════════

function preload() {
  for (let file of WARM_BRUSH_FILES) {
    let img = loadImage(`Brushes/Calidos/${file}`);
    img.brushId = file;
    img.brushFamily = 'warm';
    warmBrushes.push(img);
  }

  for (let file of COOL_BRUSH_FILES) {
    let img = loadImage(`Brushes/Frios/${file}`);
    img.brushId = file;
    img.brushFamily = 'cool';
    coolBrushes.push(img);
  }
}

function setup() {
  createCanvas(900, 700).parent('canvas-wrap');

  prepareBrushMasks(warmBrushes);
  prepareBrushMasks(coolBrushes);

  // Audio: la entrada se prepara pero no arranca hasta el primer clic.
  // Los navegadores exigen un gesto del usuario para habilitar el micrófono.
  mic = new p5.AudioIn();
  fft = new p5.FFT(FFT_SMOOTHING, FFT_BINS);
  fft.setInput(mic);
  gestor = new Gestor(AUDIO_SMOOTHING, AUDIO_THRESHOLD);

  initArtwork();
}

// El loop queda activo solo para sondear el micrófono.
// El canvas no se repinta cada frame: redrawAll() se llama únicamente
// cuando hay un evento (onset o reinicio), y p5 conserva el dibujo previo.
function draw() {
  if (!micActivo) {
    return;
  }

  let raw = mic.getLevel();
  fft.analyze();
  let soundProfile = analyzeSound(raw);
  gestor.update(raw);

  let haySonido = gestor.haySonido();
  let ahora = millis();

  let clickState = updateTongueClickDetector(raw, soundProfile, ahora);

  if (clickState === 'reset') {
    ultimoResetPorChasquidoMs = ahora;
    lastRawLevel = raw;
    lastClickHighEnergy = soundProfile.clickHighEnergy;
    antesHabiaSonido = false;
    initArtwork();
    resetNotice = 'Reinicio por chasquido';
    renderHUD();
    return;
  }

  if (clickState === 'pending') {
    antesHabiaSonido = false;
  } else if (haySonido) {
    let esOnset = !antesHabiaSonido;

    if (esOnset) {
      // Onset: paso de silencio a sonido. Primer brush inmediato.
      agregarBrushPorSonido(soundProfile.family);
      ultimoBrushMs = ahora;
    } else if (ahora - ultimoBrushMs > SUSTAINED_INTERVAL_MS) {
      // Sonido sostenido: seguir pintando a intervalo regulado.
      agregarBrushPorSonido(soundProfile.family);
      ultimoBrushMs = ahora;
    }
  }

  antesHabiaSonido = clickState === 'pending' ? false : haySonido;
  lastRawLevel = raw;
  lastClickHighEnergy = soundProfile.clickHighEnergy;
}

function agregarBrushPorSonido(soundFamily = null) {
  removedLabel = '';
  resetNotice = '';

  if (queue.length >= MAX_QUEUE) {
    let removed = queue.shift();
    // El stamp expulsado se funde al sedimento con alpha reducido.
    removed.drawOnto(sedimentLayer, SEDIMENT_ALPHA_MUL);
    removedLabel = removed.label;
  }

  let fig = newFigure(soundFamily);

  queue.push(fig);
  lastLabel = fig.label;

  redrawAll();
  renderHUD();
}

// El primer clic habilita el contexto de audio y arranca el micrófono.
function mousePressed() {
  userStartAudio();

  if (!micActivo) {
    mic.start(() => {
      micActivo = true;
      renderHUD();
    });
  }
}

// El agregar-brush pasó a ser por sonido.
// El teclado queda como control utilitario: reinicio, guardar, foco.
function keyPressed() {
  if (key === 'r' || key === 'R') {
    initArtwork();
    return;
  }

  if (key === 's' || key === 'S') {
    saveCanvas(`obra-v-seed-${currentSeed}`, 'png');
    return;
  }

  if (key === 'v' || key === 'V') {
    showVanishingPoint = !showVanishingPoint;
    redrawAll();
    renderHUD();
    return;
  }
}


// ═══════════════════════════════════════════════════════════════════
//  INIT / REDRAW
// ═══════════════════════════════════════════════════════════════════

function initArtwork() {
  currentSeed = floor(random(999999));

  randomSeed(currentSeed);
  noiseSeed(currentSeed);

  // El foco compositivo no está centrado: esto mantiene la tensión asimétrica
  // de la serie original.
  vanishingX = random(width * 0.28, width * 0.72);
  vanishingY = random(height * 0.24, height * 0.68);

  spiralDir = random() < 0.5 ? -1 : 1;
  clearNoiseOffset = random(1000);

  // Tres familias direccionales. No encorsetan la obra, pero le dan
  // diagonales dominantes y zonas de mayor densidad.
  dominantAngles = [
    random(TWO_PI),
    random(TWO_PI),
    random(TWO_PI),
  ];

  drawBackground();

  // Estado limpio antes de capturar el fondo.
  imageMode(CORNER);
  noTint();

  bgImg = get();

  // Capa de sedimento: acumula los stamps que la cola va expulsando.
  // Se crea una sola vez y se limpia en cada reinicio.
  if (!sedimentLayer) {
    sedimentLayer = createGraphics(width, height);
  } else {
    sedimentLayer.clear();
  }

  queue = [];
  figIdx = 0;
  lastLabel = '';
  removedLabel = '';
  resetNotice = '';
  lastRawLevel = 0;
  lastClickHighEnergy = 0;
  clickCandidate = null;
  nextFamily = random() < 0.5 ? 'warm' : 'cool';

  redrawAll();
  renderHUD();
}

function redrawAll() {
  imageMode(CORNER);
  noTint();

  image(bgImg, 0, 0);

  // Sedimento: stamps que ya salieron de la cola, con alpha reducido.
  // Se pinta encima del fondo y debajo de la cola activa.
  if (sedimentLayer) {
    image(sedimentLayer, 0, 0);
  }

  // Orden pictórico de capas:
  // barridos grandes al fondo, masas después, cintas como estructura,
  // tallos/líneas como acentos superiores.
  let ordered = [...queue].sort((a, b) => layerRank(a.kind) - layerRank(b.kind));

  for (let fig of ordered) {
    fig.draw();
  }

  if (showVanishingPoint) {
    drawVanishingPoint();
  }

  imageMode(CORNER);
  noTint();
}

function layerRank(kind) {
  const order = {
    sweep: 0,
    mass: 1,
    ribbon: 2,
    stem: 3,
  };

  return order[kind] ?? 99;
}


// ═══════════════════════════════════════════════════════════════════
//  PREPARACIÓN DE MÁSCARAS
// ═══════════════════════════════════════════════════════════════════

function prepareBrushMasks(pool) {
  for (let br of pool) {
    br.whiteMask = makeWhiteMask(br);
  }
}

function makeWhiteMask(src) {
  let mask = createImage(src.width, src.height);

  src.loadPixels();
  mask.loadPixels();

  for (let i = 0; i < src.pixels.length; i += 4) {
    mask.pixels[i]     = 255;
    mask.pixels[i + 1] = 255;
    mask.pixels[i + 2] = 255;
    mask.pixels[i + 3] = src.pixels[i + 3];
  }

  mask.updatePixels();
  return mask;
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
    ellipse(vanishingX, vanishingY, r * 2.3, r * 1.65);
  }

  // Segundo halo desplazado para romper la simetría.
  let hx = vanishingX + random(-210, 210);
  let hy = vanishingY + random(-150, 150);

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
//  PUNTO DE FUGA / CAMPO DE TENSIÓN
// ═══════════════════════════════════════════════════════════════════

function clearRadiusAt(theta) {
  // Deforma el radio para que el vacío no sea un círculo perfecto.
  let n = noise(
    cos(theta) * 1.7 + clearNoiseOffset,
    sin(theta) * 1.7 + clearNoiseOffset
  );

  return VANISHING_CLEAR_RADIUS * map(n, 0, 1, 0.75, 1.35);
}

function focusInfluence(x, y) {
  // Devuelve 0 cerca del punto de fuga y 1 lejos.
  // Se usa para comprimir tamaño, transparencia y giro.
  let theta = atan2(y - vanishingY, x - vanishingX);
  let r = clearRadiusAt(theta);
  let d = dist(x, y, vanishingX, vanishingY);

  return constrain(map(d, r, r + FOCUS_FIELD_SIZE, 0, 1), 0, 1);
}

function drawVanishingPoint() {
  push();

  noFill();

  // Dibuja una línea irregular para visualizar el vacío real.
  stroke(255, 252, 236, 90);
  strokeWeight(1);

  beginShape();
  for (let a = 0; a <= TWO_PI + 0.01; a += TWO_PI / 100) {
    let r = clearRadiusAt(a);
    vertex(vanishingX + cos(a) * r, vanishingY + sin(a) * r);
  }
  endShape(CLOSE);

  stroke(255, 255, 255, 215);
  strokeWeight(2);
  ellipse(vanishingX, vanishingY, 22, 22);

  stroke(25, 25, 25, 160);
  strokeWeight(1);
  line(vanishingX - 17, vanishingY, vanishingX + 17, vanishingY);
  line(vanishingX, vanishingY - 17, vanishingX, vanishingY + 17);

  fill(25, 25, 25, 190);
  noStroke();
  ellipse(vanishingX, vanishingY, 5, 5);

  pop();
}


// ═══════════════════════════════════════════════════════════════════
//  GEOMETRÍA COMPOSITIVA
// ═══════════════════════════════════════════════════════════════════

function chooseTheta() {
  if (random() < DOMINANT_DIRECTION_CHANCE) {
    let base = dominantAngles[floor(random(dominantAngles.length))];

    // randomGaussian() genera insistencia alrededor de una dirección
    // sin volverla rígida o repetitiva.
    return randomGaussian(base, 0.42);
  }

  return random(TWO_PI);
}

function distanceToCanvasEdge(theta, margin) {
  let dx = cos(theta);
  let dy = sin(theta);
  let candidates = [];

  if (abs(dx) > 0.0001) {
    candidates.push((-margin - vanishingX) / dx);
    candidates.push((width + margin - vanishingX) / dx);
  }

  if (abs(dy) > 0.0001) {
    candidates.push((-margin - vanishingY) / dy);
    candidates.push((height + margin - vanishingY) / dy);
  }

  let positive = candidates.filter(t => t > 0);
  return min(positive);
}

function radialPlacement(minRatio, maxRatio, drift, brush, stampW) {
  let theta = chooseTheta();
  let edgeDist = distanceToCanvasEdge(theta, 130);

  let minClearance = clearDistanceFor(brush, stampW, theta);
  let minDist = max(edgeDist * minRatio, minClearance);
  let maxDist = max(edgeDist * maxRatio, minDist + 24);

  // pow(random(), 0.68) favorece distancias más externas,
  // pero todavía permite acercamientos al campo de fuga.
  let d = lerp(minDist, maxDist, pow(random(), 0.68));

  // Deriva lateral: evita que todo parezca una regla radial.
  let side = random(-drift, drift);

  let x = vanishingX + cos(theta) * d + cos(theta + HALF_PI) * side;
  let y = vanishingY + sin(theta) * d + sin(theta + HALF_PI) * side;

  return {
    x,
    y,
    theta,
    d,
    edgeDist,
    focus: focusInfluence(x, y),
  };
}

function radialAngle(brush, theta, jitter) {
  let br = brush.img;
  let angleOffset = br && br.height > br.width ? -Math.PI / 2 : 0;

  return theta +
    angleOffset +
    random(-jitter, jitter);
}

function spiralAngle(brush, theta, jitter, focus) {
  let br = brush.img;
  let angleOffset = br && br.height > br.width ? -Math.PI / 2 : 0;

  let radial = theta;
  let tangent = theta + spiralDir * HALF_PI;

  // Cerca del punto de fuga aumenta levemente el giro.
  let localMix = constrain(SPIRAL_MIX + (1 - focus) * 0.18, 0, 0.92);
  let angle = mixAngle(radial, tangent, localMix);

  return angle +
    angleOffset +
    spiralDir * (1 - focus) * random(0.04, 0.19) +
    random(-jitter, jitter);
}

function angleDifference(a, b) {
  return atan2(sin(b - a), cos(b - a));
}

function mixAngle(a, b, amount) {
  return a + angleDifference(a, b) * amount;
}

function brushRadialLength(brush, stampW) {
  let br = brush.img;

  if (!br || br.width === 0) {
    return stampW;
  }

  let stampH = stampW * (br.height / br.width);
  return max(stampW, stampH);
}

function sizeForBrush(brush, minLongSide, maxLongSide) {
  let br = brush.img;

  if (!br || br.width === 0) {
    return random(minLongSide, maxLongSide);
  }

  let aspect = br.height / br.width;
  let longFactor = max(1, aspect);
  let targetLongSide = random(minLongSide, maxLongSide);

  return targetLongSide / longFactor;
}

function clearDistanceFor(brush, stampW, theta) {
  return clearRadiusAt(theta) + brushRadialLength(brush, stampW) * 0.46;
}

function modulateStampNearFocus(stampW, focus) {
  // Cerca del punto de fuga se reducen los brushes.
  // Lejos del foco recuperan escala e intensidad.
  return stampW * lerp(0.78, 1.10, pow(focus, 0.65));
}

function alphaNearFocus(focus) {
  // Leve transparencia cerca del campo de fuga para que el vacío no parezca
  // recortado con tijera.
  return floor(lerp(214, 255, pow(focus, 0.7)));
}


// ═══════════════════════════════════════════════════════════════════
//  SELECCIÓN DE BRUSHES
// ═══════════════════════════════════════════════════════════════════

function familyPool(family) {
  return family === 'warm' ? warmBrushes : coolBrushes;
}

function countFamily(family) {
  let count = 0;

  for (let fig of queue) {
    if (fig.family === family) {
      count++;
    }
  }

  return count;
}

function countBrushUsage(brushId) {
  let count = 0;

  for (let fig of queue) {
    if (fig.brushId === brushId) {
      count++;
    }
  }

  return count;
}

function balancedFamily() {
  let warmCount = countFamily('warm');
  let coolCount = countFamily('cool');

  if (warmCount < coolCount) return 'warm';
  if (coolCount < warmCount) return 'cool';

  let family = nextFamily;
  nextFamily = nextFamily === 'warm' ? 'cool' : 'warm';

  return family;
}

function pickBrushFromPool(pool, family) {
  let available = pool.filter(br => countBrushUsage(br.brushId) < MAX_BRUSH_REPEATS);
  let source = available.length ? available : pool;
  let picked = source[floor(random(source.length))];

  return {
    family,
    id: picked.brushId,
    img: picked,
  };
}

function randomBrush(family) {
  return pickBrushFromPool(familyPool(family), family);
}

function randomWideBrush(family) {
  let pool = familyPool(family);
  let candidates = [];

  for (let br of pool) {
    if (br && br.width >= br.height) {
      candidates.push(br);
    }
  }

  let available = candidates.filter(br => countBrushUsage(br.brushId) < MAX_BRUSH_REPEATS);
  let source = available.length
    ? available
    : candidates.length
      ? candidates
      : pool.filter(br => countBrushUsage(br.brushId) < MAX_BRUSH_REPEATS);

  if (!source.length) {
    source = candidates.length ? candidates : pool;
  }

  return pickBrushFromPool(source, family);
}

function randomTallBrush(family) {
  let pool = familyPool(family);
  let candidates = [];

  for (let br of pool) {
    if (br && br.height > br.width) {
      candidates.push(br);
    }
  }

  let available = candidates.filter(br => countBrushUsage(br.brushId) < MAX_BRUSH_REPEATS);
  let source = available.length
    ? available
    : candidates.length
      ? candidates
      : pool.filter(br => countBrushUsage(br.brushId) < MAX_BRUSH_REPEATS);

  if (!source.length) {
    source = candidates.length ? candidates : pool;
  }

  return pickBrushFromPool(source, family);
}


// ═══════════════════════════════════════════════════════════════════
//  GENERADORES DE FIGURAS
// ═══════════════════════════════════════════════════════════════════

function newFigure(soundFamily = null) {
  figIdx++;

  let r = random();
  let family = soundFamily || balancedFamily();

  if (r < 0.28) return makeMass(family);
  if (r < 0.72) return makeRibbon(family);
  if (r < 0.88) return makeSweep(family);

  return makeStem(family);
}


// ─── MASA ORGÁNICA — brush grande, forma de mancha ──────────────────

function makeMass(family) {
  let t = random();
  let label;

  if (t < 0.33) {
    label = family === 'warm' ? 'Masa cálida' : 'Masa fría';
  } else if (t < 0.66) {
    label = family === 'warm' ? 'Acento cálido' : 'Acento frío';
  } else {
    label = family === 'warm' ? 'Rojo / amarillo' : 'Azul / verde';
  }

  let brush = random() < 0.72 ? randomWideBrush(family) : randomBrush(family);
  let stampW = sizeForBrush(brush, 260, 420);

  let pos = radialPlacement(0.08, 0.82, 34, brush, stampW);
  stampW = modulateStampNearFocus(stampW, pos.focus);

  let angle = spiralAngle(brush, pos.theta, 0.018, pos.focus);
  let alpha = alphaNearFocus(pos.focus);

  return stamp(label, brush, pos.x, pos.y, angle, stampW, 'mass', alpha);
}


// ─── CINTA CURVA — brush medio, orientación diagonal/horizontal ──────

function makeRibbon(family) {
  let brush = randomWideBrush(family);
  let stampW = sizeForBrush(brush, 330, 560);

  let pos = radialPlacement(0.12, 1.02, 24, brush, stampW);
  stampW = modulateStampNearFocus(stampW, pos.focus);

  let angle = spiralAngle(brush, pos.theta, 0.012, pos.focus);
  let alpha = alphaNearFocus(pos.focus);

  return stamp(family === 'warm' ? 'Cinta cálida' : 'Cinta fría', brush, pos.x, pos.y, angle, stampW, 'ribbon', alpha);
}


// ─── BARRIDO AMPLIO — brush grande, cubre zonas amplias ─────────────

function makeSweep(family) {
  let brush = random() < 0.78 ? randomWideBrush(family) : randomBrush(family);
  let stampW = sizeForBrush(brush, 470, 700);

  let pos = radialPlacement(0.24, 1.08, 28, brush, stampW);
  stampW = modulateStampNearFocus(stampW, pos.focus);

  let angle = spiralAngle(brush, pos.theta, 0.016, pos.focus);
  let alpha = alphaNearFocus(pos.focus);

  return stamp(family === 'warm' ? 'Barrido cálido' : 'Barrido frío', brush, pos.x, pos.y, angle, stampW, 'sweep', alpha);
}


// ─── TALLO — brush fino, orientación vertical ────────────────────────

function makeStem(family) {
  let brush = random() < 0.72 ? randomTallBrush(family) : randomWideBrush(family);
  let stampW = sizeForBrush(brush, 300, 460);

  let pos = radialPlacement(0.10, 0.98, 12, brush, stampW);
  stampW = modulateStampNearFocus(stampW, pos.focus);

  let angle = spiralAngle(brush, pos.theta, 0.008, pos.focus);
  let alpha = alphaNearFocus(pos.focus);

  return stamp(family === 'warm' ? 'Tallo cálido' : 'Tallo frío', brush, pos.x, pos.y, angle, stampW, 'stem', alpha);
}


// ═══════════════════════════════════════════════════════════════════
//  STAMP — constructor de figura individual
// ═══════════════════════════════════════════════════════════════════

function stamp(label, brush, x, y, angle, stampW, kind, alpha = 255) {
  // Todos los parámetros quedan fijos en el closure.
  // draw() no llama a random().
  // Es completamente determinista.

  return {
    label,
    kind,
    family: brush.family,
    brushId: brush.id,

    draw() {
      let br = brush.img;

      if (!br || br.width === 0) {
        // Fallback si el PNG no cargó.
        push();

        noStroke();
        fill(255, 252, 236, alpha);

        translate(x, y);
        rotate(angle);
        ellipse(0, 0, stampW, stampW * 0.38);

        pop();

        imageMode(CORNER);
        noTint();

        return;
      }

      let stampH = stampW * (br.height / br.width);
      let outlineW = stampW + OUTLINE_PAD;
      let outlineH = outlineW * (br.height / br.width);

      push();

      imageMode(CENTER);

      translate(x, y);
      rotate(angle);

      tint(255, OUTLINE_ALPHA);
      image(br.whiteMask, 0, 0, outlineW, outlineH);

      tint(255, alpha);
      image(br, 0, 0, stampW, stampH);

      pop();

      imageMode(CORNER);
      noTint();
    },

    // Renderiza el mismo stamp sobre un p5.Graphics arbitrario
    // (usado por el sedimento) con un multiplicador de alpha.
    drawOnto(g, alphaMul = 1) {
      let br = brush.img;

      if (!br || br.width === 0) {
        return;
      }

      let stampH = stampW * (br.height / br.width);
      let outlineW = stampW + OUTLINE_PAD;
      let outlineH = outlineW * (br.height / br.width);

      g.push();
      g.imageMode(CENTER);
      g.translate(x, y);
      g.rotate(angle);

      g.tint(255, OUTLINE_ALPHA * alphaMul);
      g.image(br.whiteMask, 0, 0, outlineW, outlineH);

      g.tint(255, alpha * alphaMul);
      g.image(br, 0, 0, stampW, stampH);

      g.pop();
    },
  };
}


// ═══════════════════════════════════════════════════════════════════
//  HUD
// ═══════════════════════════════════════════════════════════════════

function renderHUD() {
  let nameEl = document.getElementById('phase-name');
  let stepEl = document.getElementById('step-counter');

  if (!nameEl || !stepEl) {
    return;
  }

  if (!micActivo) {
    nameEl.textContent = 'Hacé clic para activar el micrófono';
  } else if (resetNotice) {
    nameEl.textContent = resetNotice;
  } else if (queue.length === 0) {
    nameEl.textContent = 'Hacé un sonido grave o agudo para colocar el primer brush';
  } else {
    let note = removedLabel ? `  ·  −${removedLabel}` : '';
    nameEl.textContent = `+${lastLabel}${note}`;
  }

  let focusState = showVanishingPoint ? 'foco visible' : 'foco oculto';
  let micState = micActivo ? 'mic activo' : 'mic en espera';
  stepEl.textContent = `${queue.length} / ${MAX_QUEUE}  ·  seed ${currentSeed}  ·  ${micState}  ·  chasquido reinicia  ·  R reiniciar  ·  S guardar  ·  V ${focusState}`;
}
