/**
 * The demo shop at /s/demo: a synthetic Algiers café-snack used for showing the product.
 * Flagged `is_demo`; every name and price here is illustrative, not a real business.
 */
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { serviceDb } from "@/lib/db/client";
import {
  categories,
  items,
  merchantMembers,
  merchants,
  optionGroups,
  options,
  plans,
  subscriptions,
} from "@/lib/db/schema";
import type { I18nText } from "@/lib/db/schema/types";

type DemoOption = { ar: string; fr: string; en: string; delta?: number };
type DemoGroup = {
  ar: string;
  fr: string;
  en: string;
  min: number;
  max: number;
  options: DemoOption[];
};
type DemoItem = {
  ar: string;
  fr: string;
  en: string;
  dAr?: string;
  dFr?: string;
  dEn?: string;
  price: number;
  soldOut?: boolean;
  groups?: DemoGroup[];
};
type DemoCategory = { ar: string; fr: string; en: string; items: DemoItem[] };

const sauces: DemoGroup = {
  ar: "الصلصة",
  fr: "Sauce",
  en: "Sauce",
  min: 0,
  max: 2,
  options: [
    { ar: "صلصة جزائرية", fr: "Algérienne", en: "Algerian sauce" },
    { ar: "هريسة", fr: "Harissa", en: "Harissa" },
    { ar: "مايونيز", fr: "Mayonnaise", en: "Mayonnaise" },
    { ar: "صلصة بيضاء", fr: "Sauce blanche", en: "White sauce" },
  ],
};

const menu: DemoCategory[] = [
  {
    ar: "المشروبات",
    fr: "Boissons",
    en: "Drinks",
    items: [
      { ar: "قهوة سوداء", fr: "Café noir", en: "Black coffee", price: 80 },
      {
        ar: "قهوة بالحليب",
        fr: "Café crème",
        en: "Coffee with milk",
        price: 120,
        groups: [
          {
            ar: "الحجم",
            fr: "Taille",
            en: "Size",
            min: 1,
            max: 1,
            options: [
              { ar: "عادي", fr: "Normal", en: "Regular" },
              { ar: "كبير", fr: "Grand", en: "Large", delta: 40 },
            ],
          },
        ],
      },
      {
        ar: "شاي بالنعناع",
        fr: "Thé à la menthe",
        en: "Mint tea",
        dAr: "يُحضَّر بالنعناع الطازج.",
        dFr: "Préparé à la menthe fraîche.",
        dEn: "Made with fresh mint.",
        price: 100,
      },
      { ar: "ليموناضة منزلية", fr: "Citronnade maison", en: "Homemade lemonade", price: 150 },
      { ar: "عصير برتقال طازج", fr: "Jus d’orange pressé", en: "Fresh orange juice", price: 250 },
    ],
  },
  {
    ar: "السندويشات",
    fr: "Sandwichs",
    en: "Sandwiches",
    items: [
      {
        ar: "شاورما دجاج",
        fr: "Chawarma poulet",
        en: "Chicken shawarma",
        dAr: "دجاج متبّل، بطاطا مقلية، خضر في خبز رقيق.",
        dFr: "Poulet mariné, frites et crudités dans un pain fin.",
        dEn: "Marinated chicken, fries and salad in thin bread.",
        price: 450,
        groups: [
          {
            ar: "الحجم",
            fr: "Taille",
            en: "Size",
            min: 1,
            max: 1,
            options: [
              { ar: "عادي", fr: "Normal", en: "Regular" },
              { ar: "ماكسي", fr: "Maxi", en: "Maxi", delta: 150 },
            ],
          },
          sauces,
        ],
      },
      {
        ar: "كرنتيكا",
        fr: "Karantika",
        en: "Karantika",
        dAr: "فلان الحمص في خبز، بالكمون.",
        dFr: "Flan de pois chiches au cumin, en sandwich.",
        dEn: "Chickpea flan with cumin, in a sandwich.",
        price: 100,
        groups: [
          {
            ar: "إضافة",
            fr: "Supplément",
            en: "Extra",
            min: 0,
            max: 1,
            options: [{ ar: "هريسة", fr: "Harissa", en: "Harissa" }],
          },
        ],
      },
      {
        ar: "محجوبة",
        fr: "Mahjouba",
        en: "Mahjouba",
        dAr: "رقاق محشو بالطماطم والبصل.",
        dFr: "Crêpe semoule farcie tomate-oignon.",
        dEn: "Semolina crepe filled with tomato and onion.",
        price: 120,
      },
      { ar: "سندويش تونة", fr: "Sandwich thon", en: "Tuna sandwich", price: 300, groups: [sauces] },
      { ar: "بانيني بالجبن", fr: "Panini fromage", en: "Cheese panini", price: 350 },
    ],
  },
  {
    ar: "الأطباق",
    fr: "Plats",
    en: "Plates",
    items: [
      {
        ar: "بيتزا مارغريتا",
        fr: "Pizza margherita",
        en: "Margherita pizza",
        price: 600,
        groups: [
          {
            ar: "الحجم",
            fr: "Taille",
            en: "Size",
            min: 1,
            max: 1,
            options: [
              { ar: "صغيرة", fr: "Petite", en: "Small" },
              { ar: "متوسطة", fr: "Moyenne", en: "Medium", delta: 250 },
              { ar: "كبيرة", fr: "Grande", en: "Large", delta: 500 },
            ],
          },
        ],
      },
      {
        ar: "صحن شاورما",
        fr: "Assiette chawarma",
        en: "Shawarma plate",
        dAr: "مع بطاطا وسلطة وصلصة.",
        dFr: "Avec frites, salade et sauce.",
        dEn: "With fries, salad and sauce.",
        price: 900,
      },
      { ar: "بطاطا مقلية", fr: "Frites", en: "Fries", price: 200 },
    ],
  },
  {
    ar: "الحلويات",
    fr: "Douceurs",
    en: "Sweets",
    items: [
      { ar: "مقروط", fr: "Makrout", en: "Makrout", price: 60 },
      { ar: "زلابية", fr: "Zlabia", en: "Zlabia", price: 50, soldOut: true },
      { ar: "بقلاوة", fr: "Baklawa", en: "Baklava", price: 120 },
    ],
  },
];

const tr = (x: { fr: string; en: string }): I18nText => ({ fr: x.fr, en: x.en });

/**
 * Same menu, same ids on every run (a name-based UUID, v5 layout), so a re-seed never
 * invalidates customers' saved tickets or a menu page the server has cached.
 */
function stableId(key: string) {
  const h = createHash("sha1").update(`ranna-demo:${key}`).digest("hex");
  const variant = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export async function seedDemoShop(ownerId: string) {
  const [business] = await serviceDb.select().from(plans).where(eq(plans.code, "business"));
  if (!business) throw new Error("seed plans first");
  const periodEnd = new Date("2099-12-31T00:00:00Z");

  const [existing] = await serviceDb
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.slug, "demo"));
  const values = {
    name: "مقهى الميناء",
    slug: "demo",
    status: "active" as const,
    planId: business.id,
    periodEnd,
    graceUntil: null,
    currency: "DZD",
    defaultLocale: "ar",
    locales: ["ar", "fr", "en"],
    timezone: "Africa/Algiers",
    phone: "+213 555 00 00 00",
    address: "Synthetic demo address, Algiers",
    isOpen: true,
    acceptingOrders: true,
    isDemo: true,
    setupCompletedAt: new Date(),
    branding: {
      primaryColor: "#0f5e63",
      secondaryColor: "#e8a33d",
      font: "readex",
      layout: "list" as const,
      welcome: {
        ar: "اطلب من هنا وانتظر حيث تشاء: نرنّ هاتفك حين يجهز طلبك.",
        fr: "Commandez ici et attendez où vous voulez : on fait sonner votre téléphone quand c’est prêt.",
        en: "Order here and wait anywhere: we ring your phone when it’s ready.",
      },
    },
    settings: {
      prepTargetMinutes: 10,
      askPhone: true,
      phoneRetentionDays: 30,
      fallbackMessaging: false,
      openingHours: Array.from({ length: 7 }, (_, day) => ({
        day,
        closed: false,
        open: day === 5 ? "14:00" : "00:00",
        close: "23:59",
      })),
    },
  };

  let merchantId: string;
  if (existing) {
    merchantId = existing.id;
    await serviceDb.update(merchants).set(values).where(eq(merchants.id, merchantId));
    await serviceDb.delete(categories).where(eq(categories.merchantId, merchantId));
  } else {
    const [row] = await serviceDb.insert(merchants).values(values).returning({ id: merchants.id });
    merchantId = row!.id;
    await serviceDb
      .insert(merchantMembers)
      .values({ merchantId, userId: ownerId, role: "owner" })
      .onConflictDoNothing();
  }
  await serviceDb
    .insert(subscriptions)
    .values({
      merchantId,
      planId: business.id,
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
      trialUsed: true,
    })
    .onConflictDoUpdate({
      target: subscriptions.merchantId,
      set: { planId: business.id, currentPeriodEnd: periodEnd },
    });

  for (const [ci, c] of menu.entries()) {
    const [cat] = await serviceDb
      .insert(categories)
      .values({
        id: stableId(`c${ci}`),
        merchantId,
        name: c.ar,
        nameI18n: tr(c),
        sort: (ci + 1) * 10,
      })
      .returning({ id: categories.id });
    for (const [ii, it] of c.items.entries()) {
      const [item] = await serviceDb
        .insert(items)
        .values({
          id: stableId(`c${ci}i${ii}`),
          merchantId,
          categoryId: cat!.id,
          name: it.ar,
          nameI18n: tr(it),
          description: it.dAr ?? null,
          descriptionI18n: it.dFr ? { fr: it.dFr, en: it.dEn ?? "" } : {},
          priceMinor: it.price * 100,
          isAvailable: !it.soldOut,
          sort: (ii + 1) * 10,
        })
        .returning({ id: items.id });
      for (const [gi, g] of (it.groups ?? []).entries()) {
        const [group] = await serviceDb
          .insert(optionGroups)
          .values({
            id: stableId(`c${ci}i${ii}g${gi}`),
            merchantId,
            itemId: item!.id,
            name: g.ar,
            nameI18n: tr(g),
            minSelect: g.min,
            maxSelect: g.max,
            sort: gi,
          })
          .returning({ id: optionGroups.id });
        await serviceDb.insert(options).values(
          g.options.map((o, oi) => ({
            id: stableId(`c${ci}i${ii}g${gi}o${oi}`),
            merchantId,
            groupId: group!.id,
            name: o.ar,
            nameI18n: tr(o),
            priceDeltaMinor: (o.delta ?? 0) * 100,
            sort: oi,
          })),
        );
      }
    }
  }
  return merchantId;
}
