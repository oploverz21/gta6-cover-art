// Neon Cover Maker — wires the editor: photos, panels, grade, caption,
// size and export. A `?shot=` query sets up a fixed scene for a screenshot
// instead (./shots.js). Photos are read on the user's own machine and never
// uploaded; the app makes no network request at all.
import { drawCover, SIZES, PANEL_NAMES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const captionInput = document.getElementById('caption');
const subtitleInput = document.getElementById('subtitle');
const gradeInput = document.getElementById('grade');
const neonInput = document.getElementById('neon');
const status = document.getElementById('status');

const state = {
  size: 'square',
  photos: { A: null, B: null, C: null },
  // Crops are tuned so faces stay in frame: the hero and top-right photos
  // are shifted up in the image (positive oy) because wide panels crop
  // portrait photos top and bottom.
  panels: [
    { photo: 'A', zoom: 1.05, ox: 0.06, oy: 0.1 },
    { photo: 'B', zoom: 1.1, ox: 0, oy: 0.15 },
    { photo: 'A', zoom: 1.7, ox: -0.08, oy: 0.08 },
  ],
  caption: 'SUNSET HEIST',
  subtitle: 'VICE CITY',
  grade: 0.7,
  neon: true,
};

let samplesReady = null;

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** The two free sample photos ship under app/samples/ and load by default. */
function ensureSamples() {
  if (!samplesReady) {
    samplesReady = (async () => {
      try {
        state.photos.A = await loadImage('samples/boulevard.jpg');
        document.getElementById('thumb-A').src = 'samples/boulevard.jpg';
      } catch {
        // A missing sample leaves an empty panel; the editor still works.
      }
      try {
        state.photos.B = await loadImage('samples/pier.jpg');
        document.getElementById('thumb-B').src = 'samples/pier.jpg';
      } catch {
        // As above.
      }
      redraw();
    })();
  }
  return samplesReady;
}

function redraw() {
  drawCover(canvas, state);
}

/** Renders one export size to a fresh canvas and downloads it as a PNG. */
function exportPNG(sizeKey) {
  const off = document.createElement('canvas');
  drawCover(off, { ...state, size: sizeKey });
  const name = `neon-cover-${sizeKey}.png`;
  off.toBlob((blob) => {
    if (!blob) {
      status.textContent = 'Export failed: the browser could not make the PNG.';
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    status.textContent = `Saved ${name} (${SIZES[sizeKey].w} x ${SIZES[sizeKey].h}).`;
  }, 'image/png');
}

function setSize(sizeKey) {
  state.size = sizeKey;
  document.querySelectorAll('[data-size]').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === sizeKey);
  });
  redraw();
}

// Photo slots: choose a file, or fall back to the free sample.
for (const key of ['A', 'B', 'C']) {
  document.getElementById(`file-${key}`).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const img = await loadImage(URL.createObjectURL(file));
      state.photos[key] = img;
      document.getElementById(`thumb-${key}`).src = URL.createObjectURL(file);
      status.textContent = `Photo ${key} loaded: ${file.name}.`;
      redraw();
    } catch {
      status.textContent = `Photo ${key} could not be read.`;
    }
  });
  document.getElementById(`sample-${key}`).addEventListener('click', async () => {
    await ensureSamples();
    const sample = key === 'B' || key === 'C' ? 'pier.jpg' : 'boulevard.jpg';
    try {
      state.photos[key] = await loadImage(`samples/${sample}`);
      document.getElementById(`thumb-${key}`).src = `samples/${sample}`;
      status.textContent = `Photo ${key} set to the sample photo.`;
      redraw();
    } catch {
      status.textContent = 'The sample photo could not be loaded.';
    }
  });
}

// Per-panel controls: which photo, and how it is cropped and positioned.
for (let i = 0; i < 3; i += 1) {
  document.getElementById(`p${i}-photo`).addEventListener('change', (e) => {
    state.panels[i].photo = e.target.value;
    redraw();
  });
  document.getElementById(`p${i}-zoom`).addEventListener('input', (e) => {
    state.panels[i].zoom = Number(e.target.value);
    redraw();
  });
  document.getElementById(`p${i}-ox`).addEventListener('input', (e) => {
    state.panels[i].ox = Number(e.target.value);
    redraw();
  });
  document.getElementById(`p${i}-oy`).addEventListener('input', (e) => {
    state.panels[i].oy = Number(e.target.value);
    redraw();
  });
}

gradeInput.addEventListener('input', () => {
  state.grade = Number(gradeInput.value) / 100;
  redraw();
});
neonInput.addEventListener('change', () => {
  state.neon = neonInput.checked;
  redraw();
});
captionInput.addEventListener('input', () => {
  state.caption = captionInput.value;
  redraw();
});
subtitleInput.addEventListener('input', () => {
  state.subtitle = subtitleInput.value;
  redraw();
});

document.querySelectorAll('[data-size]').forEach((b) => {
  b.addEventListener('click', () => setSize(b.dataset.size));
});
document.getElementById('export').addEventListener('click', () => exportPNG(state.size));
document.getElementById('export-all').addEventListener('click', async () => {
  for (const sizeKey of Object.keys(SIZES)) {
    exportPNG(sizeKey);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 500));
  }
});

/**
 * Applies one fixed scene (used by ?shot= screenshots). Cover scenes pick
 * one sample photo for the hero and bottom panels and the other for the top
 * panel, so the poster shows both samples.
 */
export async function applyScene(scene) {
  await ensureSamples();
  if (scene.mode === 'cover') {
    const main = scene.photo === 'pier' ? 'B' : 'A';
    const other = main === 'A' ? 'B' : 'A';
    state.size = scene.size || 'square';
    state.caption = scene.caption ?? 'Sunset Heist';
    state.subtitle = scene.subtitle ?? 'Vice City';
    state.panels = [
      { photo: main, zoom: 1.05, ox: 0.06, oy: 0.1 },
      { photo: other, zoom: 1.1, ox: 0, oy: 0.15 },
      { photo: main, zoom: 1.7, ox: -0.08, oy: 0.08 },
    ];
    captionInput.value = state.caption;
    subtitleInput.value = state.subtitle;
    document.querySelectorAll('[data-size]').forEach((b) => {
      b.classList.toggle('active', b.dataset.size === state.size);
    });
  }
  redraw();
}

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), applyScene);
} else {
  ensureSamples();
}
