import { client, eventsQuery } from '@/lib/sanity';
import type { Event } from '@/types/event';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import EventsClient from '@/components/EventsClient';
import Footer from '@/components/Footer';

export const revalidate = 900; // ISR: revalidate every 15 minutes

export default async function Home() {
  const events = await client.fetch<Event[]>(eventsQuery);

  return (
    <>
      <Header />
      <Hero />
      <EventsClient events={events} />
      <Footer />
    </>
  );
}
