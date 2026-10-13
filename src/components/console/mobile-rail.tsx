"use client";

import { Menu } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { usePathname } from "@/i18n/navigation";
import { dirFor } from "@/i18n/routing";

/** Phone/tablet header: wordmark + menu button opening the rail as a sheet from the start side. */
export function MobileRail({
  brand,
  title,
  children,
}: {
  brand: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const t = useTranslations("common.a11y");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the sheet after navigating.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-clay px-3 text-clay-foreground lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 text-clay-foreground hover:bg-clay-hover hover:text-clay-foreground"
            aria-label={t("openMenu")}
          >
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side={dirFor(locale) === "rtl" ? "right" : "left"}
          className="w-[300px] max-w-[85vw] gap-0 border-clay-line bg-clay p-0 text-clay-foreground [&>button]:text-clay-foreground"
        >
          <SheetTitle className="sr-only">{title}</SheetTitle>
          {children}
        </SheetContent>
      </Sheet>
      <div className="min-w-0 flex-1">{brand}</div>
    </header>
  );
}
