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

export function buildFestivalCaption(event) {
  const scheduleLine = event.schedule?.length > 1
    ? event.schedule.map(s => `📅 ${longDate(s.startTime)} · ${time(s.startTime)} – ${time(s.endTime)}`)
    : [`📅 ${longDate(event.dateTime)}`];

  const notes = event.notes
    ? (event.schedule?.length ? stripScheduleFromText(event.notes) : event.notes).slice(0, 200)
    : '';

  const handles = [event.instagramHandle, event.facebookHandle].filter(Boolean);

  return [
    `🎪 ${event.title || event.artist}`,
    ...scheduleLine,
    `📍 ${event.venue}, ${event.neighbourhood}`,
    '',
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

export function buildWeekendCaption(events, handles = {}) {
  const lines       = events.map(e => `🎵 ${e.title || e.artist}`);
  const handleList  = Object.values(handles);
  return [
    '🗓 Free concerts this weekend in Toronto:',
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
