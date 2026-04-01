import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) redirect("/login");

  let role = "staff";
  try {
    const payload = await verifyToken(token);
    role = payload.role;
  } catch {
    redirect("/login");
  }

  if (role !== "admin") {
    redirect("/403");
  }

  return (
    <div className="flex" style={{ minHeight: "calc(100vh - 3.5rem)" }}>
      <AdminSidebar />
      <main className="flex-1 bg-neutral-50 min-w-0">{children}</main>
    </div>
  );
}
