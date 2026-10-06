import type { ReactNode } from "react";

const paths = {
  arrow: "M4 12h16m-6-6 6 6-6 6",
  external: "M7 17 17 7M7 7h10v10",
  heart: "M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-4 4 0 8 8 14 8-6 12-10 8-14Z",
  flower:
    "M12 21V10m0 5C4 15 3 10 3 10s7-1 9 5Zm0 0c8 0 9-5 9-5s-7-1-9 5ZM8 7a4 4 0 1 1 8 0c0 3-4 5-4 5S8 10 8 7Z",
  sparkle: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
  location:
    "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0ZM14.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z",
  mail: "M3 5h18v14H3V5Zm0 0 9 7 9-7",
  gallery: "M4 4h16v16H4V4Zm0 13 5-5 4 4 3-3 4 4M8 8h.01",
  upload: "M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6",
  download: "M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5",
  qr: "M3 3h6v6H3V3Zm12 0h6v6h-6V3ZM3 15h6v6H3v-6Zm12 0h3v3h3v3h-6v-6ZM12 3v6M3 12h6m3 0h6m-6 3v6m9-9v3",
  play: "m9 5 11 7-11 7V5Z",
  flight: "m12 3 2 7 7 4v2l-7-2v5l2 2H8l2-2v-5l-7 2v-2l7-4 2-7Z",
  hotel: "M4 21V3h16v18M9 21v-5h6v5M8 7h1m6 0h1M8 11h1m6 0h1",
  close: "m6 6 12 12M6 18 18 6",
  menu: "M4 6h16M4 12h16M4 18h16",
} as const;

export function WeddingIcon({
  name,
  className = "size-5",
}: {
  name: keyof typeof paths;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function PreviewButton({
  children,
  secondary = false,
}: {
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled
      title="Available when this feature is ready"
      className={`inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-2 rounded-sm px-6 py-3 text-[11px] font-semibold tracking-[0.12em] shadow-sm ${secondary ? "bg-panel text-primary" : "bg-primary text-white"}`}
    >
      {children}
    </button>
  );
}

export function SampleQr({ small = false }: { small?: boolean }) {
  return (
    <svg
      role="img"
      aria-label="Sample QR illustration, not scannable"
      viewBox="0 0 100 100"
      className={small ? "size-24" : "size-48"}
    >
      <rect width="100" height="100" fill="white" />
      {[
        [10, 10],
        [66, 10],
        [10, 66],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="24" height="24" rx="1" fill="#301621" />
          <rect x={x + 4} y={y + 4} width="16" height="16" fill="white" />
          <rect x={x + 8} y={y + 8} width="8" height="8" fill="#301621" />
        </g>
      ))}
      {[
        [38, 12],
        [46, 12],
        [54, 12],
        [12, 38],
        [12, 46],
        [12, 54],
        [38, 24],
        [44, 28],
        [52, 24],
        [58, 30],
        [24, 38],
        [28, 44],
        [24, 52],
        [30, 58],
        [52, 40],
        [40, 52],
        [48, 48],
        [56, 48],
        [66, 40],
        [74, 40],
        [70, 46],
        [82, 44],
        [40, 66],
        [48, 70],
        [56, 78],
        [68, 68],
        [76, 68],
        [68, 76],
        [80, 80],
        [84, 88],
      ].map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width="4"
          height="4"
          fill="#301621"
        />
      ))}
      <rect x="40" y="40" width="8" height="8" rx="1" fill="#482b36" />
    </svg>
  );
}
