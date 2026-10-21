import type { AppLocale } from "@/i18n/routing";

/** Ready-made menu sections an owner can add in one tap. */
export const MENU_PRESETS: { id: string; names: Record<AppLocale, string> }[] = [
  { id: "starters", names: { en: "Starters", fr: "Entrées", ar: "المقبلات" } },
  { id: "salads", names: { en: "Salads", fr: "Salades", ar: "السلطات" } },
  { id: "soups", names: { en: "Soups", fr: "Soupes", ar: "الشوربات" } },
  { id: "sandwiches", names: { en: "Sandwiches", fr: "Sandwichs", ar: "السندويشات" } },
  { id: "burgers", names: { en: "Burgers", fr: "Burgers", ar: "البرغر" } },
  { id: "tacos", names: { en: "Tacos", fr: "Tacos", ar: "التاكوس" } },
  { id: "pizza", names: { en: "Pizza", fr: "Pizzas", ar: "البيتزا" } },
  { id: "pasta", names: { en: "Pasta", fr: "Pâtes", ar: "المعكرونة" } },
  { id: "dishes", names: { en: "Main dishes", fr: "Plats", ar: "الأطباق" } },
  { id: "grills", names: { en: "Grills", fr: "Grillades", ar: "المشاوي" } },
  { id: "seafood", names: { en: "Seafood", fr: "Fruits de mer", ar: "المأكولات البحرية" } },
  { id: "sides", names: { en: "Sides", fr: "Accompagnements", ar: "الأطباق الجانبية" } },
  { id: "desserts", names: { en: "Desserts", fr: "Desserts", ar: "الحلويات" } },
  { id: "drinks", names: { en: "Drinks", fr: "Boissons", ar: "المشروبات" } },
  {
    id: "hot-drinks",
    names: { en: "Hot drinks", fr: "Boissons chaudes", ar: "المشروبات الساخنة" },
  },
  { id: "juices", names: { en: "Juices", fr: "Jus", ar: "العصائر" } },
  { id: "breakfast", names: { en: "Breakfast", fr: "Petit-déjeuner", ar: "الفطور" } },
  { id: "kids", names: { en: "Kids menu", fr: "Menu enfant", ar: "قائمة الأطفال" } },
];
