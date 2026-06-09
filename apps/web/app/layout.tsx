import type { Metadata } from 'next';
import { Playfair_Display, DM_Mono, DM_Sans } from 'next/font/google';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['400', '700'],
  variable: '--font-playfair',
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Unlocked Stage — Free Concerts in Toronto',
  description: 'Discover free live concerts and performances happening across Toronto. Updated weekly.',
  openGraph: {
    title: 'Unlocked Stage — Free Concerts in Toronto',
    description: 'Discover the concerts happening in your neighbourhood.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${dmMono.variable} ${dmSans.variable}`}
    >
      <body className="bg-paper text-ink font-sans text-[15px] leading-relaxed min-h-screen overflow-x-hidden flex flex-col">
        {children}
      </body>
    </html>
  );
}
