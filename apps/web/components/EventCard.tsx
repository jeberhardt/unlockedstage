import Image from 'next/image';
import { urlFor } from '@/lib/sanity';
import type { Event } from '@/types/event';

const GENRE_COLORS: Record<string, string> = {
  jazz: '#10b981',
  folk: '#f59e0b',
  indie: '#818cf8',
  classical: '#a855f7',
  electronic: '#06b6d4',
  rb: '#ec4899',
  pop: '#f97316',
  hiphop: '#3b82f6',
  other: '#FF2D2D',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    month: d.toLocaleString('en-CA', { month: 'short' }),
    day: d.getDate(),
    weekday: d.toLocaleString('en-CA', { weekday: 'short' }),
    time: d.toLocaleString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true }),
  };
}

const cardClassName =
  'group bg-card-bg p-[1.6rem] flex flex-col gap-[0.85rem] no-underline text-ink transition-colors duration-200 hover:bg-[#162030] relative overflow-hidden animate-fade-up';

function CardInner({ event }: { event: Event }) {
  const { month, day, weekday, time } = formatDate(event.dateTime);
  const color = GENRE_COLORS[event.genre] ?? '#555555';
  const imageUrl = event.image
    ? urlFor(event.image).width(800).height(350).url()
    : null;

  return (
    <>
      {/* Date block + genre badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col items-center justify-center bg-accent text-white w-14 h-[62px] flex-shrink-0 rounded-[3px] py-[0.3rem]">
          <span className="font-mono text-[0.55rem] tracking-[0.1em] uppercase opacity-80 leading-none">
            {month}
          </span>
          <span className="font-sans font-bold text-[1.4rem] leading-[1.1]">{day}</span>
          <span className="font-mono text-[0.52rem] tracking-[0.08em] uppercase opacity-70 leading-none">
            {weekday}
          </span>
        </div>
        <span
          className="font-mono text-[0.62rem] tracking-[0.1em] uppercase text-white px-2 py-[0.2rem] rounded-[2px] self-start"
          style={{ backgroundColor: color }}
        >
          {event.genre}
        </span>
      </div>

      {/* Artist / title */}
      <div className="font-sans font-bold text-[1.15rem] leading-[1.2] tracking-[-0.01em]">
        {event.title || event.artist}
      </div>

      {/* Venue */}
      <div className="flex items-center gap-[0.4rem] text-[0.82rem] text-muted">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-3 h-3 flex-shrink-0 stroke-muted"
          aria-hidden="true"
        >
          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        {event.venue}
      </div>

      {/* Image */}
      {imageUrl && (
        <div className="relative w-full aspect-[16/7] rounded-[2px] overflow-hidden">
          <Image
            src={imageUrl}
            alt={`${event.artist} at ${event.venue}`}
            fill
            sizes="(max-width: 640px) 100vw, 320px"
            className="object-cover"
          />
        </div>
      )}

      {/* Notes */}
      {event.notes && (
        <p className="text-[0.82rem] text-muted leading-[1.6] border-t border-border pt-3">
          {event.notes}
        </p>
      )}

      {/* Meta row */}
      <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
        <span className="font-mono text-[0.7rem] tracking-[0.06em] text-muted">{time}</span>
        <span className="font-mono text-[0.62rem] tracking-[0.08em] uppercase text-muted border border-border rounded-full px-2 py-[0.15rem]">
          {event.neighbourhood}
        </span>
      </div>

      {/* Arrow — only for external links */}
      {event.externalLink && (
        <span className="absolute top-[1.4rem] right-[1.4rem] opacity-0 -translate-x-1 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-[15px] h-[15px] stroke-accent"
            aria-hidden="true"
          >
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
          </svg>
        </span>
      )}
    </>
  );
}

export default function EventCard({ event, index }: { event: Event; index: number }) {
  const style = { animationDelay: `${index * 0.05}s` };

  if (event.externalLink) {
    return (
      <a
        href={event.externalLink}
        target="_blank"
        rel="noopener noreferrer"
        className={cardClassName}
        style={style}
      >
        <CardInner event={event} />
      </a>
    );
  }

  return (
    <div className={cardClassName} style={style}>
      <CardInner event={event} />
    </div>
  );
}
