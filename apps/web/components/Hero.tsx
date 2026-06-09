export default function Hero() {
  return (
    <section className="hero-section px-[clamp(1.5rem,5vw,4rem)] pt-[clamp(4rem,10vw,7rem)] pb-[clamp(3rem,6vw,5rem)] border-b border-border relative overflow-hidden">
      <p className="font-mono text-[0.72rem] tracking-[0.14em] uppercase text-accent flex items-center gap-3 mb-7 animate-fade-up">
        <span className="block w-8 h-px bg-accent flex-shrink-0" aria-hidden="true" />
        Toronto · Free &amp; Live
      </p>
      <h1
        className="font-display text-[clamp(2.8rem,6vw,5.5rem)] font-normal leading-[1.05] tracking-[-0.025em] max-w-[18ch]"
        style={{ animation: 'fadeUp 0.55s ease 0.08s both' }}
      >
        Discover the concerts happening in your{' '}
        <em className="italic text-accent">neighbourhood.</em>
      </h1>
      <p
        className="text-base text-muted mt-6 max-w-[46ch] leading-[1.75]"
        style={{ animation: 'fadeUp 0.55s ease 0.16s both' }}
      >
        A curated calendar of free concerts and live performances happening across
        Toronto&apos;s neighbourhoods — updated weekly.
      </p>
    </section>
  );
}
