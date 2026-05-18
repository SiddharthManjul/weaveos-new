"use client";

/* ─────────────────────────────────────────────────────────────────
   FeatureSplitSection
   Two alternating rows: [text | card] then [card | text]
   ───────────────────────────────────────────────────────────────── */

/* Gradient-border pill — consistent with all section badges */
function OutlineBadge({ label }: { label: string }) {
  return (
    <div className="inline-flex w-fit rounded-full p-[1px]" style={{ background: "linear-gradient(135deg, #1a1a1a, #2e2e2e)" }}>
      <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#111113]">
        <span className="text-[#3064FF] text-[13px] font-medium">{label}</span>
      </div>
    </div>
  );
}

/* Gradient-border pill with a "New" chip embedded at the start */
function NewOutlineBadge({ label }: { label: string }) {
  return (
    <div className="inline-flex w-fit rounded-full p-[1px]" style={{ background: "linear-gradient(135deg, #1a1a1a, #2e2e2e)" }}>
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111113]">
        <span
          className="text-[10px] font-bold text-white leading-none px-1.5 py-[3px] rounded-full"
          style={{ background: "#3064FF" }}
        >
          New
        </span>
        <span className="text-[#3064FF] text-[13px] font-medium">{label}</span>
      </div>
    </div>
  );
}

function CtaButton() {
  return (
    <a
      href="/dashboard"
      className="group relative mt-2 self-start flex items-center gap-2 sm:gap-3 rounded-full overflow-hidden
                 pt-[6px] pb-[6px] pl-[14px] pr-[3px]
                 sm:pt-[9px] sm:pb-[9px] sm:pl-5 sm:pr-[3px]"
      style={{ background: "#3064FF", border: "2px solid #3064FF" }}
    >
      {/* Black fill — expands from circle */}
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

function ImageCard({ src }: { src?: string }) {
  return (
    <div
      className="w-full rounded-[20px] overflow-hidden"
      style={{ background: "#0f0f11", border: "1px solid #1e1e1e", minHeight: src ? undefined : 360 }}
    >
      {src
        ? <img src={src} alt="" className="w-full h-auto block" />
        : <div className="min-h-[360px] lg:min-h-[400px]" />
      }
    </div>
  );
}

export function FeatureSplitSection() {
  return (
    <div className="relative z-10 w-full bg-black">

      {/* ── Row 1: Text LEFT  |  Card RIGHT ────────────────────── */}
      <div className="max-w-[1200px] mx-auto px-5 pt-20 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* Text */}
          <div className="flex flex-col gap-5">
            <div>
              <OutlineBadge label="Live Quotes" />
            </div>
            <h2
              className="font-bold text-white leading-[1.14] tracking-tight"
              style={{ fontSize: "clamp(28px, 3.2vw, 40px)" }}
            >
              Price Work Before<br />Execution
            </h2>
            <p
              className="text-[16px] leading-relaxed max-w-[480px]"
              style={{ color: "#808080" }}
            >
              Estimate the true cost of every AI task before it runs, including
              model usage, tool calls, retries, and human fallback. Give agents
              a profitable quote upfront instead of relying on flat pricing or
              post-hoc billing.
            </p>
            <CtaButton />
          </div>

          {/* Card */}
          <ImageCard src="/frame162.png" />
        </div>
      </div>

      {/* ── Row 2: Card LEFT  |  Text RIGHT ────────────────────── */}
      <div className="max-w-[1200px] mx-auto px-5 pt-12 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* Card — on mobile, push below text (order-2 → order-1 on lg) */}
          <div className="order-2 lg:order-1">
            <ImageCard src="/frame163.png" />
          </div>

          {/* Text */}
          <div className="flex flex-col gap-5 order-1 lg:order-2">
            <div>
              <NewOutlineBadge label="Profit Control" />
            </div>
            <h2
              className="font-bold text-white leading-[1.14] tracking-tight"
              style={{ fontSize: "clamp(28px, 3.2vw, 40px)" }}
            >
              Protect Margin<br />In Real Time
            </h2>
            <p
              className="text-[16px] leading-relaxed max-w-[480px]"
              style={{ color: "#808080" }}
            >
              Track execution spend as the workflow runs and catch cost spikes
              before they hurt your margins. Set budget limits, margin floors,
              and escalation rules so agents can stop, reroute, or ask for
              approval when a task starts going underwater.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}
