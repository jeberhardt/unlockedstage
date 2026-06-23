'use client';

import { useState } from 'react';
import type { Event } from '@/types/event';
import EventCard from './EventCard';

const GENRES = ['all', 'jazz', 'indie', 'classical', 'folk', 'electronic', 'rb', 'pop', 'hiphop', 'other'] as const;

const GENRE_LABELS: Record<string, string> = {
  all: 'All',
  jazz: 'Jazz',
  indie: 'Indie',
  classical: 'Classical',
  folk: 'Folk',
  electronic: 'Electronic',
  rb: 'R&B',
  pop: 'Pop',
  hiphop: 'Hip-Hop',
  other: 'Other',
};

function monthKey(iso: string) {
  return new Date(iso).toLocaleString('en-CA', { month: 'long', year: 'numeric' });
}

export default function EventsClient({ events }: { events: Event[] }) {
  const [activeFilter, setActiveFilter] = useState('all');

  const filtered =
    activeFilter === 'all' ? events : events.filter((e) => e.genre === activeFilter);

  const groups = new Map<string, Event[]>();
  filtered.forEach((e) => {
    const key = monthKey(e.dateTime);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  });

  return (
    <>
      {/* Sticky filter bar */}
      <div className="sticky top-0 z-10 bg-cream border-b border-border px-[clamp(1.5rem,5vw,4rem)] py-[1.1rem] flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[0.68rem] tracking-[0.1em] uppercase text-muted mr-1">
          Genre:
        </span>
        {GENRES.map((genre) => (
          <button
            key={genre}
            onClick={() => setActiveFilter(genre)}
            className={`font-mono text-[0.7rem] tracking-[0.06em] uppercase border rounded-full px-[0.85rem] py-[0.3rem] cursor-pointer transition-all duration-[180ms] ${
              activeFilter === genre
                ? 'bg-ink border-ink text-paper'
                : 'bg-transparent border-border text-muted hover:bg-ink hover:border-ink hover:text-paper'
            }`}
          >
            {GENRE_LABELS[genre]}
          </button>
        ))}
      </div>

      {/* Events section */}
      <section className="px-[clamp(1.5rem,5vw,4rem)] py-[clamp(2rem,4vw,3rem)] flex-1">
        <div className="flex items-baseline justify-between mb-7">
          <h2 className="font-sans font-bold text-[1.5rem] tracking-[-0.01em]">
            Upcoming Events
          </h2>
          <span className="font-mono text-[0.7rem] text-muted tracking-[0.06em]">
            {filtered.length} event{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-display italic text-[1.1rem] text-muted">
              No upcoming events for this genre — check back soon.
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
