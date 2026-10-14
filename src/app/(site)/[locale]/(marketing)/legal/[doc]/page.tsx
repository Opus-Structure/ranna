import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { brandName } from "@/config/brand";
import { Link } from "@/i18n/navigation";
import { initLocale } from "@/i18n/server";

const DOCS = ["terms", "privacy"] as const;
type Doc = (typeof DOCS)[number];
type Section = { h: string; p: string[] };

/** Last substantive change to either document (shown to readers). */
const UPDATED = "2026-10-14";

function isDoc(v: string): v is Doc {
  return (DOCS as readonly string[]).includes(v);
}

export function generateStaticParams() {
  return DOCS.map((doc) => ({ doc }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ doc: string }>;
}): Promise<Metadata> {
  const { doc } = await params;
  if (!isDoc(doc)) return {};
  const t = await getTranslations(`legal.${doc}`);
  return { title: t("title") };
}

/** Terms and Privacy: a reading page, one column at a comfortable measure, sections linkable. */
export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; doc: string }>;
}) {
  const locale = await initLocale(params);
  const { doc } = await params;
  if (!isDoc(doc)) notFound();
  const t = await getTranslations("legal");
  const format = await getFormatter();
  const sections = t.raw(`${doc}.sections`) as Section[];
  const brand = brandName(locale);
  const fill = (s: string) => s.replaceAll("{brand}", brand);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-10 pb-24 sm:px-6">
      <p className="mb-8 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
        {t("draft")}
      </p>
      <h1 className="font-display text-4xl font-bold">{t(`${doc}.title`)}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("updated", {
          date: format.dateTime(new Date(`${UPDATED}T12:00:00Z`), {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        })}
      </p>
      <p className="mt-6 text-lg leading-relaxed">{fill(t(`${doc}.intro`, { brand }))}</p>

      <nav aria-label={t("contents")} className="mt-8 border-y py-4">
        <ol className="grid gap-1.5 text-sm sm:grid-cols-2">
          {sections.map((s, i) => (
            <li key={s.h}>
              <a href={`#s${i + 1}`} className="underline-offset-4 hover:underline">
                {s.h}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-6">
        {sections.map((s, i) => (
          <section
            key={s.h}
            id={`s${i + 1}`}
            aria-labelledby={`s${i + 1}-h`}
            className="scroll-mt-20 pt-8"
          >
            <h2 id={`s${i + 1}-h`} className="font-display text-xl font-bold">
              {s.h}
            </h2>
            {s.p.map((para, j) => (
              <p key={j} className="mt-3 max-w-[68ch] leading-relaxed text-foreground/90">
                {fill(para)}
              </p>
            ))}
          </section>
        ))}
      </div>

      <p className="mt-12 text-sm text-muted-foreground">
        {t.rich("other", {
          other: t(`${doc === "terms" ? "privacy" : "terms"}.title`),
          link: (chunks) => (
            <Link
              href={`/legal/${doc === "terms" ? "privacy" : "terms"}`}
              className="font-semibold text-foreground underline underline-offset-4"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>
    </main>
  );
}
