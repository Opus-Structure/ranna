import { Search } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { MerchantRowActions } from "@/components/admin/merchant-row-actions";
import { MerchantStatusBadge } from "@/components/console/merchant-status-badge";
import { PageHeader } from "@/components/console/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { initLocale } from "@/i18n/server";
import { listMerchants, merchantStatuses, type MerchantStatusFilter } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminMerchantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const locale = await initLocale(params);
  const user = await requireAdmin(locale);
  const { q, status } = await searchParams;
  const statusFilter = merchantStatuses.includes(status as MerchantStatusFilter)
    ? (status as MerchantStatusFilter)
    : undefined;
  const t = await getTranslations("admin");
  const format = await getFormatter();
  const rows = await listMerchants(user.id, { q, status: statusFilter });

  return (
    <>
      <PageHeader title={t("merchants.title")} />
      {/* A plain GET form: filters live in the URL, work without JavaScript and can be shared. */}
      <form className="mb-5 flex flex-wrap items-end gap-3" role="search">
        <div className="relative min-w-[14rem] flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder={t("merchants.search")}
            aria-label={t("merchants.search")}
            className="h-10 ps-9"
          />
        </div>
        <select
          name="status"
          defaultValue={statusFilter ?? ""}
          aria-label={t("merchants.columns.status")}
          className="h-10 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-ring"
        >
          <option value="">{t("merchants.filterAll")}</option>
          {merchantStatuses.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" className="h-10">
          <Search aria-hidden />
          <span className="sr-only">{t("merchants.search")}</span>
        </Button>
      </form>
      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
        {t("merchants.results", { count: rows.length })}
      </p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-muted-foreground">
          {t("merchants.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("merchants.columns.name")}</TableHead>
                <TableHead>{t("merchants.columns.link")}</TableHead>
                <TableHead>{t("merchants.columns.status")}</TableHead>
                <TableHead>{t("merchants.columns.plan")}</TableHead>
                <TableHead>{t("merchants.columns.periodEnd")}</TableHead>
                <TableHead>{t("merchants.columns.created")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("merchants.actions", { shop: "" })}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.slug ? <span dir="ltr">/s/{m.slug}</span> : t("merchants.noSlug")}
                  </TableCell>
                  <TableCell>
                    <MerchantStatusBadge status={m.status} />
                  </TableCell>
                  <TableCell>{m.plan ?? t("merchants.noPlan")}</TableCell>
                  <TableCell>{m.periodEnd ? format.dateTime(m.periodEnd, "short") : "–"}</TableCell>
                  <TableCell>{format.dateTime(m.createdAt, "short")}</TableCell>
                  <TableCell className="text-end">
                    <MerchantRowActions
                      merchantId={m.id}
                      name={m.name}
                      suspended={m.status === "suspended"}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
