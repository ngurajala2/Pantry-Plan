export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background rounded square */}
      <rect width="32" height="32" rx="8" fill="#1c1917" />

      {/* Shelf / pantry lines */}
      <rect x="6" y="9" width="20" height="2" rx="1" fill="white" opacity="0.9" />
      <rect x="6" y="15" width="20" height="2" rx="1" fill="white" opacity="0.9" />
      <rect x="6" y="21" width="20" height="2" rx="1" fill="white" opacity="0.9" />

      {/* Small jars / items on shelves */}
      <rect x="8" y="5" width="4" height="4" rx="1.5" fill="#10b981" />
      <rect x="14" y="5" width="3" height="4" rx="1.5" fill="#6ee7b7" />
      <rect x="19" y="5" width="5" height="4" rx="1.5" fill="#10b981" opacity="0.7" />

      <rect x="8" y="11" width="5" height="4" rx="1.5" fill="#6ee7b7" />
      <rect x="15" y="11" width="3" height="4" rx="1.5" fill="#10b981" />
      <rect x="20" y="11" width="4" height="4" rx="1.5" fill="#6ee7b7" opacity="0.8" />

      <rect x="8" y="17" width="3" height="4" rx="1.5" fill="#10b981" opacity="0.6" />
      <rect x="13" y="17" width="5" height="4" rx="1.5" fill="#6ee7b7" />
      <rect x="20" y="17" width="4" height="4" rx="1.5" fill="#10b981" />
    </svg>
  )
}
