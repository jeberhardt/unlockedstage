import { client, namedEventsQuery } from '@/lib/sanity';
import type { NamedEvent } from '@/types/named-event';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import NamedEventCard from '@/components/NamedEventCard';

export const revalidate = 900;

export const metadata = {
  title: 'Events & Festivals — Unlocked Stage',
  description: 'Browse free festivals, concert series, and multi-day events happening in Toronto.',
};

const GENRE_LABELS: Record<string, string> = {
  jazz: 'Jazz', indie: 'Indie', classical: 'Classical', folk: 'Folk',
  electronic: 'Electronic', rb: 'R&B', pop: 'Pop', hiphop: 'Hip-Hop', other: 'Live Music',
};

export default async function EventsPage() {
  const events = await client.fetch<NamedEvent[]>(namedEventsQuery);

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const todayStr = startOfToday.toISOString().slice(0, 10);

  const upcoming = events.filter(e => {
    // Use end of last schedule block so ongoing multi-day events still appear
    const endsAt = e.schedule?.length
      ? e.schedule[e.schedule.length - 1].endTime
      : e.dateTime;
    return !endsAt || endsAt >= todayStr;
  });

  return (
    <>
      <Header />
      <section className="px-[clamp(1.5rem,5vw,4rem)] pt-[clamp(3rem,6vw,5rem)] pb-[clamp(2rem,4vw,3rem)]">
        <p className="font-mono text-[0.72rem] tracking-[0.14em] uppercase text-accent flex items-center gap-3 mb-5">
          <span className="block w-8 h-px bg-accent flex-shrink-0" aria-hidden="true" />
          Toronto · Free &amp; Live
        </p>
        <h1 className="font-sans font-bold text-[clamp(2rem,4vw,3rem)] leading-[1.05] tracking-[-0.025em] mb-2">
          Events &amp; Festivals
        </h1>
        <p className="text-muted text-[0.95rem] leading-relaxed mb-10">
          {upcoming.length} upcoming event{upcoming.length !== 1 ? 's' : ''} — click any to see the full lineup.
        </p>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-[1.5px] border-[1.5px] border-border">
          {upcoming.map((event) => (
            <NamedEventCard key={event._id} event={event} genreLabels={GENRE_LABELS} />
          ))}
        </div>
      </section>
      <Footer />
    </>
  );
}
