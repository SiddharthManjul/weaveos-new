"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [skewX, setSkewX] = useState(-7);
  const [skewY, setSkewY] = useState(2);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    // ShellLayout wraps marketing pages in an overflow-y-auto div
    const container = section.closest(".overflow-y-auto") as HTMLElement | null;
    const target = (container ?? window) as EventTarget;

    const onScroll = () => {
      const scrollTop = container ? container.scrollTop : window.scrollY;
      const heroHeight = section.offsetHeight;
      // progress 0 → 1 over the first 55% of the hero height
      const progress = Math.max(0, Math.min(1, scrollTop / (heroHeight * 0.55)));
      setSkewX(-7 * (1 - progress));
      setSkewY(2 * (1 - progress));
    };

    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative z-10 w-full overflow-hidden flex flex-col sm:block"
      style={{ minHeight: "100svh" }}
    >

      {/* Left: text + CTA */}
      {/* Mobile: my-auto centres vertically inside the flex section. Desktop: fixed pt-20/pb-28. */}
      <div className="relative z-10 max-w-[1200px] mx-auto px-5 py-16 sm:pt-20 sm:pb-28 my-auto sm:my-0">
        <div className="max-w-[480px]">

          <h1
            className="font-medium text-white tracking-tight text-[32px] sm:text-[48px]"
            style={{ lineHeight: 1.1 }}
          >
            Pricing Intelligence Platform for Agent Economy
          </h1>

          <p
            className="mt-4 sm:mt-5 leading-relaxed text-[14px] sm:text-[18px]"
            style={{ color: "#808080", maxWidth: "380px" }}
          >
            We show you which AI tasks, customers, and workflows are
            losing money before they kill your margins.
          </p>

          {/* CTA button — smaller on mobile, full-size on sm+ */}
          <a
            href="/dashboard"
            className="group relative mt-6 sm:mt-8 inline-flex items-center
                       gap-2 sm:gap-3 rounded-full overflow-hidden
                       pt-[6px] pb-[6px] pl-4 pr-[2px]
                       sm:pt-[9px] sm:pb-[9px] sm:pl-5 sm:pr-[3px]"
            style={{ background: "#3064FF", border: "2px solid #3064FF" }}
          >
            <span
              className="absolute right-[2px] sm:right-[3px] top-1/2 -translate-y-1/2
                         w-[26px] h-[26px] sm:w-[32px] sm:h-[32px]
                         rounded-full bg-black scale-0 group-hover:scale-[14]
                         transition-transform duration-500 ease-in-out"
              aria-hidden="true"
            />
            <span className="relative z-10 text-white font-semibold text-[13px] sm:text-[14px]">
              Request Access
            </span>
            <span className="relative z-10 w-[26px] h-[26px] sm:w-[32px] sm:h-[32px] rounded-full flex items-center justify-center shrink-0 bg-black">
              <svg
                className="transition-transform duration-500 group-hover:-rotate-45"
                width="9" height="9" viewBox="0 0 11 11" fill="none"
              >
                <path
                  d="M2 5.5h7M5.5 2 9 5.5 5.5 9"
                  stroke="white" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
            </span>
          </a>

        </div>
      </div>

      {/* Right: skewed dashboard — desktop only.
          left: 55% pushes it well right of centre.
          top: 12% / bottom: 0 gives it a fixed height so the image
          can fill by height (width auto) and bleed off the right edge.
          section overflow:hidden clips it.                          */}
      <div
        className="hidden sm:block absolute pointer-events-none"
        style={{ left: "55%", top: "12%", bottom: 0 }}
      >
        <div
          style={{
            transform: `skewX(${skewX}deg) skewY(${skewY}deg)`,
            transformOrigin: "left center",
            height: "100%",
            width: "fit-content",
            overflow: "hidden",
            borderRadius: "14px",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "-24px 24px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.03)",
            transition: "transform 0.07s ease-out",
          }}
        >
          {/* height:100% fills the anchored container; width:auto keeps aspect ratio */}
          <Image
            src="/dashboard-hero.png"
            alt="WeaveOS Dashboard"
            width={3896}
            height={2091}
            priority
            className="max-w-none block"
            style={{ height: "100%", width: "auto" }}
          />
        </div>
      </div>

      {/* Mobile: skewed background image — sits behind text (no z-index = below z-10 text).
          Height-based sizing: image fills full section height, overflows right — section clips it. */}
      <div className="sm:hidden absolute inset-0 pointer-events-none">
        <div
          style={{
            transform: `skewX(${skewX}deg) skewY(${skewY}deg)`,
            transformOrigin: "center top",
            height: "100%",
            width: "fit-content",
            overflow: "hidden",
            borderRadius: "14px",
            border: "1px solid rgba(255,255,255,0.07)",
            transition: "transform 0.07s ease-out",
          }}
        >
          <Image
            src="/dashboard-hero.png"
            alt="WeaveOS Dashboard"
            width={3896}
            height={2091}
            priority
            className="max-w-none block"
            style={{ height: "100%", width: "auto" }}
          />
        </div>
        {/* Gradient: image peeks at top and bottom, heavy black covers the centred text zone */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.92) 22%, rgba(0,0,0,0.95) 55%, rgba(0,0,0,0.78) 72%, rgba(0,0,0,0.28) 88%, rgba(0,0,0,0.1) 100%)",
          }}
        />
      </div>

    </section>
  );
}
