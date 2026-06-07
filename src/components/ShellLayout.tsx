"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { RouteTransitionLoader } from "./RouteTransitionLoader";

export function ShellLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Landing, marketing, and OAuth flow pages — render without shell.
  // /auth/* is critical: the callback page must not share the Sidebar with
  // /dashboard, otherwise the user chip mounts before the cookie is set and
  // can't recover when the post-OAuth redirect lands.
  if (pathname === "/" || pathname.startsWith("/auth") || pathname.startsWith("/resources") || pathname === "/changelog" || pathname === "/about" || pathname === "/contact" || pathname === "/blog" || pathname === "/pricing" || pathname === "/privacy" || pathname === "/terms" || pathname === "/security") {
    return (
      <div className="flex-1 overflow-y-auto bg-black">
        {children}
      </div>
    );
  }

  // Docs pages — DocsLayout manages its own scroll
  if (pathname.startsWith("/docs")) {
    return (
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Logo overlay during route transitions */}
      <RouteTransitionLoader />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav onMenuClick={() => setSidebarOpen(true)} />
        {/* Bottom margin reserves space for the mobile floating bar (search +
            bell). Arbitrary `calc()` with env(safe-area-inset-bottom) handles
            notched phones; `md:mb-5` overrides for desktop where the floating
            bar is hidden. */}
        <main className="flex flex-1 flex-col overflow-hidden bg-[#101010] mx-3 mb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] rounded-2xl md:ml-0 md:mr-5 md:mb-5">
          {children}
        </main>
      </div>
    </div>
  );
}
