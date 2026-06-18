# Colección — Obra V modificada

Archivos incluidos:
- `index.html`
- `sketch.js`

No se incluyen los PNG de brushes porque están en tu equipo.

## Estructura esperada

Para usarlo directamente en Visual Studio Code, dejá la carpeta así:

```text
obra-v-modificada/
├─ index.html
├─ sketch.js
└─ Brushes/
   ├─ Calidos/
   │  ├─ Brush03.png
   │  ├─ Brush05.png
   │  └─ ...
   └─ Frios/
      ├─ Brush01.png
      ├─ Brush02.png
      └─ ...
```

## Controles

- Clic inicial: activa el micrófono.
- Sonido grave: agrega un brush cálido.
- Sonido agudo: agrega un brush frío.
- Sonido sostenido: pinta brushes en cadencia.
- Chasquido de lengua: reinicia la composición.
- R: reinicia la composición.
- S: guarda la obra en PNG.
- V: muestra u oculta el punto de fuga.

## Cambios principales

- Punto de fuga como campo de tensión.
- Vacío central irregular con noise().
- Orientación espiralada de los brushes.
- Direcciones dominantes para evitar distribución uniforme.
- Orden de capas: barridos, masas, cintas y tallos.
- Semilla visible para identificar composiciones.
