import { client, eventsQuery } from '@/lib/sanity';
import type { Event } from '@/types/event';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import EventsClient from '@/components/EventsClient';
import Footer from '@/components/Footer';

export const revalidate = 900; // ISR: revalidate every 15 minutes

export default async function Home() {
  // UTC midnight today — safe lower bound for GROQ's lexicographic datetime comparison
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const allEvents = await client.fetch<Event[]>(eventsQuery, { startOfToday: startOfToday.toISOString() });

  // Precise filter: JS Date handles timezone offsets correctly
  const now = new Date();
  const events = allEvents.filter(e => new Date(e.dateTime) >= now);

  return (
    <>
      <Header />
      <Hero />
      <EventsClient events={events} />
      <Footer />
    </>
  );
}
