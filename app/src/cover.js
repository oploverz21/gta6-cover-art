// Neon Cover Maker — draws a GTA-style multi-panel poster cover onto a canvas.
//
// Layout: a hero panel on the left, two stacked panels on the right, and a
// title band below with big bold lettering. Each panel takes its own photo,
// crop and position; a sunset grade and an optional neon boost tie the panels
// into one poster. The lettering is plain system sans-serif in the maker's
// own style: no Rockstar logo, artwork, character or font is used anywhere.

export const SIZES = {
  square: { w: 1080, h: 1080, label: 'Square 1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait 1080 x 1350' },
  wide: { w: 1920, h: 1080, label: 'Wide 1920 x 1080' },
};

export const PANEL_NAMES = ['Hero', 'Top right', 'Bottom right'];

const FRAME = '#17121f';
const GOLD = '#f5c542';

/** Geometry for one export size: the three panels and the title band. */
function layout(size) {
  const { w: W, h: H } = SIZES[size];
  const pad = Math.round(W * 0.013);
  const gap = Math.max(8, Math.round(W * 0.008));
  const bandH = Math.round(H * 0.2);
  const gridX = pad;
  const gridY = pad;
  const gridW = W - pad * 2;
  const gridH = H - bandH - pad * 2 - gap;
  const heroW = Math.round((gridW - gap) * 0.6);
  const rightX = gridX + heroW + gap;
  const rightW = gridW - heroW - gap;
  const topH = Math.round((gridH - gap) * 0.52);
  return {
    W,
    H,
    pad,
    gap,
    bandH,
    panels: [
      { x: gridX, y: gridY, w: heroW, h: gridH },
      { x: rightX, y: gridY, w: rightW, h: topH },
      { x: rightX, y: gridY + topH + gap, w: rightW, h: gridH - topH - gap },
    ],
    band: { x: pad, y: gridY + gridH + gap, w: gridW, h: bandH },
  };
}

function captionFont(size) {
  return `900 ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
}

/** Greedy word wrap of `words` to lines no wider than `maxW` (font already set). */
function wrapLines(ctx, words, maxW) {
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxW || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Largest caption size (and its wrapped lines, at most two) fitting `maxW`
 * and `maxLineH` — the height the caption lines may take inside the title
 * band once the neon rule, the subtitle and the gaps are accounted for.
 * Without the height check a two-line caption at full size overflowed the
 * band and the subtitle was drawn below the canvas edge.
 */
function fitCaption(ctx, text, maxW, maxLineH) {
  const words = text.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (!words.length) return { size: 0, lines: [] };
  let size = 120;
  while (size > 18) {
    ctx.font = captionFont(size);
    const lines = wrapLines(ctx, words, maxW);
    if (lines.length <= 2 && lines.length * size * 1.06 <= maxLineH) return { size, lines };
    size -= 4;
  }
  ctx.font = captionFont(18);
  return { size: 18, lines: wrapLines(ctx, words, maxW).slice(0, 2) };
}

/** One panel: the photo cover-fitted with its crop, then the sunset grade. */
function drawPanel(ctx, rect, img, panel, grade, neon) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (img) {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * panel.zoom;
    const pw = img.naturalWidth * scale;
    const ph = img.naturalHeight * scale;
    // Clamp the shift to the slack (drawn size minus panel size): an
    // unclamped offset leaves a bare gap when the photo is only slightly
    // larger than the panel, as the portrait hero showed.
    const maxOx = Math.max(0, (pw - w) / 2);
    const maxOy = Math.max(0, (ph - h) / 2);
    const cx = x + w / 2 + Math.max(-maxOx, Math.min(maxOx, panel.ox * w));
    const cy = y + h / 2 + Math.max(-maxOy, Math.min(maxOy, panel.oy * h));
    if (neon) ctx.filter = 'saturate(1.35) contrast(1.12) brightness(1.04)';
    ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
    ctx.filter = 'none';
  } else {
    ctx.fillStyle = '#241a33';
    ctx.fillRect(x, y, w, h);
  }
  // Sunset wash: warm from the bottom, cool from the top.
  const wash = ctx.createLinearGradient(0, y, 0, y + h);
  wash.addColorStop(0, 'rgba(255, 110, 60, 0)');
  wash.addColorStop(0.55, `rgba(255, 110, 60, ${(0.1 * grade).toFixed(3)})`);
  wash.addColorStop(1, `rgba(214, 40, 120, ${(0.34 * grade).toFixed(3)})`);
  ctx.fillStyle = wash;
  ctx.fillRect(x, y, w, h);
  const cool = ctx.createLinearGradient(0, y, 0, y + h * 0.4);
  cool.addColorStop(0, `rgba(80, 40, 160, ${(0.12 * grade).toFixed(3)})`);
  cool.addColorStop(1, 'rgba(80, 40, 160, 0)');
  ctx.fillStyle = cool;
  ctx.fillRect(x, y, w, h * 0.4);
  // Vignette: darken the corners so the panels read as one poster.
  const cx = x + w / 2;
  const cy = y + h / 2;
  const vig = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.45, cx, cy, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, `rgba(10, 5, 20, ${(0.28 * grade).toFixed(3)})`);
  ctx.fillStyle = vig;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.restore();
}

/** The title band: a neon rule, the big caption, and a gold subtitle. */
function drawBand(ctx, band, caption, subtitle) {
  const { x, y, w, h } = band;
  const bg = ctx.createLinearGradient(0, y, 0, y + h);
  bg.addColorStop(0, '#241031');
  bg.addColorStop(1, '#160a20');
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  const ruleH = Math.max(4, Math.round(h * 0.03));
  const rule = ctx.createLinearGradient(x, 0, x + w, 0);
  rule.addColorStop(0, '#ff2e88');
  rule.addColorStop(0.5, '#ff7a18');
  rule.addColorStop(1, '#ffc93c');
  ctx.fillStyle = rule;
  ctx.fillRect(x, y, w, ruleH);
  const text = caption.trim();
  const sub = subtitle.trim().toUpperCase();
  const maxW = w * 0.92;
  const subSize = Math.round(h * 0.13);
  const gap = Math.round(h * 0.06);
  // Height left for the caption lines after the rule, the subtitle and gaps.
  const maxLineH = h - ruleH - (sub ? subSize * 1.4 + gap : 0) - 8;
  const fitted = fitCaption(ctx, text, maxW, maxLineH);
  const blockH =
    fitted.lines.length * fitted.size * 1.06 +
    (sub ? subSize * 1.4 + gap : 0);
  let cy = y + ruleH + (h - ruleH - blockH) / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (fitted.lines.length) {
    ctx.font = captionFont(fitted.size);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#12081d';
    ctx.lineWidth = Math.max(3, fitted.size * 0.13);
    ctx.shadowColor = 'rgba(255, 46, 136, 0.55)';
    ctx.shadowBlur = fitted.size * 0.12;
    ctx.shadowOffsetY = fitted.size * 0.03;
    for (const line of fitted.lines) {
      cy += fitted.size * 1.06;
      ctx.strokeText(line, x + w / 2, cy);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(line, x + w / 2, cy);
    }
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  if (sub) {
    ctx.font = `700 ${subSize}px "Helvetica Neue", Arial, sans-serif`;
    try {
      ctx.letterSpacing = `${Math.round(subSize * 0.35)}px`;
    } catch {
      // Older browsers ignore letterSpacing; the subtitle still draws.
    }
    const subW = ctx.measureText(sub).width;
    const subY = cy + subSize * 1.4;
    ctx.fillStyle = GOLD;
    ctx.fillText(sub, x + w / 2, subY);
    // Gold rules flanking the subtitle, when the band has room for them.
    if (w > subW + 260) {
      const ruleY = subY - subSize * 0.35;
      ctx.strokeStyle = GOLD;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + w / 2 - subW / 2 - 100, ruleY);
      ctx.lineTo(x + w / 2 - subW / 2 - 24, ruleY);
      ctx.moveTo(x + w / 2 + subW / 2 + 24, ruleY);
      ctx.lineTo(x + w / 2 + subW / 2 + 100, ruleY);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    try {
      ctx.letterSpacing = '0px';
    } catch {
      // Ignore.
    }
  }
}

/**
 * Draws the whole cover onto `canvas` at its export size.
 * `state`: { size, panels: [{photo, zoom, ox, oy} x3], photos: {A, B, C},
 *   caption, subtitle, grade (0..1), neon (bool) }.
 */
export function drawCover(canvas, state) {
  const L = layout(state.size);
  canvas.width = L.W;
  canvas.height = L.H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = FRAME;
  ctx.fillRect(0, 0, L.W, L.H);
  for (let i = 0; i < 3; i += 1) {
    const panel = state.panels[i];
    drawPanel(ctx, L.panels[i], state.photos[panel.photo] ?? null, panel, state.grade, state.neon);
  }
  drawBand(ctx, L.band, state.caption, state.subtitle);
}
