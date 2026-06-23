export default function Header() {
  return (
    <header className="px-[clamp(1.5rem,5vw,4rem)] py-7 flex items-center gap-8 border-b border-border relative z-10 bg-paper">
      <a
        href="/"
        className="font-display text-[1.2rem] tracking-[-0.01em] text-ink no-underline flex items-center gap-2 flex-shrink-0"
      >
        <span className="inline-flex w-[26px] h-[26px] rounded-full bg-accent items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 16 16" className="w-[13px] h-[13px] fill-white" aria-hidden="true">
            <path d="M4 3v10l9-5z" />
          </svg>
        </span>
        Unlocked Stage
      </a>

      <div className="w-px h-5 bg-border flex-shrink-0" aria-hidden="true" />

      <nav className="flex items-center gap-5">
        <a
          href="/"
          className="font-mono text-[0.68rem] tracking-[0.1em] uppercase text-muted hover:text-ink transition-colors duration-150 no-underline"
        >
          Shows
        </a>
        <a
          href="/events"
          className="font-mono text-[0.68rem] tracking-[0.1em] uppercase text-muted hover:text-ink transition-colors duration-150 no-underline"
        >
          Festivals
        </a>
      </nav>
    </header>
  );
}
