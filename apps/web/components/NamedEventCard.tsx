import type { NamedEvent } from '@/types/named-event';

const TZ = 'America/Toronto';

function formatDateRange(event: NamedEvent): string | null {
  if (event.schedule?.length) {
    const start = new Date(event.schedule[0].startTime);
    const end   = new Date(event.schedule[event.schedule.length - 1].endTime);
    const fmt   = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ, month: 'short', day: 'numeric' });
    return start.toDateString() === end.toDateString() ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
  }
  if (event.dateTime) {
    return new Date(event.dateTime).toLocaleDateString('en-CA', {
      timeZone: TZ, month: 'short', day: 'numeric',
    });
  }
  return null;
}

export default function NamedEventCard({
  event,
  genreLabels,
}: {
  event: NamedEvent;
  genreLabels: Record<string, string>;
}) {
  const dateRange = formatDateRange(event);

  return (
    <a
      href={`/events/${event._id}`}
      className="block bg-card-bg border-border no-underline group hover:bg-[#162030] transition-colors duration-150 p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="font-mono text-[0.62rem] tracking-[0.1em] uppercase text-accent">
          {event._type === 'festival' ? 'Festival' : 'Series'}
        </span>
        {event.genre && genreLabels[event.genre] && (
          <span className="font-mono text-[0.6rem] tracking-[0.08em] uppercase text-muted">
            {genreLabels[event.genre]}
          </span>
        )}
      </div>

      <h2 className="font-sans font-bold text-[1.05rem] leading-snug tracking-[-0.01em] text-ink mb-2 group-hover:text-accent transition-colors duration-150">
        {event.title}
      </h2>

      <p className="font-mono text-[0.72rem] text-muted mb-1">
        {event.venue}{event.neighbourhood ? `, ${event.neighbourhood}` : ''}
      </p>

      {dateRange && (
        <p className="font-mono text-[0.72rem] text-accent">
          {dateRange}
        </p>
      )}

      {event.notes && (
        <p className="text-[0.8rem] text-muted leading-relaxed mt-3 line-clamp-2">
          {event.notes.split('\n\n')[0]}
        </p>
      )}

      <div className="mt-4 flex items-center gap-1.5 font-mono text-[0.65rem] tracking-[0.08em] uppercase text-muted group-hover:text-accent transition-colors duration-150">
        View lineup
        <svg viewBox="0 0 16 16" className="w-3 h-3 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 8h10M9 4l4 4-4 4"/>
        </svg>
      </div>
    </a>
  );
}
