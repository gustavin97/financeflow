export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <rect width="24" height="24" fill="#107c41" />
      <path d="M0 8h24M0 16h24M8 0v24M16 0v24" stroke="#fff" strokeOpacity=".28" />
      <path d="M4 18l5-5 4 3 7-8" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="square" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className={`text-[16px] font-semibold tracking-tight ${light ? "text-white" : "text-ink"}`}>
        Finance Flow
      </span>
    </span>
  );
}
