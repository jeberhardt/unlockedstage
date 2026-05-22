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
