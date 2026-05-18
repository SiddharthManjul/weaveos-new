/* ─────────────────────────────────────────────────────────────────
   Global CTA — bottom-of-page section
   Left: badge + heading + subtitle + button
   Right: visual placeholder (user will populate)
   ───────────────────────────────────────────────────────────────── */

function CtaButton() {
  return (
    <a
      href="/dashboard"
      className="group relative self-start flex items-center gap-2 sm:gap-3 rounded-full overflow-hidden
                 pt-[6px] pb-[6px] pl-[14px] pr-[3px]
                 sm:pt-[9px] sm:pb-[9px] sm:pl-5 sm:pr-[3px]"
      style={{ background: "#3064FF", border: "2px solid #3064FF" }}
    >
      <span
        className="absolute right-[3px] top-1/2 -translate-y-1/2
                   w-[26px] h-[26px] sm:w-[32px] sm:h-[32px]
                   rounded-full bg-black scale-0 group-hover:scale-[14]
                   transition-transform duration-500 ease-in-out"
        aria-hidden="true"
      />
      <span className="relative z-10 text-white font-semibold text-[12px] sm:text-[14px]">
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
  );
}

export function CtaSection() {
  return (
    <section className="relative z-10 w-full bg-black py-20">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* ── Left: text ───────────────────────────────────────── */}
          <div className="flex flex-col gap-6">

            {/* Badge */}
            <div className="inline-flex w-fit rounded-full p-[1px]" style={{ background: "linear-gradient(135deg, #1a1a1a, #2e2e2e)" }}>
              <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-[#111113]">
                <span className="text-[#3064FF] text-[13px] font-medium">Start now</span>
              </div>
            </div>

            {/* Heading */}
            <h2
              className="font-bold text-white tracking-tight"
              style={{ fontSize: "clamp(32px, 4vw, 52px)", lineHeight: 1.1 }}
            >
              Make every AI<br />task worth running.
            </h2>

            {/* Subtitle */}
            <p className="text-[16px] leading-relaxed" style={{ color: "#808080" }}>
              Quote, control, and track margin before agents burn money.
            </p>

            <CtaButton />
          </div>

          {/* ── Right: visual placeholder ─────────────────────────
              User will replace this with a 3D / visual asset.    */}
          <div
            className="w-full rounded-[20px] min-h-[320px] lg:min-h-[380px]"
            style={{ background: "#0f0f11", border: "1px solid #1e1e1e" }}
          />

        </div>
      </div>
    </section>
  );
}
