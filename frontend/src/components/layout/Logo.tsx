export function LogoMark({ className = "size-8" }: { className?: string }) {
  // Nodes converging into one: data from many institutions, one consolidated view.
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ofi-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#3987e5" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="#0f1a2b" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="rgb(255 255 255 / 0.08)" />
      <g stroke="url(#ofi-g)" strokeWidth="1.6" strokeLinecap="round" opacity="0.9">
        <path d="M8 9.5 15.5 16M24 9 16.5 16M8.5 23 15.5 16.5M23.5 23 16.5 16.5" />
      </g>
      <circle cx="8" cy="9.5" r="2" fill="#5b6983" />
      <circle cx="24" cy="9" r="2" fill="#5b6983" />
      <circle cx="8.5" cy="23" r="2" fill="#5b6983" />
      <circle cx="23.5" cy="23" r="2" fill="#5b6983" />
      <circle cx="16" cy="16" r="3.6" fill="url(#ofi-g)" />
    </svg>
  );
}
