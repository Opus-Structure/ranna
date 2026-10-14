"use client";

import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { uploadImageAction } from "@/app/(console)/[locale]/dashboard/shop/actions";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/images/compress";
import { assetUrl } from "@/lib/storage/public-url";
import { cn } from "@/lib/utils";

const maxSide = { logo: 512, cover: 1600, item: 1200 } as const;

/**
 * Pick → compress in the browser → upload → hand back the storage path. The record that uses
 * the image is saved separately, so a cancelled edit never touches the live page.
 */
export function ImageField({
  kind,
  label,
  hint,
  path,
  onChange,
  shape = "square",
}: {
  kind: "logo" | "cover" | "item";
  label: string;
  hint?: string;
  path: string | null;
  onChange: (path: string | null) => void;
  shape?: "square" | "circle" | "wide";
}) {
  const t = useTranslations("shopEditor");
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const url = assetUrl(path);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const compressed = await compressImage(file, { maxSide: maxSide[kind] });
      const form = new FormData();
      form.set("kind", kind);
      form.set("file", compressed);
      const result = await uploadImageAction(form);
      if (result.ok) onChange(result.path);
      else toast.error(t(`errors.${result.error}`));
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-sm font-medium">
        {label}
      </span>
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "relative grid shrink-0 place-items-center overflow-hidden border bg-muted",
            shape === "circle" && "size-16 rounded-full",
            shape === "square" && "size-20 rounded-xl",
            shape === "wide" && "aspect-[16/7] w-40 rounded-xl",
          )}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview of an uploaded asset
            <img src={url} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-5 text-muted-foreground" aria-hidden />
          )}
          {busy ? (
            <span className="absolute inset-0 grid place-items-center bg-background/70">
              <Loader2 className="size-5 animate-spin" aria-label={t("uploading")} />
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-labelledby={`${id}-label`}
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {url ? t("replace") : t("upload")}
          </Button>
          {url ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onChange(null)}
            >
              <Trash2 aria-hidden />
              {t("remove")}
            </Button>
          ) : null}
        </div>
      </div>
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
