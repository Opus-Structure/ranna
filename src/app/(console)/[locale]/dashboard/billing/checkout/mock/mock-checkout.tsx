"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { completeMockCheckout } from "./actions";

export function MockCheckoutButtons({ paymentId }: { paymentId: string }) {
  const t = useTranslations("billing.mock");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function finish(outcome: "succeeded" | "failed") {
    startTransition(async () => {
      const result = await completeMockCheckout(paymentId, outcome);
      const status = result.ok && outcome === "succeeded" ? "success" : "failed";
      router.replace(`/dashboard/billing?checkout=${status}`);
    });
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        size="lg"
        className="h-12 px-6"
        disabled={pending}
        onClick={() => finish("succeeded")}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {t("succeed")}
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="h-12 px-6"
        disabled={pending}
        onClick={() => finish("failed")}
      >
        {t("fail")}
      </Button>
    </div>
  );
}
