import { Alexandria, Cairo, Inter } from "next/font/google";

/*
 * Platform faces (D15). Variable fonts, self-hosted by next/font. Not preloaded: customer shop
 * pages override the stack with the merchant's own face, so these only download where used.
 */
export const alexandria = Alexandria({
  subsets: ["arabic", "latin"],
  variable: "--font-alexandria",
  display: "swap",
  preload: false,
});

export const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
  preload: false,
});

export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
  preload: false,
});

export const platformFontVariables = [alexandria.variable, cairo.variable, inter.variable].join(
  " ",
);
