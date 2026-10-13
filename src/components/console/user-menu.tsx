"use client";

import { ChevronsUpDown, Languages, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMounted } from "@/hooks/use-mounted";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, type AppLocale } from "@/i18n/routing";

export function UserMenu({ email, roleLabel }: { email: string | null; roleLabel: string }) {
  const t = useTranslations("common");
  const tAuth = useTranslations("auth");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { theme: storedTheme, setTheme } = useTheme();
  // The stored theme is only known in the browser; render the neutral icon until hydrated.
  const theme = useMounted() ? storedTheme : undefined;
  const [, startTransition] = useTransition();
  const initial = (email ?? "?").slice(0, 1).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-14 w-full items-center gap-3 rounded-lg px-2 text-start transition-colors hover:bg-clay-hover focus-visible:outline-2 focus-visible:outline-clay-foreground">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-clay-foreground font-semibold text-clay"
        >
          {initial}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-clay-foreground" dir="ltr">
            {email}
          </span>
          <span className="text-xs text-clay-muted">{roleLabel}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-clay-muted" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64">
        <DropdownMenuLabel className="truncate font-normal" dir="ltr">
          {email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <Languages className="size-4" aria-hidden />
            {t("languages.label")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={locale}
              onValueChange={(next) =>
                startTransition(() => router.replace(pathname, { locale: next as AppLocale }))
              }
            >
              {locales.map((l) => (
                <DropdownMenuRadioItem key={l} value={l} lang={l}>
                  {t(`languages.${l}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            {theme === "dark" ? (
              <Moon className="size-4" aria-hidden />
            ) : theme === "light" ? (
              <Sun className="size-4" aria-hidden />
            ) : (
              <Monitor className="size-4" aria-hidden />
            )}
            {t("theme.label")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">{t("theme.light")}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">{t("theme.dark")}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">{t("theme.system")}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="gap-2">
          {/* The form lives once in ConsoleFrame: the rail renders twice (desktop + sheet). */}
          <button type="submit" form="signout-form" className="w-full">
            <LogOut className="size-4" aria-hidden />
            {tAuth("signOut")}
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
