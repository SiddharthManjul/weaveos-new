import Link from "next/link";
import { LandingNav } from "@/components/LandingNav";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "Blog — WeaveOS",
  description: "Thinking on AI pricing, agent economics, and the infrastructure behind outcome-based billing.",
};

/* ── Cover art components (CSS-only, same dark aesthetic) ─────────────── */

function CoverCost() {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: "#080810" }}>
      {/* Radial glow */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 60% at 20% 110%, rgba(48,100,255,0.18) 0%, transparent 60%)" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 40% 40% at 80% -10%, rgba(48,100,255,0.1) 0%, transparent 60%)" }} />
      {/* Dot grid */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dots-cost" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="rgba(48,100,255,0.18)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots-cost)" />
      </svg>
      {/* Cost bars */}
      <svg className="absolute bottom-0 left-0 right-0" height="90" viewBox="0 0 360 90" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        {[
          { x: 20,  h: 28 }, { x: 48,  h: 42 }, { x: 76,  h: 35 },
          { x: 104, h: 55 }, { x: 132, h: 38 }, { x: 160, h: 62 },
          { x: 188, h: 48 }, { x: 216, h: 72 }, { x: 244, h: 56 },
          { x: 272, h: 80 }, { x: 300, h: 65 }, { x: 328, h: 85 },
        ].map((b, i) => (
          <rect key={i} x={b.x} y={90 - b.h} width="18" height={b.h} rx="2"
            fill={`rgba(48,100,255,${0.08 + i * 0.015})`} />
        ))}
      </svg>
      {/* Label */}
      <div className="absolute top-5 left-5">
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(48,100,255,0.6)" }}>Resources</span>
      </div>
    </div>
  );
}

function CoverGuardrails() {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: "#080810" }}>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(48,100,255,0.12) 0%, transparent 70%)" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 30% 30% at 85% 15%, rgba(120,80,255,0.1) 0%, transparent 60%)" }} />
      {/* Concentric rings */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 360 220" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        {[100, 80, 60, 42, 26].map((r, i) => (
          <circle key={i} cx="180" cy="110" r={r} fill="none"
            stroke={`rgba(48,100,255,${0.06 + i * 0.04})`} strokeWidth="1" />
        ))}
        {/* Shield chevron */}
        <path d="M180 78 L200 88 L200 108 Q200 122 180 132 Q160 122 160 108 L160 88 Z"
          fill="none" stroke="rgba(48,100,255,0.35)" strokeWidth="1.5" />
        <path d="M173 108 L178 114 L188 103" stroke="rgba(48,100,255,0.55)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
      <div className="absolute top-5 left-5">
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(48,100,255,0.6)" }}>Resources</span>
      </div>
    </div>
  );
}

function CoverUsageBased() {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: "#080810" }}>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 50% at 50% 100%, rgba(48,100,255,0.16) 0%, transparent 55%)" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 40% 40% at 10% 20%, rgba(30,80,220,0.1) 0%, transparent 60%)" }} />
      {/* Horizontal grid lines */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 360 220" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        {[44, 88, 132, 176].map((y, i) => (
          <line key={i} x1="0" y1={y} x2="360" y2={y} stroke="rgba(48,100,255,0.07)" strokeWidth="1" />
        ))}
        {/* Growth curve */}
        <path d="M0 200 C60 190 100 170 140 140 C180 110 210 72 260 48 C300 28 330 20 360 15"
          fill="none" stroke="rgba(48,100,255,0.5)" strokeWidth="2" />
        {/* Glow under curve */}
        <path d="M0 200 C60 190 100 170 140 140 C180 110 210 72 260 48 C300 28 330 20 360 15 L360 220 L0 220 Z"
          fill="rgba(48,100,255,0.05)" />
        {/* Data points */}
        {[[140,140],[200,98],[260,48],[310,24]].map(([x,y], i) => (
          <circle key={i} cx={x} cy={y} r="3.5" fill="rgba(48,100,255,0.7)" />
        ))}
      </svg>
      <div className="absolute top-5 left-5">
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(48,100,255,0.6)" }}>Resources</span>
      </div>
    </div>
  );
}

function CoverAgentEcon() {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: "#080810" }}>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 50% 50% at 70% 40%, rgba(48,100,255,0.14) 0%, transparent 65%)" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 40% 40% at 20% 80%, rgba(80,40,200,0.1) 0%, transparent 60%)" }} />
      {/* Network nodes */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 360 220" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        {/* Edges */}
        {[
          [180,110, 100,60], [180,110, 260,60], [180,110, 80,160],
          [180,110, 280,160],[180,110, 180,38], [100,60,  180,38],
          [260,60,  180,38], [80,160, 40,200],  [280,160, 320,200],
        ].map(([x1,y1,x2,y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="rgba(48,100,255,0.12)" strokeWidth="1" />
        ))}
        {/* Nodes */}
        {[
          [180,110, 7, 0.55], [100,60,  4.5, 0.35], [260,60,  4.5, 0.35],
          [80,160,  4,   0.3], [280,160, 4,   0.3],  [180,38,  4,   0.3],
          [40,200,  3,   0.2], [320,200, 3,   0.2],
        ].map(([x,y,r,o], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill={`rgba(48,100,255,${o})`} />
        ))}
        {/* Centre ring */}
        <circle cx="180" cy="110" r="12" fill="none" stroke="rgba(48,100,255,0.2)" strokeWidth="1" />
      </svg>
      <div className="absolute top-5 left-5">
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(48,100,255,0.6)" }}>Resources</span>
      </div>
    </div>
  );
}

/* ── Blog data ────────────────────────────────────────────────────────── */
const POSTS = [
  {
    slug: "/resources/ai-task-pricing",
    category: "AI Pricing",
    title: "The Hidden Economics of AI Tasks",
    excerpt: "Every AI workflow carries a cost that isn't fixed, isn't predictable, and in most companies isn't tracked. Here's what that costs you.",
    readTime: "8 min read",
    date: "May 2026",
    Cover: CoverCost,
  },
  {
    slug: "/resources/margin-guardrails",
    category: "Cost Control",
    title: "Margin Guardrails Are the Seatbelts of AI Products",
    excerpt: "Real-time controls that catch cost breaches as they happen — not after the revenue is already locked and the losses are sunk.",
    readTime: "7 min read",
    date: "May 2026",
    Cover: CoverGuardrails,
  },
  {
    slug: "/resources/usage-based-pricing",
    category: "Pricing Strategy",
    title: "Why Usage-Based Pricing Is the Only Model That Scales for AI",
    excerpt: "Seat-based pricing breaks the moment your customers start running agents. Here's the model that actually maps to how AI products are consumed.",
    readTime: "9 min read",
    date: "May 2026",
    Cover: CoverUsageBased,
  },
  {
    slug: "/resources/agent-economics",
    category: "Agent Economy",
    title: "The Economics of AI Agents Are Unlike Anything You Have Priced Before",
    excerpt: "Agents aren't tools. They're economic actors. The pricing models that work for SaaS and APIs fail completely for autonomous multi-step workflows.",
    readTime: "10 min read",
    date: "May 2026",
    Cover: CoverAgentEcon,
  },
];

/* ── Page ─────────────────────────────────────────────────────────────── */
const FeaturedCover = POSTS[0].Cover;

export default function BlogPage() {
  return (
    <div className="min-h-full flex flex-col bg-black text-white">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(30, 60, 180, 0.07) 0%, transparent 70%)" }}
      />

      <LandingNav />

      <div className="relative z-10 w-full flex-1 pt-32 pb-24 px-5">
        <div className="max-w-[1080px] mx-auto">

          {/* Header */}
          <div className="mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#3064FF" }}>
              Blog
            </span>
          </div>
          <h1 className="font-semibold tracking-tight" style={{ fontSize: "clamp(28px, 3.8vw, 42px)", lineHeight: 1.12 }}>
            Thinking out loud.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed max-w-[480px]" style={{ color: "#808080" }}>
            Ideas on AI pricing, agent economics, and the infrastructure that makes
            outcome-based businesses viable.
          </p>

          <div className="mt-8 mb-12" style={{ borderTop: "1px solid #1a1a1a" }} />

          {/* Featured post (first) */}
          <Link href={POSTS[0].slug} className="group block mb-6">
            <div
              className="rounded-2xl overflow-hidden transition-colors"
              style={{ border: "1px solid #1a1a1a", background: "#0a0a0b" }}
            >
              <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr]">
                {/* Cover */}
                <div className="h-[260px] md:h-[300px]">
                  <FeaturedCover />
                </div>
                {/* Content */}
                <div className="flex flex-col justify-center gap-4 p-8 md:p-10">
                  <span
                    className="inline-flex w-fit text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(48,100,255,0.1)", color: "#3064FF", border: "1px solid rgba(48,100,255,0.2)" }}
                  >
                    {POSTS[0].category}
                  </span>
                  <h2
                    className="font-semibold text-white transition-colors group-hover:text-[#d4d4d4]"
                    style={{ fontSize: "clamp(18px, 2vw, 24px)", lineHeight: 1.25 }}
                  >
                    {POSTS[0].title}
                  </h2>
                  <p className="text-[14px] leading-relaxed" style={{ color: "#5a5a5a" }}>
                    {POSTS[0].excerpt}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[12px]" style={{ color: "#3a3a3a" }}>{POSTS[0].readTime}</span>
                    <span style={{ color: "#3064FF", fontSize: 4 }}>●</span>
                    <span className="text-[12px]" style={{ color: "#3a3a3a" }}>{POSTS[0].date}</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* Remaining 3 posts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {POSTS.slice(1).map((post) => {
              const CardCover = post.Cover;
              return (
              <Link key={post.slug} href={post.slug} className="group block">
                <div
                  className="rounded-2xl overflow-hidden flex flex-col h-full transition-colors"
                  style={{ border: "1px solid #1a1a1a", background: "#0a0a0b" }}
                >
                  {/* Cover */}
                  <div className="h-[180px]">
                    <CardCover />
                  </div>
                  {/* Content */}
                  <div className="flex flex-col gap-3 p-6 flex-1">
                    <span
                      className="inline-flex w-fit text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full"
                      style={{ background: "rgba(48,100,255,0.1)", color: "#3064FF", border: "1px solid rgba(48,100,255,0.2)" }}
                    >
                      {post.category}
                    </span>
                    <h2
                      className="font-semibold text-white transition-colors group-hover:text-[#d4d4d4]"
                      style={{ fontSize: "16px", lineHeight: 1.35 }}
                    >
                      {post.title}
                    </h2>
                    <p className="text-[13px] leading-relaxed flex-1" style={{ color: "#5a5a5a" }}>
                      {post.excerpt}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px]" style={{ color: "#3a3a3a" }}>{post.readTime}</span>
                      <span style={{ color: "#3064FF", fontSize: 4 }}>●</span>
                      <span className="text-[11px]" style={{ color: "#3a3a3a" }}>{post.date}</span>
                    </div>
                  </div>
                </div>
              </Link>
              );
            })}
          </div>

        </div>
      </div>

      <Footer />
    </div>
  );
}
