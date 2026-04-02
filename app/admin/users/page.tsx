import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { UsersManager } from "@/components/admin/UsersManager";

export const dynamic = "force-dynamic";

function formatDate(unix: number | null): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AdminUsersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")!.value;
  const session = await verifyToken(token);

  const allUsers = db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      isActive: users.isActive,
      mfaEnabled: users.mfaEnabled,
      mfaEnforced: users.mfaEnforced,
      ssoProvider: users.ssoProvider,
      createdAt: users.createdAt,
    })
    .from(users)
    .all();

  const rows = allUsers.map((u) => ({
    ...u,
    ssoProvider: u.ssoProvider ?? null,
    createdAtFormatted: formatDate(u.createdAt),
  }));

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#0f172a]">Users</h1>
        <p className="text-sm text-[#94a3b8] mt-1">
          Manage staff accounts. Only admins can access this page.
        </p>
      </div>

      <UsersManager users={rows} currentUserId={session.userId} />
    </div>
  );
}
