// lib/render-image.js
// Renders an event to a PNG Buffer using node-canvas.
// The drawing logic mirrors the browser canvas widget so posts look identical.

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { join, dirname }             from 'node:path';
import { fileURLToPath }             from 'node:url';
import { VALID_GENRES }              from './config.js';

const __dir = dirname(fileURLToPath(import.meta.url));
GlobalFonts.registerFromPath(join(__dir, '../assets/Inter-Regular.ttf'),  'Inter');
GlobalFonts.registerFromPath(join(__dir, '../assets/Inter-Medium.ttf'),   'Inter');
GlobalFonts.registerFromPath(join(__dir, '../assets/Inter-SemiBold.ttf'), 'Inter');
GlobalFonts.registerFromPath(join(__dir, '../assets/Inter-Bold.ttf'),     'Inter');

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

function formatTimeOnly(dtStr) {
  const d  = new Date(dtStr);
  let h    = d.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m} ${ap}`;
}

function formatTimeRange(startStr, endStr) {
  const fmt = (dtStr) => {
    const d  = new Date(dtStr);
    let h    = d.getHours();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const m = d.getMinutes();
    return { h, m, ap, str: m === 0 ? `${h}` : `${h}:${String(m).padStart(2,'0')}` };
  };
  const s = fmt(startStr);
  const e = fmt(endStr);
  if (s.ap === e.ap) return `${s.str} - ${e.str} ${e.ap}`;
  return `${s.str} ${s.ap} - ${e.str} ${e.ap}`;
}

function formatScheduleEntry(entry) {
  const d    = new Date(entry.startTime);
  const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const mons = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const day  = `${days[d.getDay()]} ${d.getDate()} ${mons[d.getMonth()]}`;
  return `${day} · ${formatTimeRange(entry.startTime, entry.endTime)}`;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, currentY);
  return currentY; // returns y of last line drawn
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
export function renderEventImage(event, format = 'square', performers = [], window = null) {
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

  // "TORONTO · GENRE" top-left
  const topSize = Math.round(W * 0.032);
  const topY    = pad * 0.75;
  ctx.font      = `500 ${topSize}px Inter`;
  ctx.fillStyle = acc;
  ctx.fillText('TORONTO', pad, topY);
  const sep  = '  ·  ';
  const toW  = ctx.measureText('TORONTO').width;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText(sep, pad + toW, topY);
  ctx.fillStyle = acc;
  ctx.fillText((GENRE_LABELS[event.genre] ?? 'Live Music').toUpperCase(), pad + toW + ctx.measureText(sep).width, topY);

  // Window label badge (e.g. "THIS WEEKEND")
  const windowLabels = { today: 'TODAY', tomorrow: 'TOMORROW', weekend: 'THIS WEEKEND', week: 'THIS WEEK', month: 'THIS MONTH' };
  if (window && windowLabels[window]) {
    const label      = windowLabels[window];
    const badgeFontSize = topSize;
    ctx.font         = `600 ${badgeFontSize}px Inter`;
    const labelW     = ctx.measureText(label).width;
    const badgePadX  = badgeFontSize * 0.6;
    const badgePadY  = badgeFontSize * 0.3;
    const badgeX     = pad - badgePadX;
    const badgeY     = topY + topSize * 0.9;
    const badgeH     = badgeFontSize + badgePadY * 2;
    const radius     = badgeH / 2;
    // Pill background
    ctx.fillStyle = acc;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, labelW + badgePadX * 2, badgeH, radius);
    ctx.fill();
    // Label text
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, pad, badgeY + badgePadY + badgeFontSize * 0.85);
  }

  // "FREE" diagonal ribbon — top-right corner
  const ribbonDist = W * 0.28;
  const ribbonH    = Math.round(W * 0.10);
  const ribbonMx   = W - ribbonDist * 0.5;
  const ribbonMy   = ribbonDist * 0.5;
  ctx.save();
  ctx.translate(ribbonMx, ribbonMy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = acc;
  ctx.fillRect(-ribbonDist, -ribbonH / 2, ribbonDist * 2, ribbonH);
  ctx.font         = `bold ${Math.round(ribbonH * 0.55)}px Inter`;
  ctx.fillStyle    = '#fff';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FREE', 0, 0);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign    = 'left';
  ctx.restore();

  // Title (primary) or artist name if no title — strip year references
  const name         = (event.title || event.artist || 'Unnamed Event').replace(/\b(19|20)\d{2}\b/g, '').replace(/\s{2,}/g, ' ').trim();
  const nameFontSize = name.length > 22 ? Math.round(W * 0.082) : Math.round(W * 0.108);
  ctx.font           = `bold ${nameFontSize}px Inter`;
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

  const lineH      = nameFontSize * 1.05;
  const nameY      = W * 0.185 + nameFontSize * 0.75;
  const lastTitleY = nameY + (lines.length - 1) * lineH;
  ctx.fillStyle = '#FFFFFF';
  lines.forEach((l, i) => ctx.fillText(l, pad, nameY + i * lineH));

  // Artist subtitle (below title, only when no performer list)
  let titleBlockH = 0;
  if (!performers.length && event.title && event.artist && event.title !== event.artist) {
    const artistFontSize = Math.round(W * 0.038);
    const artistLineH    = artistFontSize * 1.3;
    ctx.font      = `500 ${artistFontSize}px Inter`;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    const artistY = lastTitleY + nameFontSize * 0.35 + artistFontSize;
    const lastY   = wrapText(ctx, event.artist, pad, artistY, maxW, artistLineH);
    titleBlockH   = lastY - lastTitleY + artistFontSize * 0.5;
  }

  const listTop = lastTitleY + nameFontSize * 0.3 + titleBlockH + W * 0.025;

  if (performers.length) {
    let performerTop = listTop;

    // Performer rows — single line (time · artist) when all on same day, two lines otherwise
    const dateFontSize   = performers.length <= 4 ? Math.round(W * 0.034) : Math.round(W * 0.028);
    const artistFontSize = performers.length <= 4 ? Math.round(W * 0.042) : Math.round(W * 0.034);
    const innerPad       = dateFontSize * 0.7;
    const rowMargin      = pad * 0.6;
    const artistMaxW     = W - pad * 2;

    // Build a date→schedule entry map for end times
    const scheduleByDate = new Map();
    for (const s of (event.schedule ?? [])) {
      scheduleByDate.set(new Date(s.startTime).toDateString(), s);
    }

    const allSameDay = performers.every(p =>
      new Date(p.dateTime).toDateString() === new Date(performers[0].dateTime).toDateString()
    );

    const venueFontSize = Math.round(W * 0.03);

    if (allSameDay) {
      const d0   = new Date(performers[0].dateTime);
      const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const mons = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const dateLabel = `${days[d0.getDay()]} ${d0.getDate()} ${mons[d0.getMonth()]}`.toUpperCase();
      const labelSize = Math.round(W * 0.038);
      ctx.font      = `600 ${labelSize}px Inter`;
      ctx.fillStyle = acc;
      ctx.fillText(dateLabel, pad, performerTop + labelSize);
      performerTop += labelSize * 1.5;

      // Venue immediately below the date
      ctx.font      = `${venueFontSize}px Inter`;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      const venueText  = [event.venue, event.neighbourhood].filter(Boolean).join(', ');
      const venueLastY = wrapText(ctx, venueText, pad, performerTop + venueFontSize, maxW, venueFontSize * 1.3);
      performerTop = venueLastY + venueFontSize * 0.8;
    }

    const singleLineH = innerPad + artistFontSize * 1.2 + innerPad;
    const twoLineH    = innerPad + dateFontSize * 1.1 + artistFontSize * 1.2 + innerPad;
    const rowH        = allSameDay ? singleLineH : twoLineH;

    performers.forEach((p, i) => {
      const rowTop = performerTop + i * rowH;

      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,45,45,0.13)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(rowMargin, rowTop, W - rowMargin * 2, rowH);

      const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
      const mons = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
      const d       = new Date(p.dateTime);
      const timeStr = formatTimeOnly(p.dateTime);

      if (allSameDay) {
        // Single line: "2 PM  Artist Name" — time in accent, artist in white
        const lineY = rowTop + innerPad + artistFontSize;
        ctx.font      = `500 ${dateFontSize}px Inter`;
        ctx.fillStyle = acc;
        ctx.fillText(timeStr, pad, lineY);
        const timeW = ctx.measureText(timeStr + '  ').width;

        ctx.font      = `500 ${artistFontSize}px Inter`;
        ctx.fillStyle = '#FFFFFF';
        let artistName = p.artist;
        const nameMaxW = artistMaxW - timeW;
        if (ctx.measureText(artistName).width > nameMaxW) {
          while (artistName.length > 0 && ctx.measureText(artistName + '…').width > nameMaxW) {
            artistName = artistName.slice(0, -1);
          }
          artistName += '…';
        }
        ctx.fillText(artistName, pad + timeW, lineY);
      } else {
        // Two lines: date/time on top, artist below
        const dayLabel = `${days[d.getDay()]} ${d.getDate()} ${mons[d.getMonth()]} · ${timeStr}`;
        const line1Y   = rowTop + innerPad + dateFontSize;
        ctx.font      = `500 ${dateFontSize}px Inter`;
        ctx.fillStyle = acc;
        ctx.fillText(dayLabel, pad, line1Y);

        const line2Y = line1Y + dateFontSize * 0.3 + artistFontSize * 1.1;
        ctx.font      = `500 ${artistFontSize}px Inter`;
        ctx.fillStyle = '#FFFFFF';
        let artistName = p.artist;
        if (ctx.measureText(artistName).width > artistMaxW) {
          while (artistName.length > 0 && ctx.measureText(artistName + '…').width > artistMaxW) {
            artistName = artistName.slice(0, -1);
          }
          artistName += '…';
        }
        ctx.fillText(artistName, pad, line2Y);
      }
    });

    // Venue below the list (multi-day only — single-day shows venue above rows)
    if (!allSameDay) {
      ctx.font      = `${venueFontSize}px Inter`;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      const venueText = [event.venue, event.neighbourhood].filter(Boolean).join(', ');
      wrapText(ctx, venueText, pad, performerTop + performers.length * rowH + W * 0.03, maxW, venueFontSize * 1.3);
    }
  } else {
    // No performers — show schedule dates then venue
    const dateFontSize = Math.round(W * 0.036);
    const dateLineH    = dateFontSize * 1.45;
    const dateLines    = event.schedule?.length
      ? event.schedule.map(formatScheduleEntry)
      : [formatDate(event.dateTime)];

    ctx.font      = `500 ${dateFontSize}px Inter`;
    ctx.fillStyle = acc;
    dateLines.forEach((dl, i) => ctx.fillText(dl, pad, listTop + i * dateLineH));

    const venueFontSize = Math.round(W * 0.03);
    ctx.font      = `${venueFontSize}px Inter`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    const venueText = [event.venue, event.neighbourhood].filter(Boolean).join(', ');
    const venueLastY = wrapText(ctx, venueText, pad, listTop + dateLines.length * dateLineH, maxW, venueFontSize * 1.3);

    if (event.notes) {
      const notesFontSize = Math.round(W * 0.032);
      ctx.font      = `${notesFontSize}px Inter`;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      wrapText(ctx, event.notes.split('\n\n')[0], pad, venueLastY + notesFontSize * 1.6, maxW, notesFontSize * 1.5);
    }
  }

  // Watermark — bottom-right
  ctx.font      = `${topSize}px Inter`;
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.textAlign = 'right';
  ctx.fillText('unlockedstage.ca', W - pad, H - pad * 0.6);
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
export function renderWeekendImage(events, format = 'square', page = 1, totalPages = 1, maxPerPage = null, dateLabel = '', window = 'weekend') {
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
  ctx.font      = `500 ${topSize}px Inter`;
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
  ctx.font          = `bold ${Math.round(ribbonH * 0.55)}px Inter`;
  ctx.fillStyle     = '#fff';
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'middle';
  ctx.fillText('FREE', 0, 0);
  ctx.textBaseline  = 'alphabetic';
  ctx.textAlign     = 'left';
  ctx.restore();

  // Hero title based on window
  const heroLabels = { today: 'TODAY', tomorrow: 'TOMORROW', weekend: 'THIS WEEKEND', week: 'THIS WEEK', month: 'THIS MONTH' };
  const heroText     = heroLabels[window] ?? 'THIS WEEKEND';
  const heroFontSize = Math.round(W * 0.108);
  ctx.font           = `bold ${heroFontSize}px Inter`;
  const heroY        = H * 0.28;
  ctx.fillStyle      = '#FFFFFF';
  ctx.fillText(heroText, pad, heroY);

  // Date label: e.g. "JUN 6 – 8" — tucked close under the title
  const dateFontSize = Math.round(W * 0.042);
  ctx.font           = `500 ${dateFontSize}px Inter`;
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

  ctx.font = `500 ${listFontSize}px Inter`;

  const rowMargin  = pad;
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

    ctx.font      = `500 ${listFontSize}px Inter`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(displayName, rowMargin + rowPad, rowCentY);
  });
  ctx.textBaseline = 'alphabetic';

  // Watermark — bottom-right
  ctx.font      = `${topSize}px Inter`;
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.textAlign = 'right';
  ctx.fillText('unlockedstage.ca', W - pad, H - pad * 0.6);
  ctx.textAlign = 'left';

  // Page indicator — bottom-left (only for multi-slide carousels)
  if (totalPages > 1) {
    ctx.font      = `${topSize}px Inter`;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText(`${page} / ${totalPages}`, pad, H - pad * 0.6);
  }

  return canvas.toBuffer('image/png');
}
