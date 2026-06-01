"use client";

// Google redirects here with `id_token=<JWT>` in the URL fragment (because
// our auth request used response_type=id_token, which always uses the
// fragment for security). This page:
//
//   1. Extracts the JWT from window.location.hash
//   2. Reads the ephemeral state stashed before the redirect
//   3. POSTs to /api/auth/zklogin/prove to get the zkProof + Sui address
//   4. Stores the full session in localStorage
//   5. Navigates back to /dashboard

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ZKLOGIN_PENDING_KEY,
  ZKLOGIN_SESSION_KEY,
} from "@/components/ZkLoginButton";

export default function ZkLoginCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"working" | "error">("working");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // 1. Pull id_token out of the URL fragment.
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;
        const fragmentParams = new URLSearchParams(hash);
        const idToken = fragmentParams.get("id_token");
        if (!idToken) {
          throw new Error("no id_token in URL fragment — did Google redirect correctly?");
        }

        // 2. Read the ephemeral state we stashed before redirecting.
        const pendingRaw = sessionStorage.getItem(ZKLOGIN_PENDING_KEY);
        if (!pendingRaw) {
          throw new Error("no pending zkLogin state — sessionStorage was cleared between redirects");
        }
        const pending = JSON.parse(pendingRaw) as {
          ephemeralPrivkey: string;
          ephemeralPubkeyB64: string;
          maxEpoch: number;
          jwtRandomness: string;
          next?: string;
        };

        // 3. Ask the server to call the prover + derive the Sui address.
        const proveResp = await fetch("/api/auth/zklogin/prove", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jwt: idToken,
            ephemeralPublicKey: pending.ephemeralPubkeyB64,
            maxEpoch: pending.maxEpoch,
            jwtRandomness: pending.jwtRandomness,
          }),
        });
        const proveJson = await proveResp.json();
        if (!proveResp.ok) {
          throw new Error(proveJson.error ?? `prove ${proveResp.status}`);
        }

        // 4. Persist the full session.
        const session = {
          ephemeralPrivkey: pending.ephemeralPrivkey,
          suiAddress: proveJson.suiAddress,
          zkProofInputs: proveJson.zkProofInputs,
          maxEpoch: pending.maxEpoch,
          jwt: idToken,
          sub: proveJson.sub,
          email: proveJson.email,
          name: proveJson.name,
          picture: proveJson.picture,
          createdAtMs: Date.now(),
        };
        localStorage.setItem(ZKLOGIN_SESSION_KEY, JSON.stringify(session));
        sessionStorage.removeItem(ZKLOGIN_PENDING_KEY);

        // 5. Bounce back to the app — to wherever the sign-in flow targeted.
        //    Validate that `next` is a relative path so we can't be redirected
        //    off-site by tampering with sessionStorage.
        const safeNext =
          pending.next && pending.next.startsWith("/") && !pending.next.startsWith("//")
            ? pending.next
            : "/dashboard";
        router.replace(safeNext);
      } catch (e) {
        setError((e as Error).message);
        setStatus("error");
      }
    })();
    // Run exactly once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white px-6">
      {status === "working" ? (
        <>
          <div className="text-[14px] font-semibold mb-2">Completing sign-in…</div>
          <p className="text-[12px] text-[#5a5a5a] max-w-md text-center">
            Calling the Mysten zkLogin prover. This takes 3–8 seconds. We&apos;re
            generating the zero-knowledge proof that binds your Google identity to
            an ephemeral Sui key.
          </p>
        </>
      ) : (
        <>
          <div className="text-[14px] font-semibold text-[#f87171] mb-2">Sign-in failed</div>
          <p className="text-[12px] text-[#fca5a5] max-w-md text-center font-mono break-all">
            {error}
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-4 px-4 py-2 rounded-full text-[12px] bg-[#1e1e1e] border border-[#272727] text-[#a3a3a3] hover:text-white"
          >
            Back to dashboard
          </button>
        </>
      )}
    </div>
  );
}
