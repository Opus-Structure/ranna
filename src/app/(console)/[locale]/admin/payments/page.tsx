import { ExternalLink } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { PaymentReview } from "@/components/admin/payment-review";
import { PageHeader } from "@/components/console/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { initLocale } from "@/i18n/server";
import { listPayments } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { signedUrl } from "@/lib/storage/objects";
import { cn } from "@/lib/utils";

const statusTone = {
  pending: "text-muted-foreground",
  pending_review: "text-primary",
  succeeded: "text-state-ready",
  failed: "text-destructive",
  rejected: "text-destructive",
} as const;

export default async function AdminPaymentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await initLocale(params);
  const user = await requireAdmin(locale);
  const t = await getTranslations("admin.payments");
  const tb = await getTranslations("billing.invoices.providers");
  const format = await getFormatter();
  const { pending, recent } = await listPayments(user.id);
  // Receipts sit in a private bucket; links are signed per render and expire in 5 minutes.
  const receiptLinks = await Promise.all(
    pending.map((p) =>
      p.receiptPath ? signedUrl("receipts", p.receiptPath) : Promise.resolve(null),
    ),
  );

  return (
    <>
      <PageHeader title={t("title")} />

      <section aria-labelledby="pending" className="mb-12">
        <h2 id="pending" className="mb-4 font-display text-xl font-semibold">
          {t("pending")}
          {pending.length ? (
            <span
              className="ms-3 rounded-full bg-primary px-2.5 py-0.5 align-middle text-sm text-primary-foreground"
              data-numeric
            >
              {pending.length}
            </span>
          ) : null}
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-muted-foreground">
            {t("pendingEmpty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((p, i) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border bg-card p-5"
              >
                <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground">{t("merchant")}</dt>
                    <dd className="font-semibold">{p.merchant}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("plan")}</dt>
                    <dd>
                      {p.plan} · <span dir="ltr">{p.invoice}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("amount")}</dt>
                    <dd className="font-semibold" data-numeric>
                      {formatMoney(p.amountMinor, p.currency, locale)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("submitted")}</dt>
                    <dd>{format.dateTime(p.createdAt, "short")}</dd>
                  </div>
                  {p.reference ? (
                    <div className="col-span-2 sm:col-span-4">
                      <dt className="text-muted-foreground">{t("reference")}</dt>
                      <dd dir="auto">{p.reference}</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="flex flex-wrap items-center gap-3">
                  {receiptLinks[i] ? (
                    <a
                      href={receiptLinks[i]!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      <ExternalLink className="size-4" aria-hidden />
                      {t("viewReceipt")}
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">{t("noReceipt")}</span>
                  )}
                  <PaymentReview paymentId={p.id} shop={p.merchant} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="recent">
        <h2 id="recent" className="mb-4 font-display text-xl font-semibold">
          {t("recent")}
        </h2>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("merchant")}</TableHead>
                <TableHead>{t("amount")}</TableHead>
                <TableHead>{t("provider")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{format.dateTime(p.createdAt, "short")}</TableCell>
                  <TableCell className="font-medium">{p.merchant}</TableCell>
                  <TableCell>{formatMoney(p.amountMinor, p.currency, locale)}</TableCell>
                  <TableCell>{tb(p.provider)}</TableCell>
                  <TableCell className={cn("font-semibold", statusTone[p.status])}>
                    {t(`statuses.${p.status}`)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </>
  );
}
