/* Kanbo brand marks. The icon is a kanban board (three columns + a done check). */

export function KanboIcon({ size = 32 }: { size?: number }) {
  // Unique gradient id per size so multiple marks on one page don't collide.
  const gid = `kanbo-grad-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5B8DEF" />
          <stop offset="1" stopColor="#3A5FD9" />
        </linearGradient>
      </defs>
      <rect x="16" y="16" width="224" height="224" rx="52" fill={`url(#${gid})`} />
      <rect x="62" y="70" width="34" height="86" rx="10" fill="#ffffff" opacity="0.55" />
      <rect x="111" y="70" width="34" height="120" rx="10" fill="#ffffff" opacity="0.8" />
      <rect x="160" y="70" width="34" height="62" rx="10" fill="#ffffff" />
      <path d="M169 98 l6.5 6.5 l13 -13" fill="none" stroke="#3A5FD9" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Icon + "Kanbo" wordmark (two-tone, theme-aware). */
export function KanboWordmark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <KanboIcon size={size} />
      <span className="font-bold tracking-tight" style={{ fontSize: size * 0.62 }}>
        Kan<span className="text-accent">bo</span>
      </span>
    </span>
  );
}
