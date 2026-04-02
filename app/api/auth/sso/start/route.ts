import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import {
  discoverOidc,
  generatePkce,
  generateState,
  buildAuthUrl,
  getSsoCallbackUrl,
  type SsoStatePayload,
} from "@/lib/sso";

// GET /api/auth/sso/start
// Initiates the OIDC authorization code flow with PKCE.
// Reads SSO config from admin settings, builds the provider redirect URL,
// stores {state, verifier} in a short-lived httpOnly cookie, then redirects.
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const rows = db.select().from(settings).all();
    const cfg = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    if (cfg["sso_enabled"] !== "true") {
      return NextResponse.redirect(new URL("/login?error=sso_disabled", req.url));
    }

    const providerUrl = cfg["sso_provider_url"]?.trim();
    const clientId = cfg["sso_client_id"]?.trim();
    const clientSecret = cfg["sso_client_secret"]?.trim();

    if (!providerUrl || !clientId || !clientSecret) {
      return NextResponse.redirect(new URL("/login?error=sso_misconfigured", req.url));
    }

    const discovery = await discoverOidc(providerUrl);
    const { verifier, challenge } = await generatePkce();
    const state = generateState();
    const redirectUri = getSsoCallbackUrl();

    const authUrl = buildAuthUrl(discovery, clientId, redirectUri, state, challenge);

    const statePayload: SsoStatePayload = { state, verifier };

    const response = NextResponse.redirect(authUrl);
    response.cookies.set("sso_state", JSON.stringify(statePayload), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10, // 10 minutes to complete the flow
    });
    return response;
  } catch (err) {
    console.error("[sso/start]", err);
    return NextResponse.redirect(new URL("/login?error=sso_failed", req.url));
  }
}
