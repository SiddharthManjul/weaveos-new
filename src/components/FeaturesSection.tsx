import Image from "next/image";

const CARDS = [
  {
    highlight: "Real-time margin tracking across every workflow.",
    rest: " See exactly how much each AI task costs as it runs — broken down by model call, token usage, and operation type.",
    image: "/image1.png",
    alt: "Margin tracking",
  },
  {
    highlight: "Know which customers are actually profitable.",
    rest: " Identify the accounts eroding your margins before they scale into losses you can't recover from.",
    image: "/image2.png",
    alt: "Customer profitability",
  },
  {
    highlight: "Price confidently with data, not guesswork.",
    rest: " Get recommendations for every workflow based on actual cost and value delivered.",
    image: "/image3.png",
    alt: "Pricing suggestions",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="relative z-10 w-full bg-black pt-20 pb-20 px-5">
      <div className="max-w-[1200px] mx-auto flex flex-col items-center gap-10">

        {/* ── "How it works" badge ─────────────────────────────── */}
        <div className="inline-flex w-fit rounded-full p-[1px]" style={{ background: "linear-gradient(135deg, #1a1a1a, #2e2e2e)" }}>
          <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-[#111113]">
            <span className="text-[#3064FF] text-[13px] font-medium">How it works</span>
          </div>
        </div>

        {/* ── Heading — fixed 40px, grey = #808080 ─────────────── */}
        <div
          className="flex flex-col items-center text-center"
          style={{ fontSize: "clamp(28px, 3.2vw, 40px)", lineHeight: 1.18, gap: "0.08em" }}
        >
          <span className="font-semibold" style={{ color: "#808080" }}>
            Know the economics of every
          </span>
          <span className="font-semibold text-white">
            AI task before it runs
          </span>
        </div>

        {/* ── Cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
          {CARDS.map((card) => (
            <div
              key={card.alt}
              className="flex flex-col overflow-hidden rounded-t-[20px]"
              style={{
                background: "#111113",
                border: "1px solid #1e1e1e",
                borderBottom: "none",
              }}
            >
              {/* Paragraph — 16px, white hook + #808080 continuation */}
              <div className="px-5 pt-5 pb-5 shrink-0">
                <p className="text-[16px] leading-relaxed">
                  <span className="text-white font-medium">{card.highlight}</span>
                  <span style={{ color: "#808080" }}>{card.rest}</span>
                </p>
              </div>

              {/* Image — fills remaining card, dissolves into black at bottom */}
              <div className="relative flex-1 min-h-[150px] sm:min-h-[190px] overflow-hidden">
                <Image
                  src={card.image}
                  alt={card.alt}
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 640px) 100vw, 400px"
                />
                {/* Dissolve gradient — only bottom ~35% fades to black */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(to bottom, transparent 80%, rgba(0,0,0,0.65) 100%)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
