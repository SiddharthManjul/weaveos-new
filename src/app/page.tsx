import Image from "next/image";
import { LandingNav } from "@/components/LandingNav";
import { FeaturesSection } from "@/components/FeaturesSection";
import { FeatureSplitSection } from "@/components/FeatureSplitSection";
import { LogoTicker } from "@/components/LogoTicker";
import { FaqSection } from "@/components/FaqSection";
import { CtaSection } from "@/components/CtaSection";
import { Footer } from "@/components/Footer";

export default function LandingPage() {
  return (
    // flex-col so the image section can flex-1 to fill remaining viewport
    <div className="min-h-full flex flex-col bg-black text-white">

      {/* Fixed landing navbar */}
      <LandingNav />

      {/* Radial glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(30, 60, 180, 0.1) 0%, transparent 70%)",
        }}
      />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      {/* shrink-0 prevents this from stretching — image takes the rest */}
      <section className="relative z-10 flex flex-col items-center text-center px-5 pt-24 sm:pt-32 pb-8 shrink-0">

        {/*
          Heading — guaranteed 2 lines on every screen.
          flex-col with two explicit rows: row 1 = "Pricing Intelligence Platform",
          row 2 = "for [Agent Economy badge]". No flex-wrap guessing.
        */}
        <div
          className="flex flex-col items-center text-center"
          style={{ fontSize: "clamp(26px, 4.5vw, 60px)", lineHeight: 1.12, gap: "0.1em" }}
        >
          {/* Row 1 */}
          <div className="flex items-center justify-center gap-[0.28em]">
            {["Pricing", "Intelligence", "Platform"].map((w) => (
              <span
                key={w}
                className="font-semibold text-white tracking-tight whitespace-nowrap"
              >
                {w}
              </span>
            ))}
          </div>

          {/* Row 2 */}
          <div className="flex items-center justify-center gap-[0.28em]">
            <span className="font-semibold text-white tracking-tight whitespace-nowrap">
              for
            </span>
            {/* Badge */}
            <div
              className="flex items-center shrink-0 whitespace-nowrap"
              style={{
                background: "#070e26",
                borderRadius: "0.25em",
                padding: "0.1em 0.42em",
              }}
            >
              <span
                className="font-semibold tracking-tight whitespace-nowrap"
                style={{ color: "#3064FF", letterSpacing: "-0.01em" }}
              >
                Agent Economy
              </span>
            </div>
          </div>
        </div>

        {/* Subtitle */}
        <p
          className="mt-4 leading-relaxed max-w-[700px] line-clamp-2"
          style={{ color: "#808080", fontSize: "clamp(13px, 1.8vw, 20px)" }}
        >
          We show you which AI tasks, customers, and workflows are
          losing money before they kill your margins.
        </p>

        {/* CTA button — smaller on mobile, hover expand animation */}
        <a
          href="/dashboard"
          className="group relative mt-5 flex items-center gap-2 sm:gap-3 rounded-full overflow-hidden
                     pt-[6px] pb-[6px] pl-[14px] pr-[3px]
                     sm:pt-[9px] sm:pb-[9px] sm:pl-5 sm:pr-[3px]"
          style={{
            background: "#3064FF",
            border: "2px solid #3064FF",
          }}
        >
          {/* Black fill — expands outward from the circle position on hover */}
          <span
            className="absolute right-[3px] top-1/2 -translate-y-1/2
                       w-[26px] h-[26px] sm:w-[32px] sm:h-[32px]
                       rounded-full bg-black
                       scale-0 group-hover:scale-[14]
                       transition-transform duration-500 ease-in-out"
            aria-hidden="true"
          />
          <span className="relative z-10 text-white font-semibold text-[12px] sm:text-[14px]">
            Request Access
          </span>
          <span className="relative z-10 w-[26px] h-[26px] sm:w-[32px] sm:h-[32px] rounded-full flex items-center justify-center shrink-0 bg-black">
            <svg
              className="transition-transform duration-500 group-hover:-rotate-45"
              width="9"
              height="9"
              viewBox="0 0 11 11"
              fill="none"
            >
              <path
                d="M2 5.5h7M5.5 2 9 5.5 5.5 9"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </a>
      </section>

      {/* ── Dashboard screenshot ──────────────────────────────────── */}
      {/*
        This div IS the image container — no nesting needed.
        Mobile:  flex-1 min-h-0 → fills remaining viewport height exactly.
        Desktop: flex-none w-full max-w-[1100px] mx-auto + aspect-[1100/720]
                 → natural proportions. w-full is required because flex-none
                 drops the default flex cross-axis stretch.
        Image:   fill prop → position:absolute inset-0, latches onto this
                 container's actual height. object-left-top shows the left
                 side of the dashboard when the image is elongated.
      */}
      <div
        className="relative z-10 flex-1 min-h-[calc(100svh-240px)] sm:min-h-0
                   sm:flex-none sm:w-full sm:max-w-[1100px] sm:mx-auto sm:aspect-[1100/720]
                   overflow-hidden rounded-t-xl sm:rounded-2xl"
        style={{
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 40px 120px rgba(0,0,0,0.7)",
        }}
      >
        {/* Blue glow */}
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-0"
          style={{
            top: "10%",
            width: "60%",
            height: "50%",
            background: "rgba(30, 80, 220, 0.16)",
            filter: "blur(80px)",
            borderRadius: "50%",
          }}
        />

        {/* Mobile: crop top-left | Desktop: show full image contained */}
        <Image
          src="/dashboard-hero.png"
          alt="WeaveOS Dashboard"
          fill
          priority
          sizes="(max-width: 640px) 100vw, 1100px"
          className="object-cover object-left-top sm:object-contain sm:object-center"
        />

        {/* Bottom fade — mobile only, blends the cropped bottom into black */}
        <div
          className="pointer-events-none absolute bottom-0 inset-x-0 z-20 sm:hidden"
          style={{
            height: "55%",
            background: "linear-gradient(to top, #000 0%, transparent 100%)",
          }}
        />
      </div>

      {/* ── Features (3-card grid) ───────────────────────────────── */}
      <FeaturesSection />

      {/* ── Feature split rows ───────────────────────────────────── */}
      <FeatureSplitSection />

      {/* ── Logo ticker ─────────────────────────────────────────── */}
      <LogoTicker />

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <FaqSection />

      {/* ── Global CTA ───────────────────────────────────────────── */}
      <CtaSection />

      {/* ── Footer ───────────────────────────────────────────────── */}
      <Footer />

    </div>
  );
}
