"use client";

// Diagnostic page for zkLogin Groth16 failures.
// Reads the current localStorage session and runs it through
// /api/auth/zklogin/diagnose so we can see exactly which binding is wrong.
// Also offers a client-side dry-run that builds + signs + simulates a
// minimal transaction with the user's zkLogin signature, surfacing the raw
// validator error instead of the lifecycle's wrapped one.

import { useEffect, useState } from "react";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { getZkLoginSignature } from "@mysten/sui/zklogin";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";

type Report = Record<string, unknown>;

export default function ZkLoginDebugPage() {
  const [session, setSession] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<string | null>(null);
  const [dryRunBusy, setDryRunBusy] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSession(localStorage.getItem("weaveos.zklogin.session"));
    } catch (e) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(`localStorage read failed: ${(e as Error).message}`);
    }
  }, []);

  async function runDiagnose() {
    if (!session) {
      setError("no session in localStorage — sign in first");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = JSON.parse(session);
      const r = await fetch("/api/auth/zklogin/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await r.json()) as Report;
      setReport(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function copyReport() {
    if (!report) return;
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  /**
   * Build the smallest possible transaction (transfer 0 SUI to self), sign
   * it with the zkLogin signature exactly the way the lifecycle does, then
   * dry-run it against testnet. The dry-run goes through the same validator
   * code as a real submission — so its error message is the ground truth.
   */
  async function dryRun() {
    if (!session) return;
    setDryRunBusy(true);
    setDryRunResult(null);
    try {
      const s = JSON.parse(session) as {
        ephemeralPrivkey: string;
        suiAddress: string;
        zkProofInputs: Record<string, unknown>;
        maxEpoch: number;
      };
      const { secretKey } = decodeSuiPrivateKey(s.ephemeralPrivkey);
      const kp = Ed25519Keypair.fromSecretKey(secretKey);
      const client = new SuiJsonRpcClient({
        url: "https://fullnode.testnet.sui.io:443",
        network: "testnet",
      });

      const tx = new Transaction();
      tx.setSender(s.suiAddress);
      // No-op: pay 0 SUI to self.
      const [coin] = tx.splitCoins(tx.gas, [0]);
      tx.transferObjects([coin], s.suiAddress);

      const txBytes = await tx.build({ client });
      const { signature: userSig } = await kp.signTransaction(txBytes);

      const zkLoginSig = getZkLoginSignature({
        inputs: s.zkProofInputs as never,
        maxEpoch: s.maxEpoch,
        userSignature: userSig,
      });

      // Dry-run: doesn't cost gas, returns the validator's verdict.
      const sim = await client.dryRunTransactionBlock({
        transactionBlock: txBytes,
        // Some SDK versions also need the signature for dryRun; if not,
        // it still surfaces signature errors via /api/v1.
      });
      // If we got here without throwing, simulation succeeded (no sig was
      // verified though — dryRun usually skips sig check). Execute for real.
      const exec = await client.executeTransactionBlock({
        transactionBlock: txBytes,
        signature: zkLoginSig,
        options: { showEffects: true },
      }).catch((e: Error) => ({ error: e.message }));

      // Also call Sui's dedicated verifyZkLoginSignature RPC. This goes
      // through the validator's full signature-verification code path and
      // returns *which* check failed (zkLoginSigInvalid vs jwk fetch failure
      // vs aud not whitelisted vs etc.) instead of the bundled "Groth16" error.
      const verifyResp = await fetch("https://fullnode.testnet.sui.io:443", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "sui_verifyZkLoginSignature",
          params: [
            Buffer.from(txBytes).toString("base64"),
            zkLoginSig,
            "TransactionData",
            s.suiAddress,
          ],
        }),
      }).then((r) => r.json()).catch((e: Error) => ({ error: e.message }));

      setDryRunResult(
        JSON.stringify(
          {
            dryRunStatus: sim.effects?.status,
            execAttempt: exec,
            verifyZkLoginRpc: verifyResp,
          },
          null,
          2,
        ),
      );
    } catch (e) {
      setDryRunResult(`THREW: ${(e as Error).message}`);
    } finally {
      setDryRunBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white px-6 py-10">
      <div className="max-w-[800px] mx-auto flex flex-col gap-5">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight">zkLogin diagnostic</h1>
          <p className="text-[#a3a3a3] text-[13px] mt-1">
            Reconstructs every value in your stored session and compares against what the
            validator expects. Use this when you see &ldquo;Groth16 proof verify failed&rdquo;.
          </p>
        </div>

        <div className="bg-[#171718] border border-[#1e1e1e] rounded-xl px-4 py-3">
          <p className="text-[12px] text-[#5a5a5a] mb-1">localStorage session:</p>
          <p className="text-[13px] font-mono">
            {session ? `${session.length} bytes` : "not present"}
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={runDiagnose}
            disabled={!session || loading}
            className="px-4 py-2 rounded-full bg-[#3064FF] hover:bg-[#2050d0] disabled:bg-[#1e1e1e] disabled:text-[#5a5a5a] text-white text-[13px] font-medium transition-colors"
          >
            {loading ? "Diagnosing…" : "Run diagnose"}
          </button>
          <button
            onClick={dryRun}
            disabled={!session || dryRunBusy}
            className="px-4 py-2 rounded-full bg-[#171718] hover:border-[#2a2a2a] border border-[#1e1e1e] disabled:opacity-50 text-white text-[13px] font-medium transition-colors"
          >
            {dryRunBusy ? "Submitting…" : "Submit no-op tx (real signature test)"}
          </button>
        </div>

        {dryRunResult && (
          <div className="bg-[#171718] border border-[#1e1e1e] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1e1e1e]">
              <span className="text-[13px] font-semibold text-white">Dry-run / execute result</span>
            </div>
            <pre className="text-[12px] font-mono text-[#d4d4d4] px-4 py-3 overflow-x-auto whitespace-pre-wrap break-all">
              {dryRunResult}
            </pre>
          </div>
        )}

        {error && (
          <div className="bg-[#3a1818] border border-[#ef4444] rounded-md px-4 py-3 text-[13px] text-[#f87171] font-mono">
            {error}
          </div>
        )}

        {report && (
          <div className="bg-[#171718] border border-[#1e1e1e] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e1e]">
              <span className="text-[13px] font-semibold text-white">Report</span>
              <button
                onClick={copyReport}
                className="text-[12px] text-[#60a5fa] hover:text-[#93c5fd]"
              >
                {copied ? "Copied" : "Copy JSON"}
              </button>
            </div>
            <pre className="text-[12px] font-mono text-[#d4d4d4] px-4 py-3 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(report, null, 2)}
            </pre>

            {/* Highlighted PASS/FAIL summary */}
            <div className="border-t border-[#1e1e1e] px-4 py-3 flex flex-col gap-2 text-[12px]">
              <Line
                label="addressSeed matches computed value"
                ok={report.addressSeedMatch === true}
                detail={report.addressSeedMatch !== true ? "stored != computed → proof bound to wrong seed" : "✓"}
              />
              <Line
                label="suiAddress derived from seed matches stored"
                ok={report.addressMatch === true}
                detail={report.addressMatch !== true ? "address mismatch → tx.sender will be rejected" : "✓"}
              />
              <Line
                label="maxEpoch still valid"
                ok={report.epochValid === true}
                detail={
                  report.epochValid !== true
                    ? `current ${report.currentEpoch} > maxEpoch ${report.sessionMaxEpoch} — sign in again`
                    : "✓"
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Line({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={ok ? "text-[#4ade80]" : "text-[#f87171]"}>{ok ? "✓" : "✗"}</span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[#d4d4d4]">{label}</span>
        <span className="text-[#5a5a5a] text-[11px]">{detail}</span>
      </div>
    </div>
  );
}
