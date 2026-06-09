export default function Footer() {
  return (
    <footer className="px-[clamp(1.5rem,5vw,4rem)] py-6 border-t border-border flex items-center justify-between gap-4 flex-wrap">
      <span className="font-mono text-[0.68rem] tracking-[0.06em] text-muted">
        © 2026 Unlocked Stage · Toronto, ON
      </span>
      <div className="flex gap-6">
        {[
          { href: 'https://instagram.com/unlocked_stage', label: 'Instagram' },
          { href: 'https://facebook.com/unlockedstage', label: 'Facebook' },
        ].map(({ href, label }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[0.68rem] tracking-[0.08em] uppercase text-muted no-underline transition-colors duration-200 hover:text-ink"
          >
            {label}
          </a>
        ))}
        <a
          href="mailto:hello@unlockedstage.ca"
          className="font-mono text-[0.68rem] tracking-[0.08em] uppercase text-muted no-underline transition-colors duration-200 hover:text-ink"
        >
          Contact
        </a>
      </div>
    </footer>
  );
}
