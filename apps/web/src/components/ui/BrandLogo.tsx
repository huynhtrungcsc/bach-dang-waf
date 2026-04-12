interface BrandLogoProps {
  size?: number;
  variant?: 'dark' | 'light';
}

export function BrandMark({ size = 28, variant = 'dark' }: BrandLogoProps) {
  const bg    = variant === 'dark' ? '#0f172a' : '#ffffff';
  const fg    = variant === 'dark' ? '#f8fafc' : '#0f172a';
  const bar   = variant === 'dark' ? '#3b82f6' : '#2563eb';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Bach Dang WAF"
    >
      <rect width="28" height="28" rx="5" fill={bg} />

      {/* Three horizontal bars — firewall/wall motif */}
      <rect x="5" y="7"  width="18" height="3" rx="1" fill={fg} />
      <rect x="5" y="12.5" width="13" height="3" rx="1" fill={bar} />
      <rect x="5" y="18" width="18" height="3" rx="1" fill={fg} />
    </svg>
  );
}

export function BrandMarkInline({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Bach Dang WAF"
    >
      <rect width="28" height="28" rx="5" fill="#1e293b" />
      <rect x="5" y="7"    width="18" height="3"   rx="1" fill="#f1f5f9" />
      <rect x="5" y="12.5" width="12" height="3"   rx="1" fill="#3b82f6" />
      <rect x="5" y="18"   width="18" height="3"   rx="1" fill="#f1f5f9" />
    </svg>
  );
}
