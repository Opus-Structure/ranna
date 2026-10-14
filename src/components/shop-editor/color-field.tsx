"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";

/** Native colour picker plus a hex box; the hex is the source of truth. */
export function ColorField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  error?: string;
}) {
  const id = useId();
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    // Keep the text box in sync when the value changes from the picker.
    setLastValue(value);
    setText(value);
  }
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-11 w-14 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
        />
        <Input
          id={id}
          value={text}
          dir="ltr"
          maxLength={7}
          spellCheck={false}
          aria-invalid={Boolean(error) || undefined}
          onChange={(e) => {
            const v = e.target.value.trim();
            setText(v);
            if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v.toLowerCase());
          }}
          className="h-11 font-mono uppercase"
        />
      </div>
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
