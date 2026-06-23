'use client';

import { useState, useMemo } from 'react';
import type { Event } from '@/types/event';
import EventCard from './EventCard';

// ── Genre filter ────────────────────────────────────────────────────────────
const GENRES = ['all', 'jazz', 'indie', 'classical', 'folk', 'electronic', 'rb', 'pop', 'hiphop', 'other'] as const;

const GENRE_LABELS: Record<string, string> = {
  all: 'All', jazz: 'Jazz', indie: 'Indie', classical: 'Classical',
  folk: 'Folk', electronic: 'Electronic', rb: 'R&B', pop: 'Pop',
  hiphop: 'Hip-Hop', other: 'Other',
};

// ── Time filter ─────────────────────────────────────────────────────────────
const TIME_FILTERS = ['all', 'today', 'tomorrow', 'weekend', 'week'] as const;
type TimeFilter = (typeof TIME_FILTERS)[number];

const TIME_LABELS: Record<TimeFilter, string> = {
  all: 'All Upcoming',
  today: 'Today',
  tomorrow: 'Tomorrow',
  weekend: 'This Weekend',
  week: 'This Week',
};

const TZ = 'America/Toronto';

function torontoOffset(date: Date): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' })
    .formatToParts(date).find(p => p.type === 'timeZoneName')?.value ?? 'GMT-4';
  const h = parseInt(part.replace('GMT', ''), 10) || -4;
  return h <= 0 ? `-${String(Math.abs(h)).padStart(2, '0')}:00` : `+${String(h).padStart(2, '0')}:00`;
}

function dayBounds(utcY: number, utcM: number, utcD: number) {
  const ref = new Date(Date.UTC(utcY, utcM - 1, utcD, 12));
  const off = torontoOffset(ref);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${utcY}-${pad(utcM)}-${pad(utcD)}`;
  return {
    start: new Date(`${date}T00:00:00${off}`),
    end:   new Date(`${date}T23:59:59${off}`),
  };
}

function getTimeRange(filter: TimeFilter, now: Date): { start: Date; end: Date } | null {
  if (filter === 'all') return null;

  const todayStr = now.toLocaleDateString('en-CA', { timeZone: TZ });
  const [y, mo, d] = todayStr.split('-').map(Number);

  if (filter === 'today') return dayBounds(y, mo, d);

  if (filter === 'tomorrow') {
    const t = new Date(Date.UTC(y, mo - 1, d + 1));
    return dayBounds(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }

  const shortDay = now.toLocaleDateString('en-CA', { weekday: 'short', timeZone: TZ });
  const dayNum = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[shortDay] ?? 0;

  if (filter === 'weekend') {
    // Fri–Sun of the current or upcoming weekend
    const toFri = dayNum === 5 ? 0 : dayNum === 6 ? -1 : dayNum === 0 ? -2 : 5 - dayNum;
    const fri = new Date(Date.UTC(y, mo - 1, d + toFri));
    const sun = new Date(Date.UTC(y, mo - 1, d + toFri + 2));
    return {
      start: dayBounds(fri.getUTCFullYear(), fri.getUTCMonth() + 1, fri.getUTCDate()).start,
      end:   dayBounds(sun.getUTCFullYear(), sun.getUTCMonth() + 1, sun.getUTCDate()).end,
    };
  }

  if (filter === 'week') {
    // Today through end of Sunday
    const toSun = dayNum === 0 ? 0 : 7 - dayNum;
    const sun = new Date(Date.UTC(y, mo - 1, d + toSun));
    return {
      start: now,
      end:   dayBounds(sun.getUTCFullYear(), sun.getUTCMonth() + 1, sun.getUTCDate()).end,
    };
  }

  return null;
}

function monthKey(iso: string) {
  return new Date(iso).toLocaleString('en-CA', { month: 'long', year: 'numeric' });
}

// ── Shared button style ─────────────────────────────────────────────────────
function filterBtn(active: boolean) {
  return `cursor-pointer transition-all duration-[180ms] border rounded-full px-[0.85rem] py-[0.3rem] ${
    active
      ? 'bg-accent border-accent text-white'
      : 'bg-transparent border-border text-muted hover:border-accent hover:text-accent'
  }`;
}

// ── Component ───────────────────────────────────────────────────────────────
export default function EventsClient({ events }: { events: Event[] }) {
  const [timeFilter, setTimeFilter]   = useState<TimeFilter>('all');
  const [genreFilter, setGenreFilter] = useState('all');

  const filtered = useMemo(() => {
    const now   = new Date();
    const range = getTimeRange(timeFilter, now);

    return events.filter(e => {
      if (range) {
        const dt = new Date(e.dateTime);
        if (dt < range.start || dt > range.end) return false;
      }
      if (genreFilter !== 'all' && e.genre !== genreFilter) return false;
      return true;
    });
  }, [events, timeFilter, genreFilter]);

  const groups = new Map<string, Event[]>();
  filtered.forEach(e => {
    const key = monthKey(e.dateTime);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  });

  return (
    <>
      {/* Sticky filter bar */}
      <div className="sticky top-0 z-10 bg-cream border-b border-border px-[clamp(1.5rem,5vw,4rem)] pt-[1rem] pb-[0.85rem] flex flex-col gap-[0.65rem]">
        {/* Time filters — prominent */}
        <div className="flex items-center gap-2 flex-wrap">
          {TIME_FILTERS.map(tf => (
            <button
              key={tf}
              onClick={() => setTimeFilter(tf)}
              className={`font-sans font-semibold text-[0.82rem] tracking-[0.01em] ${filterBtn(timeFilter === tf)}`}
            >
              {TIME_LABELS[tf]}
            </button>
          ))}
        </div>

        {/* Genre filters — secondary */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[0.62rem] tracking-[0.1em] uppercase text-muted mr-1">
            Genre:
          </span>
          {GENRES.map(genre => (
            <button
              key={genre}
              onClick={() => setGenreFilter(genre)}
              className={`font-mono text-[0.65rem] tracking-[0.06em] uppercase ${filterBtn(genreFilter === genre)}`}
            >
              {GENRE_LABELS[genre]}
            </button>
          ))}
        </div>
      </div>

      {/* Events section */}
      <section className="px-[clamp(1.5rem,5vw,4rem)] pt-[clamp(1rem,2vw,1.5rem)] pb-[clamp(2rem,4vw,3rem)] flex-1">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-sans font-bold text-[1.5rem] tracking-[-0.01em]">
            {timeFilter === 'all' ? 'Upcoming Events' : TIME_LABELS[timeFilter]}
          </h2>
          <span className="font-mono text-[0.7rem] text-muted tracking-[0.06em]">
            {filtered.length} event{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-sans italic text-[1.1rem] text-muted">
              No events for this filter — check back soon.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {Array.from(groups.entries()).map(([month, monthEvents]) => (
              <div key={month}>
                <div className="flex items-center gap-4 pb-[0.85rem]">
                  <span className="font-mono text-[0.7rem] tracking-[0.12em] uppercase text-muted whitespace-nowrap">
                    {month}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-[1.5px] border-[1.5px] border-border">
                  {monthEvents.map((event, i) => (
                    <EventCard key={event._id} event={event} index={i} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
