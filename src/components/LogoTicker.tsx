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

/* Duplicate so the seam is invisible during the loop */
const ITEMS = [...LOGOS, ...LOGOS];

export function LogoTicker() {
  return (
    <div className="relative z-10 w-full bg-black overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-5 flex items-center py-6">

        {/* ── Static label ───────────────────────────────────────── */}
        <p
          className="shrink-0 pr-8 text-[13px] whitespace-nowrap"
          style={{ color: "#808080" }}
        >
          Our product WILL be featured on
        </p>

        {/* ── Scrolling logos ─────────────────────────────────────── */}
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

          {/* Right-edge fade — scoped inside the strip */}
          <div
            className="pointer-events-none absolute right-0 top-0 h-full w-20"
            style={{ background: "linear-gradient(to left, #000, transparent)" }}
          />
        </div>

      </div>
    </div>
  );
}
