import { BellRing, MonitorSpeaker, Users, Tablet, Languages } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { WaitBand } from "@/components/brand/wait-band";
import { cn } from "@/lib/utils";

const lanes = [
  {
    key: "new",
    tone: "bg-state-new",
    orders: [{ n: 114, who: "Yacine", items: "2× قهوة سوداء", min: 1 }],
  },
  {
    key: "preparing",
    tone: "bg-state-preparing",
    orders: [
      { n: 111, who: "Karim", items: "1× شاورما دجاج", min: 6 },
      { n: 112, who: "Sara", items: "1× عصير برتقال", min: 4 },
    ],
  },
  {
    key: "ready",
    tone: "bg-state-ready",
    orders: [{ n: 109, who: "Amel", items: "1× قهوة بالحليب", min: 1 }],
  },
] as const;

/**
 * The staff side, dense after the airy moments above: the order board as it looks at the
 * counter (synthetic orders), and what the shop gets around it.
 */
export async function CounterBoard() {
  const t = await getTranslations("site.board");
  const points = [
    { icon: BellRing, key: "chime" },
    { icon: MonitorSpeaker, key: "screen" },
    { icon: Users, key: "staff" },
    { icon: Tablet, key: "device" },
    { icon: Languages, key: "languages" },
  ] as const;
  return (
    <section aria-labelledby="board-title" className="bg-muted/60">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div>
          <h2
            id="board-title"
            className="font-display text-3xl leading-tight font-bold text-balance sm:text-4xl"
          >
            {t("title")}
          </h2>
          <p className="mt-3 max-w-[48ch] text-lg text-muted-foreground">{t("body")}</p>
          <ul className="mt-8 flex flex-col gap-4">
            {points.map(({ icon: Icon, key }) => (
              <li key={key} className="flex gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <span>
                  <strong className="font-semibold">{t(`points.${key}.title`)}</strong>{" "}
                  <span className="text-muted-foreground">{t(`points.${key}.body`)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <figure className="rounded-2xl border bg-background p-4 shadow-[0_30px_60px_-40px_rgb(31_26_23/0.55)] sm:p-5">
          <div className="grid gap-4 sm:grid-cols-3" aria-hidden>
            {lanes.map((lane) => (
              <div key={lane.key} className="flex flex-col gap-3">
                <p className="flex items-baseline gap-2 border-b pb-2 text-sm font-semibold">
                  <span className={cn("size-2 rotate-45 rounded-[1px]", lane.tone)} />
                  {t(`lanes.${lane.key}`)}
                  <span className="ms-auto font-display text-lg tabular-nums">
                    {lane.orders.length}
                  </span>
                </p>
                {lane.orders.map((o) => (
                  <div key={o.n} className="flex flex-col gap-2 rounded-xl border bg-card p-3">
                    <div className="flex items-start justify-between">
                      <span className="order-number text-3xl">{o.n}</span>
                      <span
                        className={cn(
                          "text-xs font-semibold tabular-nums",
                          o.min > 5 ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {t("minutes", { minutes: o.min })}
                      </span>
                    </div>
                    <p className="text-sm font-semibold">{o.who}</p>
                    {lane.key !== "ready" ? (
                      <WaitBand elapsedMinutes={o.min} targetMinutes={5} />
                    ) : null}
                    <p className="text-sm" dir="auto">
                      {o.items}
                    </p>
                    <span className="mt-1 grid h-10 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                      {t(`actions.${lane.key}`)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <figcaption className="mt-4 text-xs text-muted-foreground">{t("caption")}</figcaption>
        </figure>
      </div>
    </section>
  );
}
