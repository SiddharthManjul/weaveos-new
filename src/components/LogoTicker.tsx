"use client";

/* Demo logos — swap with real SVG assets when ready */
const LOGOS = [
  "awwwards.",
  "Product Hunt",
  "Framer",
  "Lemon Squeezy",
  "Y Combinator",
  "TechCrunch",
  "Hacker News",
  "Indie Hackers",
];

/* Split into two rows for mobile */
const LOGOS_R1 = LOGOS.slice(0, 4);
const LOGOS_R2 = LOGOS.slice(4);

/* Duplicate each list so the seam is invisible during the loop */
const ITEMS    = [...LOGOS,    ...LOGOS];
const ITEMS_R1 = [...LOGOS_R1, ...LOGOS_R1];
const ITEMS_R2 = [...LOGOS_R2, ...LOGOS_R2];

function MarqueeRow({ items, duration = "24s", reverse = false }: {
  items: string[];
  duration?: string;
  reverse?: boolean;
}) {
  return (
    <div className="relative overflow-hidden">
      <div
        className="flex items-center gap-10 w-max"
        style={{
          animation: `marquee ${duration} linear infinite`,
          animationDirection: reverse ? "reverse" : "normal",
        }}
      >
        {items.map((name, i) => (
          <span
            key={i}
            className="whitespace-nowrap text-white font-medium text-[14px]"
            style={{ opacity: 0.28 }}
          >
            {name}
          </span>
        ))}
      </div>

      {/* Left + right fades */}
      <div
        className="pointer-events-none absolute left-0 top-0 h-full w-16"
        style={{ background: "linear-gradient(to right, #000, transparent)" }}
      />
      <div
        className="pointer-events-none absolute right-0 top-0 h-full w-16"
        style={{ background: "linear-gradient(to left, #000, transparent)" }}
      />
    </div>
  );
}

export function LogoTicker() {
  return (
    <div className="relative z-10 w-full bg-black overflow-hidden">

      {/* ── Mobile: 2 stacked rows, no label ──────────────────────── */}
      <div className="sm:hidden max-w-[1200px] mx-auto px-5 flex flex-col gap-3 py-6">
        <MarqueeRow items={ITEMS_R1} duration="20s" />
        <MarqueeRow items={ITEMS_R2} duration="20s" reverse />
      </div>

      {/* ── Desktop: label + single scrolling row ─────────────────── */}
      <div className="hidden sm:flex max-w-[1200px] mx-auto px-5 items-center py-6">

        {/* Static label */}
        <p
          className="shrink-0 pr-8 text-[13px] whitespace-nowrap"
          style={{ color: "#808080" }}
        >
          Our product WILL be featured on
        </p>

        {/* Scrolling strip */}
        <div className="relative flex-1 overflow-hidden">
          <div
            className="flex items-center gap-12 w-max"
            style={{ animation: "marquee 28s linear infinite" }}
          >
            {ITEMS.map((name, i) => (
              <span
                key={i}
                className="whitespace-nowrap text-white font-medium text-[15px]"
                style={{ opacity: 0.28 }}
              >
                {name}
              </span>
            ))}
          </div>

          {/* Right-edge fade */}
          <div
            className="pointer-events-none absolute right-0 top-0 h-full w-20"
            style={{ background: "linear-gradient(to left, #000, transparent)" }}
          />
        </div>
      </div>

    </div>
  );
}
