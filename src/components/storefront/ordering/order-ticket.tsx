"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { CustomerOrderStatus } from "@/lib/orders/service";
import { useOrderLive } from "@/lib/orders/use-order-live";
import { AlertsPanel } from "./alerts-panel";
import { ReadyAlert } from "./ready-alert";
import { cn } from "@/lib/utils";

const steps = ["received", "preparing", "ready"] as const;

/**
 * The customer's ticket after placing: the number set as the headline, a three-step track,
 * and the current status in words for screen readers. Updates live. Enamel green
 * (--state-ready) is reserved for "ready" and appears nowhere else on this page (D27).
 */
export function OrderTicket({
  token,
  topic,
  initial,
  fastPoll = false,
  children,
}: {
  token: string;
  topic: string;
  initial: CustomerOrderStatus;
  /** Check every second (the demo café, whose orders advance when the page asks). */
  fastPoll?: boolean;
  /** Server-rendered details (items, total) shown under the live part. */
  children?: React.ReactNode;
}) {
  const t = useTranslations("order.status");
  const { status, setStatus, live, ringAt } = useOrderLive(
    token,
    topic,
    initial,
    fastPoll ? 1000 : undefined,
  );
  const stage = status.stage;
  const ringing = stage === "ready" && !status.acknowledgedAt;

  function acknowledge() {
    // Stop ringing at once; the server tells other tabs and the board.
    setStatus((s) => ({ ...s, acknowledgedAt: new Date().toISOString() }));
    void fetch(`/api/orders/${token}/ack`, { method: "POST" }).catch(() => undefined);
  }
  const ready = stage === "ready";
  const collected = stage === "collected";
  const stepIndex = collected ? steps.length : steps.indexOf(stage as (typeof steps)[number]);
  const body = t(`body.${stage}`, { reason: status.cancelReason ?? "" });

  // Announce changes only (not the initial state, which the heading already says).
  const [announcement, setAnnouncement] = useState("");
  const previous = useRef(stage);
  useEffect(() => {
    if (previous.current === stage) return;
    previous.current = stage;
    setAnnouncement(`${t(`headline.${stage}`)}. ${body}`);
  }, [stage, body, t]);

  return (
    <section aria-labelledby="order-headline" className="flex flex-col gap-6">
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl px-6 pt-8 pb-6 text-center transition-colors duration-500",
          ready
            ? "bg-state-ready text-state-ready-foreground motion-safe:animate-[ready-halo_2.4s_ease-out_infinite]"
            : "bg-[var(--shop-card)] shadow-[0_10px_30px_-18px_rgb(31_26_23/0.35)]",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-5 top-3 band-rule",
            ready ? "opacity-70" : "text-[var(--brand-ink)]",
          )}
        />
        <p
          className={cn("text-sm font-semibold", ready ? "opacity-90" : "text-[var(--shop-muted)]")}
        >
          {t("yourNumber")}
        </p>
        <p
          className={cn(
            "mt-2 order-number text-[clamp(5rem,28vw,8.5rem)]",
            stage === "canceled" && "text-[var(--shop-muted)] line-through decoration-4",
          )}
        >
          {status.number}
        </p>
        <span
          className={cn(
            "mt-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
            ready ? "bg-white/20" : "bg-[var(--shop-line)] text-[var(--shop-muted)]",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "size-1.5 rotate-45 rounded-[1px] bg-current",
              live !== "live" && "opacity-40",
            )}
          />
          {live === "live" ? t("live") : t("offline")}
        </span>
      </div>

      {stage !== "canceled" ? (
        <ol className="grid grid-cols-3 gap-2" aria-label={t("progress")}>
          {steps.map((s, i) => {
            const reached = i <= stepIndex;
            const current = i === stepIndex;
            const green = s === "ready" && reached;
            return (
              <li
                key={s}
                className="flex flex-col items-center gap-2 text-center"
                aria-current={current ? "step" : undefined}
              >
                <span className="relative flex h-4 w-full items-center justify-center">
                  {i > 0 ? (
                    // Connector back to the previous step; inline-end keeps it right in RTL.
                    <span
                      aria-hidden
                      className={cn(
                        "absolute end-1/2 h-0.5 w-[calc(100%+0.5rem)]",
                        reached ? "bg-[var(--brand-ink)]" : "bg-[var(--shop-line)]",
                      )}
                    />
                  ) : null}
                  <span
                    aria-hidden
                    className={cn(
                      "relative size-4 rotate-45 rounded-[2px] border-2 transition-colors",
                      green
                        ? "border-state-ready bg-state-ready"
                        : reached
                          ? "border-[var(--brand-ink)] bg-[var(--brand-ink)]"
                          : "border-[var(--shop-line)] bg-[var(--shop-ground)]",
                      current && !green && "motion-safe:animate-pulse",
                    )}
                  />
                </span>
                <span
                  className={cn("text-sm", reached ? "font-semibold" : "text-[var(--shop-muted)]")}
                >
                  {t(`stages.${s}`)}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      <div className="text-center">
        <h1 id="order-headline" className="text-2xl font-bold text-balance">
          {t(`headline.${stage}`)}
        </h1>
        <p className="mt-2 text-pretty text-[var(--shop-muted)]">{body}</p>
      </div>
      <p aria-live="assertive" className="sr-only">
        {announcement}
      </p>
      {status.acknowledgedAt && ready ? (
        <p className="-mt-2 text-center text-sm font-semibold text-[var(--brand-ink)]">
          {t("onTheWay")}
        </p>
      ) : null}
      <AlertsPanel token={token} open={stage === "received" || stage === "preparing"} />
      {children}
      <ReadyAlert
        number={status.number}
        active={ringing}
        ringAt={ringAt}
        onAcknowledge={acknowledge}
      />
    </section>
  );
}
