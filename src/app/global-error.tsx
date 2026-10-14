"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary when a root layout itself fails: no fonts, providers or translations
 * can be assumed here, so it is self-contained and says the same thing in all three languages.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("global error", error.digest ?? error.message);
  }, [error]);
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#f6efe6",
          color: "#2b211c",
          fontFamily: "system-ui, sans-serif",
          padding: "1.5rem",
        }}
      >
        <main
          role="alert"
          style={{ maxWidth: "28rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <p style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>حدث خطأ غير متوقع.</p>
          <p lang="fr" dir="ltr" style={{ margin: 0 }}>
            Une erreur inattendue s’est produite.
          </p>
          <p lang="en" dir="ltr" style={{ margin: 0 }}>
            Something unexpected went wrong.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "0.5rem",
              alignSelf: "flex-start",
              height: "3rem",
              padding: "0 1.25rem",
              borderRadius: "0.75rem",
              border: 0,
              background: "#76291d",
              color: "#f6efe6",
              fontWeight: 700,
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            أعد المحاولة · Réessayer · Try again
          </button>
        </main>
      </body>
    </html>
  );
}
