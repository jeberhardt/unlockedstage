// lib/render-image.js
// Renders an event to a PNG Buffer using node-canvas.
// The drawing logic mirrors the browser canvas widget so posts look identical.

import { createCanvas } from '@napi-rs/canvas';
import { VALID_GENRES } from './config.js';

// Optional: register a custom font if you have one locally
// registerFont('./assets/BebasNeue-Regular.ttf', { family: 'Bebas Neue' });

const PALETTES = {
  bg:     '#0A1628',
  accent: '#FF2D2D',
};

const GENRE_LABELS = {
  jazz: 'Jazz', indie: 'Indie', classical: 'Classical', folk: 'Folk',
  electronic: 'Electronic', rb: 'R&B', pop: 'Pop', hiphop: 'Hip-Hop', other: 'Live Music',
};

function formatDate(dtStr) {
  const d    = new Date(dtStr);
  const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const mons = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  let h = d.getHours(), ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${days[d.getDay()]} ${d.getDate()} ${mons[d.getMonth()]} · ${h}:${m} ${ap}`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * @param {object} event  - Sanity event document
 * @param {'square'|'story'} format
 * @returns {Buffer} PNG buffer
 */
export function renderEventImage(event, format = 'square') {
  const W = 1080;
  const H = format === 'story' ? 1350 : 1080;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');
  const acc    = PALETTES.accent;
  const pad    = W * 0.09;

  // Background
  ctx.fillStyle = PALETTES.bg;
  ctx.fillRect(0, 0, W, H);

  // Decorative concentric circles (top-right)
  ctx.save();
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(W * 0.85, H * 0.15, 80 + i * 80, 0, Math.PI * 2);
    ctx.strokeStyle = acc;
    ctx.lineWidth   = 1.5;
    ctx.stroke();
  }
  ctx.restore();

  // Decorative circle (bottom-left)
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  ctx.arc(W * 0.1, H * 0.85, 320, 0, Math.PI * 2);
  ctx.strokeStyle = acc;
  ctx.lineWidth   = 1;
  ctx.stroke();
  ctx.restore();

  // "FREE · GENRE" top-left line
  const topY    = pad + W * 0.035;
  const topSize = Math.round(W * 0.032);
  ctx.font      = `bold ${topSize}px sans-serif`;
  const freeLbl = 'FREE';
  const freeTW  = ctx.measureText(freeLbl).width;
  const freePad = W * 0.018;
  const freePh  = topSize * 1.5;
  roundRect(ctx, pad, topY - topSize, freeTW + freePad * 2, freePh, 4);
  ctx.fillStyle = acc;
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(freeLbl, pad + freePad, topY);
  const sep     = '  ·  ';
  ctx.font      = `500 ${topSize}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(sep, pad + freeTW + freePad * 2, topY);
  const sepW    = ctx.measureText(sep).width;
  ctx.fillStyle = acc;
  ctx.fillText((GENRE_LABELS[event.genre] ?? 'Live Music').toUpperCase(), pad + freeTW + freePad * 2 + sepW, topY);

  // Title (primary) or artist name if no title
  const name         = event.title || event.artist || 'Unnamed Event';
  const nameFontSize = name.length > 22 ? Math.round(W * 0.082) : Math.round(W * 0.108);
  ctx.font           = `bold ${nameFontSize}px sans-serif`;
  const maxW         = W - pad * 2;
  const words        = name.split(' ');
  const lines        = [];
  let   line         = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);

  const lineH  = nameFontSize * 1.05;
  const totalH = lines.length * lineH;
  const nameY  = H * 0.42 - totalH / 2;
  ctx.fillStyle = '#FFFFFF';
  lines.forEach((l, i) => ctx.fillText(l, pad, nameY + i * lineH));

  // Artist name (below title, if both present)
  let titleBlockH = 0;
  if (event.title && event.artist && event.title !== event.artist) {
    const artistFontSize = Math.round(W * 0.038);
    ctx.font      = `500 ${artistFontSize}px sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    const artistText = event.artist.length > 50 ? event.artist.slice(0, 47) + '…' : event.artist;
    ctx.fillText(artistText, pad, nameY + totalH + artistFontSize * 1.2);
    titleBlockH = artistFontSize * 1.8;
  }

  // Divider
  const divY = nameY + totalH + titleBlockH + W * 0.04;
  ctx.fillStyle   = acc;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(pad, divY, W - pad * 2, 1.5);
  ctx.globalAlpha = 1;

  // Date & venue
  const infoY = divY + W * 0.06;
  ctx.font      = `500 ${Math.round(W * 0.036)}px sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(formatDate(event.dateTime), pad, infoY);

  ctx.font      = `${Math.round(W * 0.03)}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  const venueText = (event.venue ?? '').length > 45
    ? (event.venue ?? '').slice(0, 42) + '…'
    : (event.venue ?? '');
  ctx.fillText(venueText, pad, infoY + W * 0.052);

  // Watermark (top-right, aligned with FREE badge)
  ctx.font      = `${topSize}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.textAlign = 'right';
  ctx.fillText('unlockedstage.ca', W - pad, topY);
  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
}

/**
 * @param {object[]} events      - array of Sanity event documents for this slide
 * @param {'square'|'story'} format
 * @param {number} page          - 1-based page index
 * @param {number} totalPages    - total number of slides in the carousel
 * @param {number} maxPerPage    - max events on any slide (used to fix font size across all slides)
 * @param {string} dateLabel     - formatted weekend date range, e.g. "JUN 6 – 8"
 * @returns {Buffer} PNG buffer
 */
export function renderWeekendImage(events, format = 'square', page = 1, totalPages = 1, maxPerPage = null, dateLabel = '') {
  const W = 1080;
  const H = format === 'story' ? 1350 : 1080;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');
  const acc    = PALETTES.accent;
  const pad    = W * 0.09;

  // Background
  ctx.fillStyle = PALETTES.bg;
  ctx.fillRect(0, 0, W, H);

  // Decorative concentric circles (top-right)
  ctx.save();
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(W * 0.85, H * 0.15, 80 + i * 80, 0, Math.PI * 2);
    ctx.strokeStyle = acc;
    ctx.lineWidth   = 1.5;
    ctx.stroke();
  }
  ctx.restore();

  // Decorative circle (bottom-left)
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  ctx.arc(W * 0.1, H * 0.85, 320, 0, Math.PI * 2);
  ctx.strokeStyle = acc;
  ctx.lineWidth   = 1;
  ctx.stroke();
  ctx.restore();

  // "TORONTO" label — top-left plain text
  const topSize = Math.round(W * 0.032);
  const topY    = pad + W * 0.035;
  ctx.font      = `500 ${topSize}px sans-serif`;
  ctx.fillStyle = acc;
  ctx.fillText('TORONTO', pad, topY);

  // "FREE" diagonal ribbon — top-right corner
  const ribbonDist = W * 0.28; // how far along each edge the ribbon reaches
  const ribbonH    = Math.round(W * 0.10);
  const ribbonMx   = W - ribbonDist * 0.5;
  const ribbonMy   = ribbonDist * 0.5;
  ctx.save();
  ctx.translate(ribbonMx, ribbonMy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = acc;
  ctx.fillRect(-ribbonDist, -ribbonH / 2, ribbonDist * 2, ribbonH);
  ctx.font          = `bold ${Math.round(ribbonH * 0.55)}px sans-serif`;
  ctx.fillStyle     = '#fff';
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'middle';
  ctx.fillText('FREE', 0, 0);
  ctx.textBaseline  = 'alphabetic';
  ctx.textAlign     = 'left';
  ctx.restore();

  // Hero: "THIS WEEKEND"
  const heroText     = 'THIS WEEKEND';
  const heroFontSize = Math.round(W * 0.108);
  ctx.font           = `bold ${heroFontSize}px sans-serif`;
  const heroY        = H * 0.28;
  ctx.fillStyle      = '#FFFFFF';
  ctx.fillText(heroText, pad, heroY);

  // Date label: e.g. "JUN 6 – 8" — tucked close under the title
  const dateFontSize = Math.round(W * 0.042);
  ctx.font           = `500 ${dateFontSize}px sans-serif`;
  ctx.fillStyle      = acc;
  const dateY        = heroY + heroFontSize * 0.88;
  ctx.fillText(dateLabel, pad, dateY);

  const divY = dateY + dateFontSize * 1.3 + W * 0.035;

  // Event list — use maxPerPage (if provided) so all slides share the same font size
  const sizeRef      = maxPerPage ?? events.length;
  const listFontSize = sizeRef <= 4 ? Math.round(W * 0.052)
    : sizeRef <= 6 ? Math.round(W * 0.044)
    : Math.round(W * 0.036);
  const lineH   = listFontSize * 1.45;
  const listTop = divY - W * 0.04;

  ctx.font = `500 ${listFontSize}px sans-serif`;

  const rowMargin  = pad * 0.6;
  const rowPad     = pad * 0.25;
  const maxTextWidth = W - rowMargin * 2 - rowPad * 2;

  ctx.textBaseline = 'middle';
  events.forEach((event, i) => {
    const name = event.title || event.artist || 'Unknown Event';
    let displayName = name;
    if (ctx.measureText(name).width > maxTextWidth) {
      while (displayName.length > 0 && ctx.measureText(displayName + '…').width > maxTextWidth) {
        displayName = displayName.slice(0, -1);
      }
      displayName += '…';
    }
    const rowTop   = listTop + i * lineH;
    const rowCentY = rowTop + lineH / 2;

    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,45,45,0.13)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(rowMargin, rowTop, W - rowMargin * 2, lineH);

    ctx.font      = `500 ${listFontSize}px sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(displayName, rowMargin + rowPad, rowCentY);
  });
  ctx.textBaseline = 'alphabetic';

  // Watermark — bottom-right
  ctx.font      = `${topSize}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.textAlign = 'right';
  ctx.fillText('unlockedstage.ca', W - pad, H - pad * 0.6);
  ctx.textAlign = 'left';

  // Page indicator — bottom-left (only for multi-slide carousels)
  if (totalPages > 1) {
    ctx.font      = `${topSize}px sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText(`${page} / ${totalPages}`, pad, H - pad * 0.6);
  }

  return canvas.toBuffer('image/png');
}
