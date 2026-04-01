import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, assessments, users } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DeleteCustomerButton } from "@/components/customers/DeleteCustomerButton";

function formatDate(unix: number | null): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 75
      ? "bg-[#10b981] text-white"
      : score >= 50
      ? "bg-[#f59e0b] text-white"
      : "bg-[#ef4444] text-white";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {score}
    </span>
  );
}

type Props = { params: Promise<{ id: string }> };

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const customerId = parseInt(id, 10);
  if (isNaN(customerId)) notFound();

  const customer = db.select().from(customers).where(eq(customers.id, customerId)).get();
  if (!customer) notFound();

  const history = db
    .select({
      id: assessments.id,
      templateId: assessments.templateId,
      overallScore: assessments.overallScore,
      createdAt: assessments.createdAt,
      conductorName: users.displayName,
    })
    .from(assessments)
    .leftJoin(users, eq(assessments.conductedBy, users.id))
    .where(eq(assessments.customerId, customerId))
    .orderBy(desc(assessments.createdAt))
    .all();

  const templateLabel = (id: string) =>
    id === "security" ? "Security Assessment" : "New Customer Onboarding";

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Back link */}
      <Link href="/customers" className="text-sm text-[#94a3b8] hover:text-[#334155]">
        ← All Customers
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mt-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">{customer.name}</h1>
          <div className="mt-1 space-y-0.5 text-sm text-[#94a3b8]">
            {customer.contactName && <p>{customer.contactName}</p>}
            {customer.contactEmail && (
              <p>
                <a href={`mailto:${customer.contactEmail}`} className="hover:text-[#334155]">
                  {customer.contactEmail}
                </a>
              </p>
            )}
            <p>Added {formatDate(customer.createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={`/assessments/new?customerId=${customer.id}`}>
            <Button className="bg-[#1e40af] hover:bg-[#1e3a8a] text-white">
              New Assessment
            </Button>
          </Link>
          <Link href={`/customers/${customer.id}/edit`}>
            <Button variant="outline">Edit</Button>
          </Link>
          <DeleteCustomerButton customerId={customer.id} customerName={customer.name} />
        </div>
      </div>

      {/* Notes */}
      {customer.notes && (
        <Card className="border border-neutral-200 shadow-sm rounded-lg mb-6">
          <CardHeader className="pb-2">
            <h2 className="text-sm font-semibold text-[#334155] uppercase tracking-wide">
              Notes
            </h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[#334155] whitespace-pre-wrap">{customer.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Assessment History */}
      <Card className="border border-neutral-200 shadow-sm rounded-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#334155] uppercase tracking-wide">
              Assessment History
            </h2>
            <span className="text-xs text-[#94a3b8]">
              {history.length} {history.length === 1 ? "assessment" : "assessments"}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[#94a3b8]">No assessments yet.</p>
              <Link href={`/assessments/new?customerId=${customer.id}`}>
                <Button className="mt-4 bg-[#1e40af] hover:bg-[#1e3a8a] text-white" size="sm">
                  Start First Assessment
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-[#94a3b8] text-xs uppercase tracking-wide">
                    <th className="text-left pb-2 font-medium">Date</th>
                    <th className="text-left pb-2 font-medium">Template</th>
                    <th className="text-left pb-2 font-medium">Conducted By</th>
                    <th className="text-left pb-2 font-medium">Score</th>
                    <th className="text-right pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {history.map((a) => (
                    <tr key={a.id} className="hover:bg-neutral-50">
                      <td className="py-3 text-[#334155]">{formatDate(a.createdAt)}</td>
                      <td className="py-3 text-[#334155]">{templateLabel(a.templateId)}</td>
                      <td className="py-3 text-[#334155]">{a.conductorName ?? "—"}</td>
                      <td className="py-3">
                        <ScoreBadge score={a.overallScore} />
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          href={`/assessments/${a.id}`}
                          className="text-[#1e40af] hover:underline text-xs font-medium"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
