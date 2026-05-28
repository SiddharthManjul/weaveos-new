// Display formatters for SUI base units, addresses, and timestamps.
// Kept in one place so dashboard cards stay consistent.

/** 1 SUI = 1_000_000_000 MIST (base units). */
export const SUI_DECIMALS = 9;

/** Format a base-unit amount as `0.1234 SUI` with 4-decimal precision. */
export function formatSui(baseUnits: number | bigint): string {
  const n = typeof baseUnits === "bigint" ? Number(baseUnits) : baseUnits;
  const sui = n / 10 ** SUI_DECIMALS;
  return `${sui.toLocaleString(undefined, { maximumFractionDigits: 4 })} SUI`;
}

/** Shorten a Sui address / object ID to `0xabcd…ef01`. */
export function shortenAddress(addr: string, head = 6, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/** Relative time string like "3 mins ago", "yesterday", etc. */
export function relativeTime(timestampMs: number): string {
  if (!timestampMs) return "";
  const delta = Date.now() - timestampMs;
  const sec = Math.floor(delta / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  return new Date(timestampMs).toLocaleDateString();
}

/** Margin pct as `+12.3%` / `-4.5%`. Returns `—` if revenue is zero. */
export function marginPercent(revenue: number, margin: number): string {
  if (!revenue) return "—";
  const pct = (margin / revenue) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}
