import { desc, eq } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { MerchantStatusBadge } from "@/components/console/merchant-status-badge";
import { PageHeader } from "@/components/console/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/guards";
import { withRls } from "@/lib/db/client";
import { merchants, plans } from "@/lib/db/schema";
import { initLocale } from "@/i18n/server";

export default async function AdminMerchantsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await initLocale(params);
  const user = await requireAdmin(locale);
  const t = await getTranslations("admin.merchants");
  const format = await getFormatter();
  // Read through RLS: the admin policy (is_platform_admin) is what grants cross-tenant reads.
  const rows = await withRls(user.id, (tx) =>
    tx
      .select({
        id: merchants.id,
        name: merchants.name,
        slug: merchants.slug,
        status: merchants.status,
        periodEnd: merchants.periodEnd,
        createdAt: merchants.createdAt,
        plan: plans.name,
      })
      .from(merchants)
      .leftJoin(plans, eq(plans.id, merchants.planId))
      .orderBy(desc(merchants.createdAt))
      .limit(200),
  );

  return (
    <>
      <PageHeader title={t("title")} />
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.name")}</TableHead>
                <TableHead>{t("columns.link")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead>{t("columns.plan")}</TableHead>
                <TableHead>{t("columns.periodEnd")}</TableHead>
                <TableHead>{t("columns.created")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.slug ? <span dir="ltr">/s/{m.slug}</span> : t("noSlug")}
                  </TableCell>
                  <TableCell>
                    <MerchantStatusBadge status={m.status} />
                  </TableCell>
                  <TableCell>{m.plan ?? t("noPlan")}</TableCell>
                  <TableCell>{m.periodEnd ? format.dateTime(m.periodEnd, "short") : "–"}</TableCell>
                  <TableCell>{format.dateTime(m.createdAt, "short")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
