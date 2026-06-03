// Root-level App Router loading UI. Next.js shows this whenever a route
// segment is loading on the server (RSC streaming, dynamic params, etc).

import { LogoLoader } from "@/components/LogoLoader";

export default function Loading() {
  return (
    <div className="flex items-center justify-center w-full h-full min-h-screen bg-[#101010]">
      <LogoLoader size={56} label="Loading" />
    </div>
  );
}
