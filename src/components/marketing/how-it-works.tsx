import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { appUrl } from "@/config/brand";
import { qrSvg, shopUrl } from "@/lib/qr/matrix";

/** The demo café's own colours: the customer side always wears the merchant's brand. */
const DEMO = { brand: "#0f5e63", contrast: "#ffffff", ink: "#0f5e63" } as const;

/**
 * Three moments, shown as the real objects on a counter edge: the printed table tent with a
 * working QR code, the shop page with its ticket, and the phone ringing. Different objects at
 * different heights, not three equal cards.
 */
export async function HowItWorks() {
  const t = await getTranslations("site.how");
  const qr = qrSvg(shopUrl(appUrl(), "demo"), { dark: DEMO.brand, light: "#ffffff", margin: 2 });
  return (
    <section
      id="how"
      aria-labelledby="how-title"
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 pt-24 pb-10 sm:px-6"
    >
      <h2
        id="how-title"
        className="max-w-[20ch] font-display text-3xl leading-tight font-bold text-balance sm:text-4xl"
      >
        {t("title")}
      </h2>
      <p className="mt-3 max-w-[56ch] text-lg text-muted-foreground">{t("body")}</p>

      <ol className="mt-14 grid items-end gap-x-8 gap-y-14 md:grid-cols-3">
        <Moment title={t("scan.title")} body={t("scan.body")}>
          {/* The table tent: printed card, merchant colours, a real QR into the demo shop. */}
          <div
            className="mx-auto flex w-56 flex-col items-center gap-3 rounded-t-[2rem] rounded-b-md px-6 pt-6 pb-5 text-center shadow-[0_22px_40px_-24px_rgb(15_94_99/0.7)]"
            style={{ background: DEMO.brand, color: DEMO.contrast }}
          >
            <span className="text-sm font-bold" lang="ar">
              مقهى الميناء
            </span>
            <span
              className="block size-36 rounded-xl bg-white p-2 [&>svg]:size-full"
              aria-hidden
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            <span className="font-display text-lg font-bold">{t("scan.tent")}</span>
            <span className="text-xs opacity-85">{t("scan.noApp")}</span>
          </div>
        </Moment>

        <Moment title={t("order.title")} body={t("order.body")}>
          <Phone>
            <div className="flex h-full flex-col bg-[#faf8f5] text-[#1f1a17]">
              <div className="px-3 pt-3 pb-2 text-white" style={{ background: DEMO.brand }}>
                <p className="text-sm font-bold" lang="ar">
                  مقهى الميناء
                </p>
                <p className="text-[0.65rem] opacity-85">{t("order.open")}</p>
              </div>
              <ul className="flex-1 divide-y divide-[#e8e3de] px-3 text-[0.72rem]">
                {(["coffee", "shawarma", "juice"] as const).map((k) => (
                  <li key={k} className="flex items-center justify-between py-2">
                    <span className="font-semibold">{t(`order.items.${k}.name`)}</span>
                    <span className="font-semibold tabular-nums" style={{ color: DEMO.ink }}>
                      {t(`order.items.${k}.price`)}
                    </span>
                  </li>
                ))}
              </ul>
              <div
                className="m-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[0.7rem] font-bold text-white"
                style={{ background: DEMO.brand }}
              >
                <span className="rounded-full bg-white/20 px-1.5 tabular-nums">2</span>
                <span className="flex-1">{t("order.review")}</span>
                <span className="tabular-nums">{t("order.total")}</span>
              </div>
            </div>
          </Phone>
        </Moment>

        <Moment title={t("ring.title")} body={t("ring.body")}>
          <Phone>
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-state-ready px-3 text-center text-state-ready-foreground motion-safe:animate-[ready-flash_1.2s_steps(2,jump-none)_infinite]">
              <span aria-hidden className="band-rule w-20 opacity-70" />
              <p className="text-sm font-bold">{t("ring.ready")}</p>
              <p className="order-number text-6xl">108</p>
              <p className="text-[0.65rem] opacity-90">{t("ring.counter")}</p>
              <span className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg bg-white py-2 text-[0.7rem] font-bold text-[#123d2a]">
                <Check className="size-3.5" aria-hidden />
                {t("ring.ack")}
              </span>
            </div>
          </Phone>
        </Moment>
      </ol>
      <p className="mt-8 text-sm text-muted-foreground">{t("demoLabel")}</p>
    </section>
  );
}

function Moment({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-6">
      <div aria-hidden>{children}</div>
      <div>
        <h3 className="flex items-center gap-2 font-display text-xl font-bold">{title}</h3>
        <p className="mt-2 max-w-[34ch] text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}

/** A phone outline at roughly real proportions; the contents are real interface, small. */
function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto h-[19rem] w-[10rem] overflow-hidden rounded-[1.9rem] border-[5px] border-foreground bg-foreground shadow-[0_24px_44px_-26px_rgb(31_26_23/0.7)]">
      <div className="h-full overflow-hidden rounded-[1.5rem]">{children}</div>
    </div>
  );
}
