// Reusable skeleton building blocks. All variants use the shared `.skeleton`
// class from globals.css for the shimmer animation.
//
// Compose these for any loading state — see e.g. /workflows page.tsx for a
// table-shaped loader, /dashboard for card-shaped loaders.

import { type CSSProperties } from "react";

type BaseProps = {
  className?: string;
  style?: CSSProperties;
};

/** A solid shimmering block. Default = 1em tall, full width. */
export function Skeleton({ className = "", style }: BaseProps) {
  return <div className={`skeleton rounded-md ${className}`} style={style} />;
}

/** A short shimmering text line. */
export function SkeletonText({
  width = "100%",
  height = 12,
  className = "",
}: {
  width?: string | number;
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={`skeleton rounded-md ${className}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: `${height}px`,
      }}
    />
  );
}

/** Circular avatar/icon skeleton. */
export function SkeletonCircle({ size = 28 }: { size?: number }) {
  return (
    <div
      className="skeleton rounded-full shrink-0"
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}

/** Card-shaped skeleton with optional header + body lines. */
export function SkeletonCard({
  headerHeight = 14,
  bodyLines = 2,
  className = "",
}: {
  headerHeight?: number;
  bodyLines?: number;
  className?: string;
}) {
  return (
    <div
      className={`bg-[#171718] border border-[#1e1e1e] rounded-[20px] px-5 py-4 flex flex-col gap-2.5 ${className}`}
    >
      <SkeletonText width="40%" height={headerHeight} />
      {Array.from({ length: bodyLines }).map((_, i) => (
        <SkeletonText
          key={i}
          width={i === bodyLines - 1 ? "60%" : "90%"}
          height={11}
        />
      ))}
    </div>
  );
}

/** Metric/stat card skeleton — matches the dashboard's stat cards. */
export function SkeletonStatCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-[#171718] border border-[#1e1e1e] rounded-[20px] px-5 py-4 flex flex-col gap-2 ${className}`}
    >
      <SkeletonText width={80} height={10} />
      <SkeletonText width={120} height={22} />
      <SkeletonText width={140} height={10} />
    </div>
  );
}

/** Table-row skeleton — set columns via `cols` array of widths (% or px). */
export function SkeletonRow({
  cols = ["30%", "20%", "15%", "20%", "15%"],
  className = "",
}: {
  cols?: Array<string | number>;
  className?: string;
}) {
  return (
    <div
      className={`grid items-center gap-x-4 px-6 py-3.5 border-t border-dashed border-[#272727] ${className}`}
      style={{ gridTemplateColumns: cols.map((c) => (typeof c === "number" ? `${c}px` : c)).join(" ") }}
    >
      {cols.map((_, i) => (
        <SkeletonText key={i} width={i === 0 ? "85%" : "65%"} height={12} />
      ))}
    </div>
  );
}

/** Avatar + two-line text — for chat-style member rows. */
export function SkeletonMember() {
  return (
    <div className="flex items-center gap-3 py-2">
      <SkeletonCircle size={28} />
      <div className="flex flex-col gap-1.5 flex-1">
        <SkeletonText width="40%" height={11} />
        <SkeletonText width="60%" height={10} />
      </div>
    </div>
  );
}
