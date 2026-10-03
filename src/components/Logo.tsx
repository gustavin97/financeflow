export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="ff-logo" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1aa35c" />
          <stop offset="1" stopColor="#0b5f31" />
        </linearGradient>
        <clipPath id="ff-logo-clip">
          <rect width="24" height="24" rx="6" />
        </clipPath>
      </defs>
      <g clipPath="url(#ff-logo-clip)">
        <rect width="24" height="24" fill="url(#ff-logo)" />
        <path d="M0 8h24M0 16h24M8 0v24M16 0v24" stroke="#fff" strokeOpacity=".2" />
      </g>
      <path d="M4 18l5-5 4 3 7-8" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ light = false, large = false }: { light?: boolean; large?: boolean }) {
  return (
    <span className={`inline-flex items-center ${large ? "gap-3" : "gap-2.5"}`}>
      <LogoMark size={large ? 30 : 24} />
      <span
        className={`${large ? "text-[20px]" : "text-[16px]"} whitespace-nowrap font-semibold tracking-tight ${light ? "text-white" : "text-ink"}`}
      >
        Finance Flow
      </span>
    </span>
  );
}
