import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, settings } from "@/lib/db/schema";
import { signToken, signPreAuthToken, tokenFingerprint } from "@/lib/auth";
import { log } from "@/lib/logger";
import {
  discoverOidc,
  exchangeCode,
  extractClaims,
  getSsoCallbackUrl,
  type SsoStatePayload,
} from "@/lib/sso";
import { getBaseUrl } from "@/lib/config";

// GET /api/auth/sso/callback?code=...&state=...
// Handles the OIDC provider redirect. Verifies state, exchanges code for tokens,
// finds or creates the matching user, then issues a session (or pre-auth for MFA).
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");
  const providerError = searchParams.get("error");

  const base = getBaseUrl();

  // Provider returned an error (e.g. user cancelled)
  if (providerError) {
    return NextResponse.redirect(new URL("/login?error=sso_cancelled", base));
  }

  if (!code || !returnedState) {
    return NextResponse.redirect(new URL("/login?error=sso_failed", base));
  }

  // ── Verify state cookie ────────────────────────────────────────────────────
  const rawState = req.cookies.get("sso_state")?.value;
  if (!rawState) {
    return NextResponse.redirect(new URL("/login?error=sso_state_expired", base));
  }

  let statePayload: SsoStatePayload;
  try {
    statePayload = JSON.parse(rawState) as SsoStatePayload;
  } catch {
    return NextResponse.redirect(new URL("/login?error=sso_failed", base));
  }

  if (statePayload.state !== returnedState) {
    return NextResponse.redirect(new URL("/login?error=sso_state_mismatch", base));
  }

  try {
    // ── Read SSO config ──────────────────────────────────────────────────────
    const rows = db.select().from(settings).all();
    const cfg = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    const providerUrl = cfg["sso_provider_url"]?.trim();
    const clientId = cfg["sso_client_id"]?.trim();
    const clientSecret = cfg["sso_client_secret"]?.trim();
    const autoCreate = cfg["sso_auto_create_users"] !== "false"; // default true

    if (!providerUrl || !clientId || !clientSecret) {
      return NextResponse.redirect(new URL("/login?error=sso_misconfigured", base));
    }

    // ── Exchange code for tokens ─────────────────────────────────────────────
    const discovery = await discoverOidc(providerUrl);
    const redirectUri = getSsoCallbackUrl();
    const tokens = await exchangeCode(
      discovery,
      clientId,
      clientSecret,
      code,
      redirectUri,
      statePayload.verifier
    );

    // ── Verify id_token and extract claims ───────────────────────────────────
    const claims = await extractClaims(tokens.id_token, discovery, clientId);

    const { sub, email, name, preferred_username, given_name, family_name } = claims;
    if (!sub) {
      return NextResponse.redirect(new URL("/login?error=sso_no_sub", base));
    }

    // Require email — used for display and as fallback matching key
    if (!email) {
      return NextResponse.redirect(new URL("/login?error=sso_no_email", base));
    }

    // ── Find or create user ──────────────────────────────────────────────────
    // Match ONLY by externalId (the OIDC sub claim) — a stable, provider-issued ID.
    // Email-based fallback linking is intentionally excluded: if an IdP allows email
    // changes, or if two providers issue the same email to different people, email
    // matching would allow account takeover. Existing local accounts that have never
    // done SSO will need an admin to set their externalId manually via the users table.
    let user = db
      .select()
      .from(users)
      .where(eq(users.externalId, sub))
      .get();

    const now = Math.floor(Date.now() / 1000);

    if (!user) {
      if (!autoCreate) {
        return NextResponse.redirect(new URL("/login?error=sso_no_account", base));
      }

      // Derive a username from the email prefix; ensure uniqueness
      let baseUsername = email.split("@")[0].replace(/[^a-z0-9_.-]/gi, "").slice(0, 30) || "ssouser";
      let username = baseUsername;
      let suffix = 2;
      while (db.select().from(users).where(eq(users.username, username)).get()) {
        username = `${baseUsername}${suffix++}`;
      }

      const displayName =
        name ||
        [given_name, family_name].filter(Boolean).join(" ") ||
        preferred_username ||
        username;

      // SSO-only accounts have an invalid password hash — they can only log in via SSO
      user = db
        .insert(users)
        .values({
          username,
          passwordHash: "!", // invalid hash — verifyPassword always returns false
          displayName,
          email,
          role: "staff",
          isActive: 1,
          ssoProvider: "oidc",
          externalId: sub,
          createdAt: now,
        })
        .returning()
        .get();

      log({
        level: "info",
        category: "auth",
        action: "sso.user_created",
        userId: user!.id,
        username: user!.username,
        metadata: { email, provider: "oidc", sub },
      });
    }

    if (!user) {
      return NextResponse.redirect(new URL("/login?error=sso_failed", base));
    }

    // ── Check account is active ──────────────────────────────────────────────
    if (user.isActive === 0) {
      return NextResponse.redirect(new URL("/login?error=account_inactive", base));
    }

    // ── MFA check (same logic as local login) ────────────────────────────────
    const hasMfaSetUp = user.mfaEnabled === 1 && !!user.mfaSecret;
    const isMfaEnforced = user.mfaEnforced === 1;

    if (isMfaEnforced && !hasMfaSetUp) {
      log({
        level: "warn",
        category: "auth",
        action: "sso.login.mfa_required_not_set_up",
        userId: user.id,
        username: user.username,
        metadata: { email },
      });
      return NextResponse.redirect(new URL("/login?error=mfa_required", base));
    }

    // Clear the state cookie before issuing the session
    const clearState = (res: NextResponse) => {
      res.cookies.set("sso_state", "", { maxAge: 0, path: "/" });
      return res;
    };

    if (hasMfaSetUp) {
      // Issue pre-auth token — user must complete TOTP before getting a session
      const preAuthToken = await signPreAuthToken({
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role ?? "staff",
        mfaPending: true,
      });

      const response = NextResponse.redirect(new URL("/login?step=mfa", base));
      response.cookies.set("preauth", preAuthToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 5,
      });
      return clearState(response);
    }

    // ── Issue full session ────────────────────────────────────────────────────
    const token = await signToken({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role ?? "staff",
      pwdAt: user.passwordChangedAt ?? undefined,
    });

    log({
      level: "info",
      category: "auth",
      action: "sso.login.success",
      userId: user.id,
      username: user.username,
      metadata: { email, provider: "oidc", tokenFingerprint: tokenFingerprint(token) },
    });

    const response = NextResponse.redirect(new URL("/dashboard", base));
    response.cookies.set("session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return clearState(response);
  } catch (err) {
    console.error("[sso/callback]", err);
    return NextResponse.redirect(new URL("/login?error=sso_failed", base));
  }
}
