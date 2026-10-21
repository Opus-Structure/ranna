import type { AppLocale } from "@/i18n/routing";

type Text = Record<AppLocale, string>;

export type DishPreset = {
  id: string;
  /** Price in major units (dinars); the owner adjusts it after adding. */
  price: number;
  names: Text;
  descriptions: Text;
};

const dish = (
  id: string,
  price: number,
  [en, fr, ar]: [string, string, string],
  [den, dfr, dar]: [string, string, string],
): DishPreset => ({
  id,
  price,
  names: { en, fr, ar },
  descriptions: { en: den, fr: dfr, ar: dar },
});

/**
 * Ready-made dishes for each section in MENU_PRESETS (same ids). Typical Algerian restaurant,
 * snack and café fare with indicative prices in DZD.
 */
export const DISH_PRESETS: Record<string, DishPreset[]> = {
  starters: [
    dish(
      "bourek",
      300,
      ["Bourek (3 pieces)", "Bourek (3 pièces)", "بوراك (3 قطع)"],
      [
        "Crispy filo rolls filled with minced meat, egg and cheese.",
        "Rouleaux de filo croustillants farcis à la viande hachée, œuf et fromage.",
        "لفائف رقيقة مقرمشة محشوة باللحم المفروم والبيض والجبن.",
      ],
    ),
    dish(
      "brik",
      250,
      ["Brik with egg", "Brik à l'œuf", "بريك بالبيض"],
      [
        "Golden brik with egg, tuna and parsley.",
        "Brik doré à l'œuf, thon et persil.",
        "بريك ذهبي بالبيض والتونة والمعدنوس.",
      ],
    ),
    dish(
      "kefta-sauce",
      350,
      ["Kefta in tomato sauce", "Kefta en sauce tomate", "كفتة بالصلصة"],
      [
        "Spiced lamb meatballs in a light tomato sauce.",
        "Boulettes d'agneau épicées en sauce tomate légère.",
        "كفتة خروف متبلة في صلصة طماطم خفيفة.",
      ],
    ),
    dish(
      "garantita",
      200,
      ["Garantita", "Garantita (calentita)", "الغرنطيطة"],
      [
        "Warm chickpea flan with cumin, served with harissa.",
        "Flan tiède de pois chiches au cumin, servi avec de la harissa.",
        "فلان دافئ من الحمص بالكمون يقدم مع الهريسة.",
      ],
    ),
    dish(
      "mhajeb-starter",
      150,
      ["Mhajeb", "Mhajeb", "المحاجب"],
      [
        "Thin semolina crêpes folded over tomato and pepper sauce.",
        "Crêpes fines de semoule garnies de sauce tomate et poivron.",
        "فطائر سميد رقيقة محشوة بصلصة الطماطم والفلفل.",
      ],
    ),
    dish(
      "samsa",
      320,
      ["Samsa (4 pieces)", "Samsa (4 pièces)", "صامصة (4 قطع)"],
      [
        "Almond and honey pastries rolled in sesame.",
        "Pâtisseries aux amandes et miel roulées dans le sésame.",
        "حلوى اللوز والعسل المغطاة بالسمسم.",
      ],
    ),
  ],

  salads: [
    dish(
      "salade-algerienne",
      250,
      ["Algerian salad", "Salade algérienne", "سلطة جزائرية"],
      [
        "Tomato, cucumber, onion, green pepper and olive oil.",
        "Tomate, concombre, oignon, poivron vert et huile d'olive.",
        "طماطم وخيار وبصل وفلفل أخضر وزيت زيتون.",
      ],
    ),
    dish(
      "salade-mechouia",
      300,
      ["Mechouia salad", "Salade mechouia", "سلطة مشوية"],
      [
        "Grilled peppers and tomatoes with garlic, topped with tuna and egg.",
        "Poivrons et tomates grillés à l'ail, thon et œuf.",
        "فلفل وطماطم مشوية بالثوم مع التونة والبيض.",
      ],
    ),
    dish(
      "salade-composee",
      450,
      ["Mixed salad", "Salade composée", "سلطة مشكلة"],
      [
        "Lettuce, tuna, corn, olives, eggs and cheese.",
        "Laitue, thon, maïs, olives, œufs et fromage.",
        "خس وتونة وذرة وزيتون وبيض وجبن.",
      ],
    ),
    dish(
      "salade-carottes",
      200,
      ["Carrot salad", "Salade de carottes", "سلطة الجزر"],
      [
        "Grated carrots with cumin, lemon and olive oil.",
        "Carottes râpées au cumin, citron et huile d'olive.",
        "جزر مبشور بالكمون والليمون وزيت الزيتون.",
      ],
    ),
    dish(
      "salade-poulet",
      550,
      ["Chicken salad", "Salade de poulet", "سلطة الدجاج"],
      [
        "Grilled chicken strips on fresh greens with house dressing.",
        "Lanières de poulet grillé sur lit de salade, sauce maison.",
        "شرائح دجاج مشوي على خضار طازجة مع صلصة الدار.",
      ],
    ),
  ],

  soups: [
    dish(
      "chorba-frik",
      350,
      ["Chorba frik", "Chorba frik", "شوربة فريك"],
      [
        "Traditional lamb soup with green wheat, chickpeas, coriander and mint.",
        "Soupe traditionnelle à l'agneau, blé vert, pois chiches, coriandre et menthe.",
        "شوربة تقليدية بلحم الخروف والفريك والحمص والكزبرة والنعناع.",
      ],
    ),
    dish(
      "harira",
      250,
      ["Harira", "Harira", "حريرة"],
      [
        "Tomato soup with lentils, chickpeas and vermicelli.",
        "Soupe de tomate aux lentilles, pois chiches et vermicelles.",
        "شوربة طماطم بالعدس والحمص والشعيرية.",
      ],
    ),
    dish(
      "chorba-beida",
      300,
      ["Chorba beida", "Chorba beïda", "شوربة بيضاء"],
      [
        "Creamy white soup with chicken, chickpeas and cinnamon.",
        "Soupe blanche onctueuse au poulet, pois chiches et cannelle.",
        "شوربة بيضاء كريمية بالدجاج والحمص والقرفة.",
      ],
    ),
    dish(
      "soupe-legumes",
      250,
      ["Vegetable soup", "Soupe de légumes", "شوربة الخضار"],
      [
        "Seasonal vegetables blended with a touch of cumin.",
        "Légumes de saison mixés, une pointe de cumin.",
        "خضار الموسم مطحونة مع لمسة كمون.",
      ],
    ),
    dish(
      "soupe-poisson",
      450,
      ["Fish soup", "Soupe de poisson", "شوربة السمك"],
      [
        "Rich fish broth served with croutons.",
        "Bouillon de poisson corsé servi avec des croûtons.",
        "مرق سمك غني يقدم مع الخبز المحمص.",
      ],
    ),
  ],

  sandwiches: [
    dish(
      "sandwich-merguez",
      350,
      ["Merguez sandwich", "Sandwich merguez", "ساندويتش مرقاز"],
      [
        "Grilled merguez, fries, harissa and onion in a baguette.",
        "Merguez grillées, frites, harissa et oignon dans une baguette.",
        "مرقاز مشوي مع بطاطا مقلية وهريسة وبصل في خبز باغيت.",
      ],
    ),
    dish(
      "sandwich-poulet",
      400,
      ["Chicken sandwich", "Sandwich poulet", "ساندويتش دجاج"],
      [
        "Marinated chicken, lettuce, tomato, fries and sauce.",
        "Poulet mariné, laitue, tomate, frites et sauce.",
        "دجاج متبل مع خس وطماطم وبطاطا مقلية وصلصة.",
      ],
    ),
    dish(
      "sandwich-thon",
      300,
      ["Tuna sandwich", "Sandwich thon", "ساندويتش تونة"],
      [
        "Tuna, olives, egg, mayonnaise and salad.",
        "Thon, olives, œuf, mayonnaise et salade.",
        "تونة وزيتون وبيض ومايونيز وسلطة.",
      ],
    ),
    dish(
      "sandwich-escalope",
      450,
      ["Escalope sandwich", "Sandwich escalope", "ساندويتش إسكالوب"],
      [
        "Breaded chicken escalope, cheese, fries and sauce.",
        "Escalope de poulet panée, fromage, frites et sauce.",
        "إسكالوب دجاج مقرمش مع جبن وبطاطا وصلصة.",
      ],
    ),
    dish(
      "sandwich-viande-hachee",
      400,
      ["Kebab sandwich", "Sandwich kebab", "ساندويتش كباب"],
      [
        "Grilled minced meat skewer with onion and harissa.",
        "Brochette de viande hachée grillée, oignon et harissa.",
        "كباب لحم مفروم مشوي مع بصل وهريسة.",
      ],
    ),
    dish(
      "sandwich-fromage",
      250,
      ["Cheese sandwich", "Sandwich fromage", "ساندويتش جبن"],
      [
        "Melted cheese with olives and fresh vegetables.",
        "Fromage fondu, olives et légumes frais.",
        "جبن ذائب مع زيتون وخضار طازجة.",
      ],
    ),
  ],

  burgers: [
    dish(
      "burger-classic",
      500,
      ["Classic burger", "Burger classique", "برغر كلاسيك"],
      [
        "Beef patty, cheddar, lettuce, tomato and house sauce.",
        "Steak de bœuf, cheddar, laitue, tomate et sauce maison.",
        "قطعة لحم بقري مع شيدر وخس وطماطم وصلصة الدار.",
      ],
    ),
    dish(
      "burger-double",
      750,
      ["Double cheese burger", "Double cheese burger", "برغر دبل تشيز"],
      [
        "Two beef patties and double cheddar.",
        "Deux steaks de bœuf et double cheddar.",
        "قطعتا لحم بقري مع شيدر مزدوج.",
      ],
    ),
    dish(
      "burger-poulet",
      450,
      ["Crispy chicken burger", "Burger poulet croustillant", "برغر دجاج مقرمش"],
      [
        "Crispy chicken fillet, lettuce and mayonnaise.",
        "Filet de poulet croustillant, laitue et mayonnaise.",
        "فيليه دجاج مقرمش مع خس ومايونيز.",
      ],
    ),
    dish(
      "burger-algerien",
      550,
      ["Algerian-style burger", "Burger à l'algérienne", "برغر على الطريقة الجزائرية"],
      [
        "Beef patty with harissa mayo, fries inside and pickled onions.",
        "Steak de bœuf, mayo harissa, frites à l'intérieur et oignons marinés.",
        "لحم بقري مع مايونيز هريسة وبطاطا مقلية وبصل مخلل.",
      ],
    ),
  ],

  tacos: [
    dish(
      "tacos-poulet",
      500,
      ["Chicken tacos", "Tacos poulet", "تاكوس دجاج"],
      [
        "Grilled chicken, fries and cheese sauce in a pressed tortilla.",
        "Poulet grillé, frites et sauce fromagère dans une tortilla pressée.",
        "دجاج مشوي وبطاطا وصلصة جبن في تورتيلا مضغوطة.",
      ],
    ),
    dish(
      "tacos-viande-hachee",
      550,
      ["Minced beef tacos", "Tacos viande hachée", "تاكوس لحم مفروم"],
      [
        "Seasoned minced beef, fries and cheese sauce.",
        "Viande hachée assaisonnée, frites et sauce fromagère.",
        "لحم مفروم متبل وبطاطا وصلصة جبن.",
      ],
    ),
    dish(
      "tacos-mixte",
      650,
      ["Mixed tacos", "Tacos mixte", "تاكوس مشكل"],
      [
        "Chicken, minced beef and merguez with cheese sauce.",
        "Poulet, viande hachée et merguez avec sauce fromagère.",
        "دجاج ولحم مفروم ومرقاز مع صلصة جبن.",
      ],
    ),
    dish(
      "tacos-cordon-bleu",
      600,
      ["Cordon bleu tacos", "Tacos cordon bleu", "تاكوس كوردون بلو"],
      [
        "Crispy cordon bleu, fries and cheddar sauce.",
        "Cordon bleu croustillant, frites et sauce cheddar.",
        "كوردون بلو مقرمش مع بطاطا وصلصة شيدر.",
      ],
    ),
  ],

  pizza: [
    dish(
      "pizza-margherita",
      600,
      ["Margherita", "Margherita", "مارغريتا"],
      [
        "Tomato sauce, mozzarella and olives.",
        "Sauce tomate, mozzarella et olives.",
        "صلصة طماطم وموزاريلا وزيتون.",
      ],
    ),
    dish(
      "pizza-4-fromages",
      900,
      ["Four cheese", "Quatre fromages", "أربعة أجبان"],
      [
        "Mozzarella, cheddar, emmental and goat cheese.",
        "Mozzarella, cheddar, emmental et fromage de chèvre.",
        "موزاريلا وشيدر وإيمنتال وجبن الماعز.",
      ],
    ),
    dish(
      "pizza-thon",
      800,
      ["Tuna pizza", "Pizza au thon", "بيتزا بالتونة"],
      [
        "Tuna, onion, olives and mozzarella.",
        "Thon, oignon, olives et mozzarella.",
        "تونة وبصل وزيتون وموزاريلا.",
      ],
    ),
    dish(
      "pizza-poulet",
      850,
      ["Chicken pizza", "Pizza au poulet", "بيتزا بالدجاج"],
      [
        "Chicken, mushrooms, peppers and mozzarella.",
        "Poulet, champignons, poivrons et mozzarella.",
        "دجاج وفطر وفلفل وموزاريلا.",
      ],
    ),
    dish(
      "pizza-merguez",
      850,
      ["Merguez pizza", "Pizza merguez", "بيتزا مرقاز"],
      [
        "Spicy merguez, peppers, onion and mozzarella.",
        "Merguez épicées, poivrons, oignon et mozzarella.",
        "مرقاز حار وفلفل وبصل وموزاريلا.",
      ],
    ),
    dish(
      "pizza-viande-hachee",
      900,
      ["Minced beef pizza", "Pizza viande hachée", "بيتزا لحم مفروم"],
      [
        "Seasoned minced beef, onion and mozzarella.",
        "Viande hachée assaisonnée, oignon et mozzarella.",
        "لحم مفروم متبل وبصل وموزاريلا.",
      ],
    ),
  ],

  pasta: [
    dish(
      "pates-bolognaise",
      550,
      ["Spaghetti bolognese", "Spaghetti bolognaise", "سباغيتي بولونيز"],
      [
        "Spaghetti with slow-cooked beef and tomato sauce.",
        "Spaghetti, sauce tomate et bœuf mijoté.",
        "سباغيتي مع صلصة طماطم ولحم بقري مطهو ببطء.",
      ],
    ),
    dish(
      "pates-carbonara",
      600,
      ["Carbonara", "Carbonara", "كاربونارا"],
      [
        "Creamy pasta with turkey ham, cheese and pepper.",
        "Pâtes crémeuses au jambon de dinde, fromage et poivre.",
        "معكرونة كريمية مع لحم ديك رومي وجبن وفلفل.",
      ],
    ),
    dish(
      "pates-poulet-champignons",
      650,
      ["Chicken & mushroom pasta", "Pâtes poulet champignons", "معكرونة دجاج وفطر"],
      [
        "Penne in a cream sauce with chicken and mushrooms.",
        "Penne en sauce crème, poulet et champignons.",
        "بيني بصلصة الكريمة مع الدجاج والفطر.",
      ],
    ),
    dish(
      "lasagne",
      700,
      ["Lasagna", "Lasagnes", "لازانيا"],
      [
        "Baked layers of pasta, beef, béchamel and cheese.",
        "Pâtes en couches gratinées, bœuf, béchamel et fromage.",
        "طبقات معكرونة مخبوزة مع لحم وبشاميل وجبن.",
      ],
    ),
    dish(
      "rechta",
      700,
      ["Rechta", "Rechta", "رشتة"],
      [
        "Hand-cut noodles with chicken, turnip and chickpeas in a white sauce.",
        "Vermicelle fait main, poulet, navet et pois chiches en sauce blanche.",
        "رشتة بالدجاج واللفت والحمص في مرق أبيض.",
      ],
    ),
  ],

  dishes: [
    dish(
      "couscous-viande",
      900,
      ["Couscous with lamb", "Couscous à l'agneau", "كسكسي باللحم"],
      [
        "Steamed semolina with lamb, vegetables and chickpeas.",
        "Semoule vapeur, agneau, légumes et pois chiches.",
        "سميد مطهو على البخار مع لحم الخروف والخضار والحمص.",
      ],
    ),
    dish(
      "couscous-poulet",
      700,
      ["Couscous with chicken", "Couscous au poulet", "كسكسي بالدجاج"],
      [
        "Semolina with chicken, seasonal vegetables and broth.",
        "Semoule, poulet, légumes de saison et bouillon.",
        "سميد مع الدجاج وخضار الموسم والمرق.",
      ],
    ),
    dish(
      "chakhchoukha",
      950,
      ["Chakhchoukha", "Chakhchoukha", "شخشوخة"],
      [
        "Torn flatbread in a spicy lamb and chickpea sauce.",
        "Galette effilochée en sauce épicée à l'agneau et pois chiches.",
        "رقائق خبز مفتتة بمرق حار باللحم والحمص.",
      ],
    ),
    dish(
      "tajine-zitoun",
      850,
      ["Olive tajine", "Tajine zitoun", "طاجين الزيتون"],
      [
        "Chicken slow-cooked with green olives in a light sauce.",
        "Poulet mijoté aux olives vertes en sauce légère.",
        "دجاج مطهو ببطء مع الزيتون الأخضر في صلصة خفيفة.",
      ],
    ),
    dish(
      "dolma",
      800,
      ["Dolma", "Dolma", "دولمة"],
      [
        "Stuffed peppers, courgettes and onions in tomato sauce.",
        "Poivrons, courgettes et oignons farcis en sauce tomate.",
        "فلفل وكوسة وبصل محشي في صلصة طماطم.",
      ],
    ),
    dish(
      "loubia",
      500,
      ["Loubia (white beans)", "Loubia (haricots blancs)", "لوبيا"],
      [
        "White beans stewed in a spiced tomato sauce with meat.",
        "Haricots blancs mijotés en sauce tomate épicée avec viande.",
        "فاصوليا بيضاء بصلصة طماطم متبلة مع اللحم.",
      ],
    ),
    dish(
      "tlitli",
      750,
      ["Tlitli", "Tlitli", "تليتلي"],
      [
        "Fine pasta with chicken, cinnamon and chickpeas in white sauce.",
        "Pâtes fines au poulet, cannelle et pois chiches en sauce blanche.",
        "معكرونة رقيقة مع الدجاج والقرفة والحمص في مرق أبيض.",
      ],
    ),
  ],

  grills: [
    dish(
      "brochettes-viande",
      900,
      ["Beef skewers", "Brochettes de bœuf", "أسياخ لحم بقري"],
      [
        "Grilled beef skewers with fries and salad.",
        "Brochettes de bœuf grillées, frites et salade.",
        "أسياخ لحم بقري مشوية مع بطاطا وسلطة.",
      ],
    ),
    dish(
      "brochettes-poulet",
      700,
      ["Chicken skewers", "Brochettes de poulet", "أسياخ دجاج"],
      [
        "Marinated chicken skewers with fries and salad.",
        "Brochettes de poulet marinées, frites et salade.",
        "أسياخ دجاج متبلة مع بطاطا وسلطة.",
      ],
    ),
    dish(
      "merguez-grillees",
      650,
      ["Grilled merguez", "Merguez grillées", "مرقاز مشوي"],
      [
        "Spicy lamb sausages with fries and harissa.",
        "Saucisses d'agneau épicées, frites et harissa.",
        "نقانق خروف حارة مع بطاطا وهريسة.",
      ],
    ),
    dish(
      "cotelettes-agneau",
      1200,
      ["Lamb chops", "Côtelettes d'agneau", "ريش الخروف"],
      [
        "Grilled lamb chops with cumin and herbs.",
        "Côtelettes d'agneau grillées au cumin et aux herbes.",
        "ريش خروف مشوية بالكمون والأعشاب.",
      ],
    ),
    dish(
      "poulet-grille",
      800,
      ["Half grilled chicken", "Demi-poulet grillé", "نصف دجاجة مشوية"],
      [
        "Charcoal-grilled chicken with fries and salad.",
        "Poulet grillé au charbon, frites et salade.",
        "دجاج مشوي على الفحم مع بطاطا وسلطة.",
      ],
    ),
    dish(
      "mixed-grill",
      1500,
      ["Mixed grill platter", "Assiette de grillades mixtes", "طبق مشاوي مشكلة"],
      [
        "Beef, chicken, merguez and lamb chop for sharing.",
        "Bœuf, poulet, merguez et côtelette d'agneau à partager.",
        "لحم بقري ودجاج ومرقاز وريش خروف للمشاركة.",
      ],
    ),
  ],

  seafood: [
    dish(
      "poisson-grille",
      1100,
      ["Grilled sea bream", "Dorade grillée", "دوراد مشوي"],
      [
        "Whole grilled sea bream with lemon and herbs.",
        "Dorade entière grillée au citron et aux herbes.",
        "سمك دوراد كامل مشوي بالليمون والأعشاب.",
      ],
    ),
    dish(
      "chermoula-poisson",
      1000,
      ["Fish with chermoula", "Poisson à la chermoula", "سمك بالشرمولة"],
      [
        "Fish baked with a garlic, coriander and cumin marinade.",
        "Poisson au four mariné à l'ail, coriandre et cumin.",
        "سمك مخبوز بشرمولة الثوم والكزبرة والكمون.",
      ],
    ),
    dish(
      "calamars-frits",
      900,
      ["Fried calamari", "Calamars frits", "كلمار مقلي"],
      [
        "Crispy calamari rings with tartar sauce.",
        "Rondelles de calamars croustillantes, sauce tartare.",
        "حلقات كلمار مقرمشة مع صلصة التارتار.",
      ],
    ),
    dish(
      "crevettes-ail",
      1300,
      ["Garlic shrimp", "Crevettes à l'ail", "قمرون بالثوم"],
      [
        "Pan-seared shrimp with garlic, parsley and chilli.",
        "Crevettes poêlées à l'ail, persil et piment.",
        "قمرون مقلي بالثوم والمعدنوس والفلفل الحار.",
      ],
    ),
    dish(
      "sardines-grillees",
      700,
      ["Grilled sardines", "Sardines grillées", "سردين مشوي"],
      [
        "Fresh sardines grilled with lemon.",
        "Sardines fraîches grillées au citron.",
        "سردين طازج مشوي بالليمون.",
      ],
    ),
  ],

  sides: [
    dish(
      "frites",
      150,
      ["French fries", "Frites", "بطاطا مقلية"],
      ["Golden fries.", "Frites dorées.", "بطاطا مقلية ذهبية."],
    ),
    dish(
      "riz",
      150,
      ["Rice", "Riz", "أرز"],
      ["Steamed white rice.", "Riz blanc vapeur.", "أرز أبيض مطهو على البخار."],
    ),
    dish(
      "legumes-vapeur",
      200,
      ["Steamed vegetables", "Légumes vapeur", "خضار على البخار"],
      [
        "Carrots, courgettes and potatoes.",
        "Carottes, courgettes et pommes de terre.",
        "جزر وكوسة وبطاطا.",
      ],
    ),
    dish(
      "pain-maison",
      50,
      ["Homemade bread", "Pain maison", "خبز الدار"],
      [
        "Fresh homemade round loaf (kesra).",
        "Galette maison fraîche (kesra).",
        "خبز الدار الطازج (كسرة).",
      ],
    ),
    dish(
      "olives",
      100,
      ["Olives", "Olives", "زيتون"],
      [
        "Marinated green and black olives.",
        "Olives vertes et noires marinées.",
        "زيتون أخضر وأسود متبل.",
      ],
    ),
    dish(
      "harissa",
      50,
      ["Harissa", "Harissa", "هريسة"],
      ["Spicy pepper paste.", "Pâte de piment épicée.", "معجون فلفل حار."],
    ),
  ],

  desserts: [
    dish(
      "baklawa",
      300,
      ["Baklava (3 pieces)", "Baklawa (3 pièces)", "بقلاوة (3 قطع)"],
      [
        "Filo pastry with almonds and honey.",
        "Pâte filo aux amandes et au miel.",
        "عجينة رقيقة باللوز والعسل.",
      ],
    ),
    dish(
      "makroud",
      200,
      ["Makroud (3 pieces)", "Makroud (3 pièces)", "مقروط (3 قطع)"],
      [
        "Date-filled semolina diamonds, fried and dipped in honey.",
        "Losanges de semoule fourrés aux dattes, frits et nappés de miel.",
        "معينات سميد محشوة بالتمر ومقلية ومغموسة في العسل.",
      ],
    ),
    dish(
      "kalb-elouz",
      250,
      ["Kalb el louz", "Qalb el louz", "قلب اللوز"],
      [
        "Semolina and almond cake soaked in syrup.",
        "Gâteau de semoule et amandes imbibé de sirop.",
        "كعكة سميد ولوز مغمورة بالشراب.",
      ],
    ),
    dish(
      "zlabia",
      200,
      ["Zlabia", "Zlabia", "زلابية"],
      [
        "Crispy fried spirals soaked in honey syrup.",
        "Spirales frites croustillantes imbibées de sirop au miel.",
        "حلزونات مقلية مقرمشة مغموسة في شراب العسل.",
      ],
    ),
    dish(
      "creme-caramel",
      200,
      ["Crème caramel", "Crème caramel", "كريم كراميل"],
      ["Classic caramel custard.", "Flan caramel classique.", "حلوى كراميل كلاسيكية."],
    ),
    dish(
      "tiramisu",
      350,
      ["Tiramisu", "Tiramisu", "تيراميسو"],
      [
        "Coffee-soaked layers with mascarpone cream.",
        "Couches imbibées de café et crème au mascarpone.",
        "طبقات مبللة بالقهوة مع كريمة الماسكاربوني.",
      ],
    ),
    dish(
      "glace",
      250,
      ["Ice cream (3 scoops)", "Glace (3 boules)", "مثلجات (3 كرات)"],
      [
        "Vanilla, chocolate and strawberry.",
        "Vanille, chocolat et fraise.",
        "فانيليا وشوكولاتة وفراولة.",
      ],
    ),
  ],

  drinks: [
    dish(
      "eau-50",
      50,
      ["Water 50 cl", "Eau 50 cl", "ماء 50 سل"],
      ["Still mineral water.", "Eau minérale plate.", "ماء معدني."],
    ),
    dish(
      "eau-gazeuse",
      100,
      ["Sparkling water", "Eau gazeuse", "ماء غازي"],
      ["Sparkling mineral water 50 cl.", "Eau minérale gazeuse 50 cl.", "ماء معدني غازي 50 سل."],
    ),
    dish(
      "soda-33",
      100,
      ["Soda 33 cl", "Soda 33 cl", "مشروب غازي 33 سل"],
      ["Cola, orange or lemon.", "Cola, orange ou citron.", "كولا أو برتقال أو ليمون."],
    ),
    dish(
      "hamoud",
      100,
      ["Hamoud Boualem", "Hamoud Boualem", "حمود بوعلام"],
      [
        "Algerian classic: selecto or limonade.",
        "Le classique algérien : sélecto ou limonade.",
        "المشروب الجزائري الكلاسيكي: سيليكتو أو ليموناد.",
      ],
    ),
    dish(
      "ayran",
      120,
      ["Lben", "Lben", "لبن"],
      [
        "Chilled traditional buttermilk.",
        "Lait ribot traditionnel bien frais.",
        "لبن تقليدي بارد.",
      ],
    ),
    dish(
      "limonade-maison",
      200,
      ["Homemade lemonade", "Citronnade maison", "ليموناد الدار"],
      ["Fresh lemon, mint and sugar.", "Citron frais, menthe et sucre.", "ليمون طازج ونعناع وسكر."],
    ),
  ],

  "hot-drinks": [
    dish(
      "the-menthe",
      100,
      ["Mint tea", "Thé à la menthe", "شاي بالنعناع"],
      [
        "Green tea with fresh mint, served in a pot.",
        "Thé vert à la menthe fraîche, servi en théière.",
        "شاي أخضر بالنعناع الطازج يقدم في إبريق.",
      ],
    ),
    dish(
      "cafe-express",
      80,
      ["Espresso", "Café express", "قهوة إكسبريس"],
      ["Short, strong espresso.", "Espresso court et corsé.", "إكسبريس قصير وقوي."],
    ),
    dish(
      "cafe-creme",
      120,
      ["Café crème", "Café crème", "قهوة بالحليب"],
      ["Espresso with steamed milk.", "Espresso au lait chaud.", "إكسبريس مع حليب ساخن."],
    ),
    dish(
      "cappuccino",
      180,
      ["Cappuccino", "Cappuccino", "كابتشينو"],
      ["Espresso, milk and foam.", "Espresso, lait et mousse.", "إكسبريس وحليب ورغوة."],
    ),
    dish(
      "cafe-turc",
      150,
      ["Turkish coffee", "Café turc", "قهوة تركية"],
      [
        "Slow-brewed coffee, served in a cezve.",
        "Café infusé lentement, servi dans une cezve.",
        "قهوة محضرة ببطء تقدم في الركوة.",
      ],
    ),
    dish(
      "chocolat-chaud",
      200,
      ["Hot chocolate", "Chocolat chaud", "شوكولاتة ساخنة"],
      [
        "Rich chocolate with warm milk.",
        "Chocolat onctueux au lait chaud.",
        "شوكولاتة غنية مع حليب دافئ.",
      ],
    ),
  ],

  juices: [
    dish(
      "jus-orange",
      250,
      ["Fresh orange juice", "Jus d'orange pressé", "عصير برتقال طازج"],
      ["Squeezed to order.", "Pressé à la commande.", "يعصر عند الطلب."],
    ),
    dish(
      "jus-citron",
      200,
      ["Lemon juice", "Jus de citron", "عصير ليمون"],
      ["Fresh lemon with mint.", "Citron frais à la menthe.", "ليمون طازج بالنعناع."],
    ),
    dish(
      "jus-fraise",
      300,
      ["Strawberry juice", "Jus de fraise", "عصير فراولة"],
      ["Blended strawberries and milk.", "Fraises mixées au lait.", "فراولة مخفوقة مع الحليب."],
    ),
    dish(
      "jus-avocat",
      350,
      ["Avocado juice", "Jus d'avocat", "عصير أفوكادو"],
      [
        "Creamy avocado blended with milk and a drizzle of syrup.",
        "Avocat onctueux mixé au lait, filet de sirop.",
        "أفوكادو كريمي مخفوق مع الحليب وقليل من الشراب.",
      ],
    ),
    dish(
      "cocktail-fruits",
      400,
      ["Fruit cocktail", "Cocktail de fruits", "كوكتيل فواكه"],
      [
        "Layered fruit juice with banana, avocado and strawberry.",
        "Cocktail en couches : banane, avocat et fraise.",
        "كوكتيل طبقات من الموز والأفوكادو والفراولة.",
      ],
    ),
  ],

  breakfast: [
    dish(
      "chakchouka",
      400,
      ["Chakchouka", "Chakchouka", "شكشوكة"],
      [
        "Eggs poached in a pepper and tomato stew, served with bread.",
        "Œufs pochés dans un ragoût poivrons-tomates, servi avec du pain.",
        "بيض مطهو في يخنة الفلفل والطماطم مع الخبز.",
      ],
    ),
    dish(
      "msemen",
      100,
      ["Msemen with honey", "Msemen au miel", "مسمن بالعسل"],
      [
        "Layered semolina flatbread with honey and butter.",
        "Crêpe feuilletée de semoule au miel et au beurre.",
        "فطيرة سميد مورقة بالعسل والزبدة.",
      ],
    ),
    dish(
      "harcha",
      80,
      ["Harcha", "Harcha", "حرشة"],
      [
        "Pan-fried semolina bread, served warm.",
        "Galette de semoule poêlée, servie chaude.",
        "خبز سميد مقلي يقدم دافئا.",
      ],
    ),
    dish(
      "petit-dej-complet",
      600,
      ["Full breakfast", "Petit-déjeuner complet", "فطور كامل"],
      [
        "Eggs, olives, cheese, msemen, jam and a hot drink.",
        "Œufs, olives, fromage, msemen, confiture et boisson chaude.",
        "بيض وزيتون وجبن ومسمن ومربى ومشروب ساخن.",
      ],
    ),
    dish(
      "croissant-cafe",
      200,
      ["Croissant & coffee", "Croissant et café", "كرواسون وقهوة"],
      [
        "Butter croissant with a coffee of your choice.",
        "Croissant au beurre et café au choix.",
        "كرواسون بالزبدة مع قهوة حسب الاختيار.",
      ],
    ),
    dish(
      "mtewem",
      450,
      ["Omelette with merguez", "Omelette aux merguez", "عجة بالمرقاز"],
      [
        "Three-egg omelette with grilled merguez.",
        "Omelette de trois œufs aux merguez grillées.",
        "عجة بثلاث بيضات مع مرقاز مشوي.",
      ],
    ),
  ],

  kids: [
    dish(
      "kids-nuggets",
      450,
      ["Chicken nuggets", "Nuggets de poulet", "ناجتس دجاج"],
      [
        "Six nuggets with fries and a small drink.",
        "Six nuggets avec frites et petite boisson.",
        "ست قطع ناجتس مع بطاطا ومشروب صغير.",
      ],
    ),
    dish(
      "kids-burger",
      400,
      ["Mini burger", "Mini burger", "ميني برغر"],
      [
        "Small beef burger with fries and a small drink.",
        "Petit burger de bœuf avec frites et petite boisson.",
        "برغر لحم صغير مع بطاطا ومشروب صغير.",
      ],
    ),
    dish(
      "kids-pasta",
      350,
      ["Kids pasta", "Pâtes enfant", "معكرونة للأطفال"],
      [
        "Pasta with tomato sauce and cheese.",
        "Pâtes à la sauce tomate et au fromage.",
        "معكرونة بصلصة الطماطم والجبن.",
      ],
    ),
    dish(
      "kids-pizza",
      350,
      ["Mini pizza", "Mini pizza", "ميني بيتزا"],
      ["Small cheese pizza.", "Petite pizza au fromage.", "بيتزا صغيرة بالجبن."],
    ),
  ],
};
