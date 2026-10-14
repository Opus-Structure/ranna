import {
  Baloo_Bhaijaan_2,
  Changa,
  El_Messiri,
  Readex_Pro,
  Reem_Kufi,
  Tajawal,
} from "next/font/google";
import type { ShopFont } from "@/lib/branding/theme";
import { alexandria, cairo } from "./fonts";

/*
 * Merchant-selectable faces (Arabic + Latin). Declaring them here costs nothing at runtime:
 * @font-face rules are lazy, so a shop only downloads the face it uses.
 */
const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
  preload: false,
});
const readex = Readex_Pro({ subsets: ["arabic", "latin"], display: "swap", preload: false });
const changa = Changa({ subsets: ["arabic", "latin"], display: "swap", preload: false });
const elMessiri = El_Messiri({ subsets: ["arabic", "latin"], display: "swap", preload: false });
const baloo = Baloo_Bhaijaan_2({ subsets: ["arabic", "latin"], display: "swap", preload: false });
const reemKufi = Reem_Kufi({ subsets: ["arabic", "latin"], display: "swap", preload: false });

/** className that sets font-family for each curated face. */
export const shopFontClass: Record<ShopFont, string> = {
  cairo: cairo.className,
  alexandria: alexandria.className,
  tajawal: tajawal.className,
  readex: readex.className,
  changa: changa.className,
  "el-messiri": elMessiri.className,
  baloo: baloo.className,
  "reem-kufi": reemKufi.className,
};
