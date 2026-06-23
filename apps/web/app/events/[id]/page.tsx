import { notFound } from 'next/navigation';
import { client, eventDetailQuery } from '@/lib/sanity';
import type { EventDetail } from '@/types/named-event';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const revalidate = 900;

const TZ = 'America/Toronto';

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric',
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', {
    timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event, performances } = await client.fetch<EventDetail>(eventDetailQuery, { id });

  if (!event) notFound();

  // Group performances by Toronto calendar day
  const byDay = new Map<string, typeof performances>();
  for (const p of performances) {
    const key = dayKey(p.dateTime);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(p);
  }

  const dateRange = (() => {
    if (event.schedule?.length) {
      const start = new Date(event.schedule[0].startTime);
      const end   = new Date(event.schedule[event.schedule.length - 1].endTime);
      const fmt   = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ, month: 'short', day: 'numeric' });
      return start.toDateString() === end.toDateString() ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
    }
    if (event.dateTime) {
      return new Date(event.dateTime).toLocaleDateString('en-CA', {
        timeZone: TZ, month: 'long', day: 'numeric', year: 'numeric',
      });
    }
    return null;
  })();

  return (
    <>
      <Header />

      <section className="px-[clamp(1.5rem,5vw,4rem)] pt-[clamp(2.5rem,5vw,4rem)] pb-4">
        <a
          href="/events"
          className="inline-flex items-center gap-2 font-mono text-[0.7rem] tracking-[0.1em] uppercase text-muted hover:text-accent transition-colors duration-150 no-underline mb-8"
        >
          <svg viewBox="0 0 16 16" className="w-3 h-3 fill-current" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          All Events
        </a>

        <div className="max-w-[720px]">
          <p className="font-mono text-[0.7rem] tracking-[0.14em] uppercase text-accent mb-3">
            {event._type === 'festival' ? 'Festival' : 'Series'}
          </p>
          <h1 className="font-sans font-bold text-[clamp(2rem,5vw,3.5rem)] leading-[1.05] tracking-[-0.025em] mb-4">
            {event.title}
          </h1>

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted text-[0.9rem] mb-4">
            <span>{event.venue}{event.neighbourhood ? `, ${event.neighbourhood}` : ''}</span>
            {dateRange && <span className="text-accent">{dateRange}</span>}
          </div>

          {event.notes && (
            <p className="text-[0.9rem] text-muted leading-relaxed border-t border-border pt-4 mt-4 max-w-[56ch]">
              {event.notes.split('\n\n')[0]}
            </p>
          )}

          {event.externalLink && (
            <a
              href={event.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-5 font-mono text-[0.72rem] tracking-[0.08em] uppercase text-accent border border-accent rounded-full px-4 py-[0.35rem] no-underline hover:bg-accent hover:text-white transition-colors duration-150"
            >
              More info
              <svg viewBox="0 0 16 16" className="w-3 h-3 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 13L13 3M7 3h6v6"/>
              </svg>
            </a>
          )}
        </div>
      </section>

      {/* Performances */}
      <section className="px-[clamp(1.5rem,5vw,4rem)] py-[clamp(2rem,4vw,3rem)]">
        {performances.length === 0 ? (
          <p className="text-muted text-[0.9rem]">No performances listed yet.</p>
        ) : (
          <div className="space-y-8 max-w-[720px]">
            {Array.from(byDay.entries()).map(([, dayPerfs]) => (
              <div key={dayKey(dayPerfs[0].dateTime)}>
                <h2 className="font-sans font-bold text-[0.82rem] tracking-[0.06em] uppercase text-accent mb-3">
                  {formatDay(dayPerfs[0].dateTime)}
                </h2>
                <div className="border-[1.5px] border-border">
                  {dayPerfs.map((p, i) => (
                    <div
                      key={p._id}
                      className={`flex items-baseline gap-4 px-5 py-[0.75rem] ${i !== 0 ? 'border-t border-border' : ''}`}
                    >
                      <span className="font-mono text-[0.75rem] text-accent w-[4.5rem] flex-shrink-0 tabular-nums">
                        {formatTime(p.dateTime)}
                      </span>
                      <span className="font-sans font-semibold text-[0.95rem] text-ink leading-snug">
                        {p.artist}
                      </span>
                      {p.venue && p.venue !== event.venue && (
                        <span className="font-mono text-[0.68rem] text-muted ml-auto text-right leading-snug max-w-[40%]">
                          {p.venue}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Footer />
    </>
  );
}
