/**
 * OIDC / OAuth2 helpers for SSO login.
 *
 * Flow:
 *   1. /api/auth/sso/start  — discover endpoints, generate PKCE + state, redirect to provider
 *   2. /api/auth/sso/callback — verify state, exchange code, verify id_token, find/create user
 *
 * Uses jose (already in the project) for JWKS-based id_token verification.
 * No extra dependencies required.
 */

import { createRemoteJWKSet, jwtVerify } from "jose";
import { getBaseUrl } from "@/lib/config";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OidcDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
}

export interface OidcClaims {
  sub: string;                  // stable unique identifier from the provider
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
}

export interface SsoStatePayload {
  state: string;
  verifier: string;
}

// ─── Discovery ───────────────────────────────────────────────────────────────

// Simple in-process cache: provider URL → discovery doc (valid for 1 hour)
const discoveryCache = new Map<string, { doc: OidcDiscovery; fetchedAt: number }>();

export async function discoverOidc(providerUrl: string): Promise<OidcDiscovery> {
  const cached = discoveryCache.get(providerUrl);
  if (cached && Date.now() - cached.fetchedAt < 3_600_000) {
    return cached.doc;
  }

  const base = providerUrl.replace(/\/$/, "");
  const url = `${base}/.well-known/openid-configuration`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OIDC discovery failed for ${url}: HTTP ${res.status}`);
  }
  const doc = (await res.json()) as OidcDiscovery;
  discoveryCache.set(providerUrl, { doc, fetchedAt: Date.now() });
  return doc;
}

// ─── PKCE ────────────────────────────────────────────────────────────────────

function base64url(buf: Uint8Array): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const verifier = base64url(raw);
  const hashed = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  const challenge = base64url(new Uint8Array(hashed));
  return { verifier, challenge };
}

export function generateState(): string {
  const raw = new Uint8Array(16);
  crypto.getRandomValues(raw);
  return base64url(raw);
}

// ─── Authorization URL ────────────────────────────────────────────────────────

export function buildAuthUrl(
  discovery: OidcDiscovery,
  clientId: string,
  redirectUri: string,
  state: string,
  codeChallenge: string
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${discovery.authorization_endpoint}?${params.toString()}`;
}

// ─── Token Exchange ───────────────────────────────────────────────────────────

export async function exchangeCode(
  discovery: OidcDiscovery,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
  codeVerifier: string
): Promise<{ id_token: string; access_token: string }> {
  const res = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed (HTTP ${res.status}): ${body}`);
  }

  return res.json() as Promise<{ id_token: string; access_token: string }>;
}

// ─── Claims Verification ──────────────────────────────────────────────────────

// JWKS sets are cached by jose internally, but we also cache the RemoteJWKSet
// object per jwks_uri to avoid recreating it on every request.
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function extractClaims(
  idToken: string,
  discovery: OidcDiscovery,
  clientId: string
): Promise<OidcClaims> {
  let JWKS = jwksCache.get(discovery.jwks_uri);
  if (!JWKS) {
    JWKS = createRemoteJWKSet(new URL(discovery.jwks_uri));
    jwksCache.set(discovery.jwks_uri, JWKS);
  }

  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: discovery.issuer,
    audience: clientId,
  });

  return payload as unknown as OidcClaims;
}

// ─── Redirect URI ─────────────────────────────────────────────────────────────

export function getSsoCallbackUrl(): string {
  return `${getBaseUrl()}/api/auth/sso/callback`;
}
