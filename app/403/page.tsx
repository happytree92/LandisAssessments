import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="text-center space-y-4">
        <p className="text-6xl font-bold text-[#1e40af]">403</p>
        <h1 className="text-xl font-semibold text-[#0f172a]">Access Denied</h1>
        <p className="text-sm text-[#94a3b8]">
          You don&apos;t have permission to view this page.
        </p>
        <Link
          href="/dashboard"
          className="inline-block mt-2 text-sm text-[#1e40af] hover:underline"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
