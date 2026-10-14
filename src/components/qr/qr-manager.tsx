"use client";

import { Copy, Download, FileText, Loader2, Plus, Printer, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import {
  addRangeAction,
  addTableAction,
  deleteTableAction,
} from "@/app/(console)/[locale]/dashboard/qr/actions";
import { shopFontClass } from "@/app/shop-fonts";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ShopFont } from "@/lib/branding/theme";
import { shopUrl } from "@/lib/qr/matrix";
import {
  buildSheetPdf,
  buildTentPdf,
  resolveFontFamily,
  saveBlob,
  type PrintCard,
  type PrintSpec,
} from "@/lib/qr/print";
import type { TableQr } from "@/lib/qr/service";
import { QrImage } from "./qr-image";

export type PrintSetup = Omit<PrintSpec, "fontFamily"> & { font: ShopFont };

export function QrManager({
  origin,
  slug,
  tables,
  print,
  readOnly,
}: {
  origin: string;
  slug: string;
  tables: TableQr[];
  print: PrintSetup;
  readOnly: boolean;
}) {
  const t = useTranslations("qr");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mainUrl = shopUrl(origin, slug);

  async function makePdf(key: string, build: (spec: PrintSpec) => Promise<Blob>, filename: string) {
    setBusy(key);
    const toastId = toast.loading(t("generating"));
    try {
      const fontFamily = await resolveFontFamily(shopFontClass[print.font]);
      const blob = await build({ ...print, fontFamily });
      saveBlob(blob, filename);
      toast.dismiss(toastId);
    } catch {
      toast.error(t("errors.pdf"), { id: toastId });
    } finally {
      setBusy(null);
    }
  }

  const tent = (card: PrintCard, name: string) =>
    makePdf(`tent-${name}`, (spec) => buildTentPdf(spec, card), `${slug}-${name}-tent.pdf`);

  function act(
    fn: () => Promise<{ ok: boolean; error?: string; field?: string }>,
    form?: HTMLFormElement,
  ) {
    setErrors({});
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        const key = result.error ?? "generic";
        setErrors({ [result.field ?? "form"]: key });
        toast.error(t(`errors.${key}` as "errors.generic"));
        return;
      }
      form?.reset();
      router.refresh();
    });
  }

  function addOne(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const form = event.currentTarget;
    act(
      () =>
        addTableAction({
          label: String(f.get("label") ?? ""),
          tableCode: String(f.get("tableCode") ?? ""),
        }),
      form,
    );
  }

  function addRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    act(() =>
      addRangeAction({
        prefix: String(f.get("prefix") ?? ""),
        from: Number(f.get("from")),
        to: Number(f.get("to")),
      }),
    );
  }

  const downloadLinks = (table?: string) => {
    const q = table ? `&t=${encodeURIComponent(table)}` : "";
    return (
      <>
        <Button asChild variant="outline" size="sm">
          <a href={`/api/qr?format=svg${q}`} download>
            <Download aria-hidden />
            {t("downloads.svg")}
          </a>
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={`/api/qr?format=png${q}`} download>
            <Download aria-hidden />
            {t("downloads.png")}
          </a>
        </Button>
      </>
    );
  };

  const err = (k: string) => (errors[k] ? t(`errors.${errors[k]}` as "errors.generic") : undefined);

  return (
    <div className="flex flex-col gap-12">
      <section
        aria-labelledby="main-qr"
        className="grid gap-8 rounded-xl border bg-card p-6 md:grid-cols-[auto_minmax(0,1fr)]"
      >
        <QrImage
          url={mainUrl}
          label={`${t("main.heading")}: ${mainUrl}`}
          className="size-52 border"
        />
        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <h2 id="main-qr" className="font-display text-xl font-semibold">
              {t("main.heading")}
            </h2>
            <p className="text-muted-foreground">{t("main.body")}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t("main.link")}</span>
            <div className="flex min-w-0 items-center gap-2">
              <code
                dir="ltr"
                className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 text-sm"
              >
                {mainUrl}
              </code>
              <Button
                variant="outline"
                size="icon"
                aria-label={t("copy")}
                onClick={() =>
                  navigator.clipboard.writeText(mainUrl).then(() => toast.success(t("copied")))
                }
              >
                <Copy aria-hidden />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {downloadLinks()}
            <Button
              size="sm"
              disabled={busy !== null}
              onClick={() => tent({ url: mainUrl }, "main")}
            >
              {busy === "tent-main" ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Printer aria-hidden />
              )}
              {t("downloads.tent")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() =>
                makePdf(
                  "sheet-main",
                  (spec) => buildSheetPdf(spec, Array(4).fill({ url: mainUrl })),
                  `${slug}-sheet.pdf`,
                )
              }
            >
              {busy === "sheet-main" ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <FileText aria-hidden />
              )}
              {t("downloads.sheet")}
            </Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="table-qrs" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="table-qrs" className="font-display text-xl font-semibold">
              {t("tables.heading")}
            </h2>
            <p className="text-muted-foreground">{t("tables.body")}</p>
          </div>
          {tables.length ? (
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={() =>
                makePdf(
                  "sheet-tables",
                  (spec) =>
                    buildSheetPdf(
                      spec,
                      tables.map((tq) => ({
                        url: shopUrl(origin, slug, tq.tableCode),
                        tableLabel: tq.label,
                      })),
                    ),
                  `${slug}-tables.pdf`,
                )
              }
            >
              {busy === "sheet-tables" ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <FileText aria-hidden />
              )}
              {t("tables.printAll")}
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={addOne} className="flex flex-col gap-4 rounded-xl border p-5">
            <fieldset disabled={readOnly || pending} className="contents">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
                <Field id="qr-label" label={t("tables.label")} error={err("label")}>
                  <Input id="qr-label" name="label" maxLength={40} required className="h-10" />
                </Field>
                <Field id="qr-code" label={t("tables.code")} error={err("tableCode")}>
                  <Input
                    id="qr-code"
                    name="tableCode"
                    maxLength={12}
                    required
                    dir="ltr"
                    pattern="[A-Za-z0-9_\-]{1,12}"
                    className="h-10"
                  />
                </Field>
              </div>
              <p className="text-sm text-muted-foreground">{t("tables.codeHint")}</p>
              <Button type="submit" className="self-start">
                <Plus aria-hidden />
                {t("tables.add")}
              </Button>
            </fieldset>
          </form>
          <form onSubmit={addRange} className="flex flex-col gap-4 rounded-xl border p-5">
            <fieldset disabled={readOnly || pending} className="contents">
              <h3 className="font-semibold">{t("tables.bulkHeading")}</h3>
              <div className="grid grid-cols-[minmax(0,1fr)_5rem_5rem] gap-3">
                <Field id="qr-prefix" label={t("tables.prefix")}>
                  <Input
                    id="qr-prefix"
                    name="prefix"
                    defaultValue={t("tables.prefixDefault")}
                    maxLength={30}
                    required
                    className="h-10"
                  />
                </Field>
                <Field id="qr-from" label={t("tables.from")}>
                  <Input
                    id="qr-from"
                    name="from"
                    type="number"
                    min={1}
                    max={999}
                    defaultValue={1}
                    required
                    dir="ltr"
                    className="h-10"
                  />
                </Field>
                <Field id="qr-to" label={t("tables.to")} error={err("to")}>
                  <Input
                    id="qr-to"
                    name="to"
                    type="number"
                    min={1}
                    max={999}
                    defaultValue={12}
                    required
                    dir="ltr"
                    className="h-10"
                  />
                </Field>
              </div>
              <Button type="submit" variant="outline" className="self-start">
                <Plus aria-hidden />
                {t("tables.addRange")}
              </Button>
            </fieldset>
          </form>
        </div>

        {tables.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-muted-foreground">
            {t("tables.empty")}
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {tables.map((tq) => {
              const url = shopUrl(origin, slug, tq.tableCode);
              return (
                <li key={tq.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                  <QrImage url={url} label={`${tq.label}: ${url}`} className="size-16 border" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{tq.label}</span>
                    <span dir="ltr" className="truncate text-sm text-muted-foreground rtl:text-end">
                      ?t={tq.tableCode}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {downloadLinks(tq.tableCode)}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => tent({ url, tableLabel: tq.label }, tq.tableCode)}
                    >
                      {busy === `tent-${tq.tableCode}` ? (
                        <Loader2 className="animate-spin" aria-hidden />
                      ) : (
                        <Printer aria-hidden />
                      )}
                      {t("downloads.tent")}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={readOnly || pending}
                      aria-label={t("tables.delete", { label: tq.label })}
                      onClick={() => act(() => deleteTableAction(tq.id))}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
