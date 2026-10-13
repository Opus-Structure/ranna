"use client";

import { Direction } from "radix-ui";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ dir, children }: { dir: "rtl" | "ltr"; children: ReactNode }) {
  return (
    <Direction.Provider dir={dir}>
      <TooltipProvider delayDuration={300}>
        {children}
        <Toaster position={dir === "rtl" ? "bottom-left" : "bottom-right"} dir={dir} />
      </TooltipProvider>
    </Direction.Provider>
  );
}
