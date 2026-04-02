import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { MfaPanel } from "@/components/account/MfaPanel";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) redirect("/login");

  let session;
  try {
    session = await verifyToken(token);
  } catch {
    redirect("/login");
  }

  const user = db.select().from(users).where(eq(users.id, session.userId)).get();
  if (!user) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#0f172a]">Account Security</h1>
        <p className="text-sm text-[#94a3b8] mt-1">
          Manage authentication settings for{" "}
          <span className="font-medium text-[#334155]">{user.displayName}</span>
          {" "}({user.username})
        </p>
      </div>

      {/* MFA section */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-[#334155] uppercase tracking-wide mb-1">
          Authenticator App (TOTP)
        </h2>
        <p className="text-sm text-[#94a3b8] mb-5">
          Use Google Authenticator, Authy, or any TOTP-compatible app to add a second
          factor to your login.
        </p>
        <MfaPanel mfaEnabled={user.mfaEnabled === 1} />
      </div>

      {/* Change password */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-[#334155] uppercase tracking-wide mb-1">
          Change Password
        </h2>
        <p className="text-sm text-[#94a3b8] mb-5">
          Enter your current password and choose a new one (minimum 8 characters).
        </p>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
