// /api/auth/zklogin/signout — clear the identity cookie.
//
// Called by the client when the user clicks "Sign out". The client is also
// responsible for purging its localStorage (ephemeralPrivkey + zkProof);
// this route only handles the server-readable half of the session.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { WEAVEOS_USER_COOKIE } from "@/lib/weaveos/session";

export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  const store = await cookies();
  store.delete(WEAVEOS_USER_COOKIE);
  return NextResponse.json({ ok: true });
}
