const TZ = 'America/Toronto';

const genreMap = {
  jazz: '#jazz', indie: '#indie', classical: '#classical', folk: '#folk',
  electronic: '#electronic', rb: '#rnb', pop: '#pop', hiphop: '#hiphop', other: '#livemusic',
};

function hashtag(genre) {
  return genreMap[genre] ?? '#livemusic';
}

function longDate(iso) {
  return new Date(iso).toLocaleDateString('en-CA', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ,
  });
}

function shortDate(iso) {
  return new Date(iso).toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ,
  });
}

function time(iso) {
  return new Date(iso).toLocaleTimeString('en-CA', {
    hour: 'numeric', minute: '2-digit', timeZone: TZ,
  });
}

function shortTime(dtStr) {
  const d  = new Date(dtStr);
  let h    = d.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const m = d.getMinutes();
  return m === 0 ? `${h} ${ap}` : `${h}:${String(m).padStart(2,'0')} ${ap}`;
}

function shortTimeRange(startStr, endStr) {
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

function link(event) {
  return event.externalLink ? `🎟️ ${event.externalLink}` : '🎟️ unlockedstage.ca';
}

// ---------------------------------------------------------------------------

export function buildIndividualCaption(event) {
  return [
    `🎵 ${event.title || event.artist}`,
    event.title ? event.artist : '',
    `📅 ${longDate(event.dateTime)} at ${time(event.dateTime)}`,
    `📍 ${event.venue}, ${event.neighbourhood}`,
    '',
    event.notes ? event.notes.slice(0, 200) : '',
    '',
    `${hashtag(event.genre)} #Toronto #UnlockedStage #LiveMusic`,
    '',
    link(event),
  ].filter(l => l !== undefined).join('\n').trim();
}

function stripScheduleFromText(text) {
  // Remove "Weekday MonthName Day# (time–time)" clauses that duplicate the structured schedule
  return text
    .replace(/\b(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\s+\w+\s+\d+\s*\([^)]*\)/gi, '')
    .replace(/\s*,\s*,/g, ',')
    .replace(/\s*,\s*\./g, '.')
    .replace(/\.\.+/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function buildFestivalCaption(event, performers = [], window = null) {
  const scheduleLine = event.schedule?.length
    ? event.schedule.map(s => `📅 ${longDate(s.startTime)} · ${time(s.startTime)} – ${time(s.endTime)}`)
    : [`📅 ${longDate(event.dateTime)}`];

  const notes = event.notes
    ? (event.schedule?.length
        ? stripScheduleFromText(event.notes.split('\n\n')[0])
        : event.notes.split('\n\n')[0]
      ).slice(0, 200)
    : '';

  const handles = [event.instagramHandle, event.facebookHandle].filter(Boolean);

  const scheduleByDate = new Map();
  for (const s of (event.schedule ?? [])) {
    scheduleByDate.set(new Date(s.startTime).toDateString(), s);
  }

  const allSameDay = performers.length > 0 && performers.every(p =>
    new Date(p.dateTime).toDateString() === new Date(performers[0].dateTime).toDateString()
  );

  const performerLines = performers.map(p => {
    const d        = new Date(p.dateTime);
    const days     = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const mons     = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const t = shortTime(p.dateTime);
    const prefix   = allSameDay ? t : `${days[d.getDay()]} ${mons[d.getMonth()]} ${d.getDate()} · ${t}`;
    return `🎵 ${prefix} — ${p.artist}`;
  });

  const sharedDateLine = allSameDay && performers.length ? (() => {
    const d    = new Date(performers[0].dateTime);
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const mons = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${days[d.getDay()]} ${mons[d.getMonth()]} ${d.getDate()}`;
  })() : null;

  const windowLabels   = { today: 'Performing today:', tomorrow: 'Performing tomorrow:', weekend: 'Performing this weekend:', week: 'Performing this week:', month: 'Performing this month:' };
  const windowNoPerf   = { today: 'Today', tomorrow: 'Tomorrow', weekend: 'This Weekend', week: 'This Week', month: 'This Month' };
  const windowLabel    = window ? (performerLines.length ? (windowLabels[window] ?? `Performing ${window}:`) : (windowNoPerf[window] ?? window)) : null;

  return [
    `🎪 ${event.title || event.artist}`,
    `📍 ${event.venue}, ${event.neighbourhood}`,
    ...(windowLabel && !performerLines.length ? [windowLabel] : []),
    ...(performerLines.length ? [] : scheduleLine),
    '',
    ...(performerLines.length ? [
      ...(windowLabel ? [windowLabel] : []),
      ...(sharedDateLine ? [sharedDateLine] : []),
      ...performerLines, '',
    ] : []),
    notes,
    '',
    ...(handles.length ? [handles.join(' '), ''] : []),
    `#festival ${hashtag(event.genre)} #Toronto #UnlockedStage #LiveMusic`,
    '',
    link(event),
  ].filter(l => l !== undefined).join('\n').trim();
}

export function buildSeriesCaption(event) {
  return [
    `🎶 ${event.title || event.artist}`,
    `📅 ${longDate(event.dateTime)} at ${time(event.dateTime)}`,
    `📍 ${event.venue}, ${event.neighbourhood}`,
    '',
    event.notes ? event.notes.slice(0, 200) : '',
    '',
    `${hashtag(event.genre)} #Toronto #UnlockedStage #LiveMusic`,
    '',
    link(event),
  ].filter(l => l !== undefined).join('\n').trim();
}

function buildListingCaption(header, events) {
  const lines = events.map(e =>
    `🎵 ${e.title || e.artist}\n   ${shortDate(e.dateTime)} · ${e.venue}, ${e.neighbourhood}`
  );
  return [
    header,
    '',
    ...lines,
    '',
    '#Toronto #UnlockedStage #LiveMusic',
    '',
    '🎟️ unlockedstage.ca',
  ].join('\n').trim();
}

export function buildThisWeekCaption(events) {
  return buildListingCaption('🗓 Free concerts in Toronto this week:', events);
}

export function buildNextWeekCaption(events) {
  return buildListingCaption('🗓 Free concerts in Toronto next week:', events);
}

export function buildThisMonthCaption(events) {
  const month = new Date(events[0].dateTime).toLocaleString('en-CA', { month: 'long', timeZone: TZ });
  return buildListingCaption(`🗓 Free concerts in Toronto this ${month}:`, events);
}

export function buildNextMonthCaption(events) {
  const month = new Date(events[0].dateTime).toLocaleString('en-CA', { month: 'long', timeZone: TZ });
  return buildListingCaption(`🗓 Free concerts coming up in ${month}:`, events);
}

export function buildWeekendCaption(events, handles = {}, window = 'weekend') {
  const headers = {
    today:    '🗓 Free events in Toronto today:',
    tomorrow: '🗓 Free events in Toronto tomorrow:',
    weekend:  '🗓 Free concerts this weekend in Toronto:',
    week:     '🗓 Free events in Toronto this week:',
    month:    '🗓 Free events in Toronto this month:',
  };
  const header     = headers[window] ?? '🗓 Free events in Toronto:';
  const lines      = events.map(e => `🎵 ${e.title || e.artist}`);
  const handleList = Object.values(handles);
  return [
    header,
    '',
    ...lines,
    '',
    'Check our other posts or visit unlockedstage.ca for details on each event and individual performances.',
    '',
    ...(handleList.length ? [handleList.join(' '), ''] : []),
    '#Toronto #UnlockedStage #LiveMusic #FreeConcerts',
    '',
    '🎟️ unlockedstage.ca',
  ].join('\n').trim();
}
