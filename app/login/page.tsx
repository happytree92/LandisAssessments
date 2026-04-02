import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { LoginForm, SSO_ERRORS } from "@/components/auth/LoginForm";

// Map known ?error= values to human-readable messages.
// SSO_ERRORS covers SSO-specific ones; local login errors come through the
// client-side fetch and never appear as query params.
function resolveError(errorParam: string | undefined): string | undefined {
  if (!errorParam) return undefined;
  return SSO_ERRORS[errorParam] ?? "An error occurred. Please try again.";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; error?: string }>;
}) {
  const params = await searchParams;

  // Read SSO enabled flag from DB — cheap single query
  let ssoEnabled = false;
  try {
    const rows = db.select().from(settings).all();
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    ssoEnabled = map["sso_enabled"] === "true";
  } catch {
    // DB not ready yet on first boot — safe to ignore, SSO button will be hidden
  }

  const initialStep = params.step === "mfa" ? "mfa" : "credentials";
  const initialError = resolveError(params.error);

  return (
    <LoginForm
      ssoEnabled={ssoEnabled}
      initialStep={initialStep}
      initialError={initialError}
    />
  );
}
