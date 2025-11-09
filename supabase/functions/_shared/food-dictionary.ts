export type FoodCategoryId =
  | 'produce'
  | 'dairy'
  | 'meat_seafood'
  | 'bakery'
  | 'pantry'
  | 'beverages'
  | 'frozen'
  | 'snacks'
  | 'household'
  | 'personal_care'
  | 'baby'
  | 'pet';

export type FoodDictionaryEntry = {
  canonicalName: string;
  category: FoodCategoryId;
  aliases: string[];
  tags: string[];
  packaging: string[];
};

type SeedConfig = {
  product: string;
  brand?: string;
  variants?: string[];
  sizes?: string[];
  tags?: string[];
  packaging?: string[];
  aliases?: string[];
};

type ExpandableSeed = SeedConfig & { category: FoodCategoryId };

const STOP_WORDS = new Set(['pack', 'pkt', 'pkg', 'original', 'brand', 'fresh', 'jamaican']);

function pluralizeToken(token: string) {
  if (token.endsWith('y') && token.length > 3) {
    return `${token.slice(0, -1)}ies`;
  }
  if (token.endsWith('s')) {
    return token;
  }
  if (token.endsWith('sh') || token.endsWith('ch')) {
    return `${token}es`;
  }
  return `${token}s`;
}

function normalizeAlias(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function partsToCanonical(parts: Array<string | null | undefined>) {
  return parts
    .filter((part) => part && part.trim().length)
    .map((part) => part!.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandSeed(seed: ExpandableSeed): FoodDictionaryEntry[] {
  const variants = seed.variants?.length ? seed.variants : [null];
  const sizes = seed.sizes?.length ? seed.sizes : [null];
  const entries: FoodDictionaryEntry[] = [];

  for (const variant of variants) {
    for (const size of sizes) {
      const canonicalName = partsToCanonical([seed.brand, variant, seed.product, size]);
      if (!canonicalName) {
        continue;
      }
      const aliasSet = new Set<string>();
      aliasSet.add(normalizeAlias(seed.product));
      if (seed.brand) {
        aliasSet.add(normalizeAlias(`${seed.brand} ${seed.product}`));
      }
      if (variant) {
        aliasSet.add(normalizeAlias(`${variant} ${seed.product}`));
      }
      if (size) {
        aliasSet.add(normalizeAlias(`${seed.product} ${size}`));
      }
      seed.aliases?.forEach((alias) => aliasSet.add(normalizeAlias(alias)));

      const dedupedAliases: string[] = [];
      for (const alias of aliasSet) {
        if (!alias) continue;
        dedupedAliases.push(alias);
        const pluralWords = alias.split(' ').map((token) =>
          STOP_WORDS.has(token) ? token : pluralizeToken(token)
        );
        dedupedAliases.push(pluralWords.join(' '));
      }

      const tags = new Set<string>();
      seed.tags?.forEach((tag) => tags.add(tag.toLowerCase()));
      if (seed.brand) {
        tags.add(seed.brand.toLowerCase());
      }
      if (variant) {
        tags.add(variant.toLowerCase());
      }

      entries.push({
        canonicalName,
        category: seed.category,
        aliases: Array.from(new Set(dedupedAliases.filter(Boolean))),
        packaging: seed.packaging ?? [],
        tags: Array.from(tags)
      });
    }
  }

  return entries;
}

function expandSeeds(seeds: ExpandableSeed[]) {
  const byCanonical = new Map<string, FoodDictionaryEntry>();
  for (const seed of seeds) {
    for (const entry of expandSeed(seed)) {
      const existing = byCanonical.get(entry.canonicalName);
      if (!existing) {
        byCanonical.set(entry.canonicalName, entry);
        continue;
      }
      const aliases = new Set([...existing.aliases, ...entry.aliases]);
      const tags = new Set([...existing.tags, ...entry.tags]);
      byCanonical.set(entry.canonicalName, {
        ...existing,
        aliases: Array.from(aliases),
        tags: Array.from(tags)
      });
    }
  }
  return Array.from(byCanonical.values()).sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
}

const produceSeeds: ExpandableSeed[] = [
  {
    category: 'produce',
    product: 'Scotch Bonnet Pepper',
    variants: ['Fresh', 'Dried'],
    packaging: ['bag', 'tray'],
    tags: ['pepper', 'hot'],
    aliases: ['scotch bonnet', 'bonnet pepper', 'scotchie'],
  },
  {
    category: 'produce',
    product: 'Callaloo Bunch',
    variants: ['Fresh', 'Bagged'],
    packaging: ['bundle', 'bag'],
    tags: ['leafy'],
    aliases: ['callaloo greens'],
  },
  {
    category: 'produce',
    product: 'Pak Choi',
    variants: ['Baby', 'Large'],
    packaging: ['bundle'],
    tags: ['greens'],
    aliases: ['pakchoi', 'bok choy'],
  },
  {
    category: 'produce',
    product: 'Chocho',
    variants: ['Green', 'Mature'],
    packaging: ['loose'],
    tags: ['chayote'],
    aliases: ['christophene'],
  },
  {
    category: 'produce',
    product: 'Breadfruit',
    variants: ['Whole', 'Roasted'],
    packaging: ['loose', 'wrap'],
    tags: ['breadfruit'],
    aliases: ['roasted breadfruit'],
  },
  {
    category: 'produce',
    product: 'Yellow Yam',
    variants: ['Whole', 'Cut'],
    packaging: ['loose', 'tray'],
    tags: ['yam'],
  },
  {
    category: 'produce',
    product: 'White Yam',
    variants: ['Whole', 'Cut'],
    packaging: ['loose', 'tray'],
    tags: ['yam'],
  },
  {
    category: 'produce',
    product: 'Sweet Potato',
    variants: ['Orange', 'White'],
    packaging: ['bag', 'tray'],
    tags: ['potato'],
    aliases: ['jamaican sweet potato'],
  },
  {
    category: 'produce',
    product: 'Cassava Stick',
    variants: ['Fresh', 'Frozen'],
    packaging: ['bag', 'wrap'],
    tags: ['cassava', 'yuca'],
  },
  {
    category: 'produce',
    product: 'Eddoes',
    variants: ['Coco', 'Dasheen'],
    packaging: ['bag'],
    tags: ['taro'],
    aliases: ['coco yam'],
  },
  {
    category: 'produce',
    product: 'Pumpkin Slice',
    variants: ['Local', 'Caribbean'],
    packaging: ['wrap'],
    tags: ['pumpkin'],
  },
  {
    category: 'produce',
    product: 'Plantain',
    variants: ['Green', 'Ripe'],
    packaging: ['bunch'],
    tags: ['plantain'],
  },
  {
    category: 'produce',
    product: 'Banana Hand',
    variants: ['Green', 'Ripe'],
    packaging: ['bunch'],
    tags: ['banana'],
  },
  {
    category: 'produce',
    product: 'Mango',
    variants: ['Julie', 'East Indian', 'Number 11'],
    packaging: ['tray'],
    tags: ['mango'],
  },
  {
    category: 'produce',
    product: 'Pineapple',
    variants: ['Whole', 'Peeled'],
    packaging: ['loose', 'clamshell'],
    tags: ['pineapple'],
  },
  {
    category: 'produce',
    product: 'Cucumber',
    variants: ['Field', 'English'],
    packaging: ['bundle'],
    tags: ['cucumber'],
  },
  {
    category: 'produce',
    product: 'Tomato',
    variants: ['Roma', 'Cherry', 'Beefsteak'],
    packaging: ['tray', 'clamshell'],
    tags: ['tomato'],
  },
  {
    category: 'produce',
    product: 'Carrot',
    variants: ['Whole', 'Shredded'],
    packaging: ['bag', 'tray'],
    tags: ['carrot'],
  },
  {
    category: 'produce',
    product: 'Cabbage',
    variants: ['Green', 'Purple'],
    packaging: ['wrap'],
    tags: ['cabbage'],
  },
  {
    category: 'produce',
    product: 'Lettuce',
    variants: ['Romaine', 'Iceberg', 'Butter'],
    packaging: ['bag', 'clamshell'],
    tags: ['lettuce'],
  },
  {
    category: 'produce',
    product: 'Avocado',
    variants: ['Local', 'Hass'],
    packaging: ['tray'],
    tags: ['avocado', 'pear'],
  },
  {
    category: 'produce',
    product: 'Ackee Pod',
    variants: ['Fresh', 'Prepped'],
    packaging: ['tray', 'bag'],
    tags: ['ackee'],
  },
  {
    category: 'produce',
    product: 'Gungo Peas',
    variants: ['Green', 'Shelled'],
    packaging: ['bag'],
    tags: ['pigeon peas'],
  },
  {
    category: 'produce',
    product: 'Sorrel Bundle',
    variants: ['Fresh', 'Dried'],
    packaging: ['bag'],
    tags: ['sorrel'],
  },
  {
    category: 'produce',
    product: 'Ginger Root',
    variants: ['Fresh', 'Peeled'],
    packaging: ['bag'],
    tags: ['ginger'],
  },
  {
    category: 'produce',
    product: 'Thyme Bundle',
    variants: ['Fresh', 'Dried'],
    packaging: ['bundle'],
    tags: ['thyme'],
  },
  {
    category: 'produce',
    product: 'Escallion Bunch',
    packaging: ['bundle'],
    tags: ['scallion'],
  },
  {
    category: 'produce',
    product: 'Garlic Bulb',
    variants: ['Loose', 'Net'],
    packaging: ['net', 'bag'],
    tags: ['garlic'],
  },
];

const pantrySeeds: ExpandableSeed[] = [
  {
    category: 'pantry',
    product: 'Ackee',
    brand: 'Grace',
    sizes: ['300g', '540g'],
    packaging: ['can'],
    tags: ['ackee', 'canned'],
    aliases: ['tin ackee'],
  },
  {
    category: 'pantry',
    product: 'Callaloo',
    brand: 'Grace',
    sizes: ['289g', '540g'],
    packaging: ['can'],
    tags: ['callaloo'],
    aliases: ['tin callaloo'],
  },
  {
    category: 'pantry',
    product: 'Coconut Milk',
    brand: 'Grace',
    sizes: ['200ml', '400ml'],
    packaging: ['can'],
    tags: ['coconut milk'],
  },
  {
    category: 'pantry',
    product: 'Mackerel in Tomato Sauce',
    brand: 'Grace',
    sizes: ['155g', '200g'],
    packaging: ['can'],
    tags: ['mackerel'],
    aliases: ['tin mackerel'],
  },
  {
    category: 'pantry',
    product: 'Corned Beef',
    brand: 'Grace',
    sizes: ['198g', '340g'],
    packaging: ['can'],
    tags: ['corned beef'],
    aliases: ['bully beef'],
  },
  {
    category: 'pantry',
    product: 'Baked Beans',
    brand: 'Grace',
    sizes: ['300g', '400g'],
    packaging: ['can'],
    tags: ['beans'],
  },
  {
    category: 'pantry',
    product: 'Butter Beans',
    brand: 'Grace',
    sizes: ['300g', '400g'],
    packaging: ['can'],
    tags: ['beans'],
  },
  {
    category: 'pantry',
    product: 'Red Peas',
    brand: 'Grace',
    sizes: ['300g', '400g'],
    packaging: ['can'],
    tags: ['kidney beans'],
  },
  {
    category: 'pantry',
    product: 'Callaloo Pouch',
    brand: 'Grace',
    variants: ['Mild', 'Spicy'],
    packaging: ['pouch'],
    tags: ['callaloo'],
  },
  {
    category: 'pantry',
    product: 'Food Drink',
    brand: 'Lasco',
    variants: ['Vanilla', 'Chocolate', 'Strawberry'],
    sizes: ['120g', '400g'],
    packaging: ['sachet', 'bag'],
    tags: ['powder drink'],
  },
  {
    category: 'pantry',
    product: 'Instant Chocolate Mix',
    brand: 'Lasco',
    sizes: ['200g', '400g'],
    packaging: ['bag'],
    tags: ['chocolate'],
  },
  {
    category: 'pantry',
    product: 'Curry Powder',
    brand: 'Betapac',
    sizes: ['100g', '227g'],
    packaging: ['bag', 'tin'],
    tags: ['curry'],
  },
  {
    category: 'pantry',
    product: 'Jerk Seasoning',
    brand: 'Walkerswood',
    variants: ['Hot', 'Mild'],
    sizes: ['170g', '500g'],
    packaging: ['jar'],
    tags: ['jerk', 'seasoning'],
  },
  {
    category: 'pantry',
    product: 'Browning',
    brand: 'Grace',
    sizes: ['142ml', '284ml'],
    packaging: ['bottle'],
    tags: ['browning', 'sauce'],
  },
  {
    category: 'pantry',
    product: 'All Purpose Seasoning',
    brand: 'Maggi',
    sizes: ['100g', '200g'],
    packaging: ['bag'],
    tags: ['seasoning'],
  },
  {
    category: 'pantry',
    product: 'Chicken Noodle Soup',
    brand: 'Maggi',
    variants: ['Spicy', 'Pumpkin'],
    packaging: ['sachet'],
    tags: ['soup'],
  },
  {
    category: 'pantry',
    product: 'Vienna Sausage',
    brand: 'Eve',
    sizes: ['130g', '200g'],
    packaging: ['can'],
    tags: ['sausage'],
  },
  {
    category: 'pantry',
    product: 'Water Crackers',
    brand: 'National',
    sizes: ['284g', '454g'],
    packaging: ['box'],
    tags: ['cracker'],
    aliases: ['excelsior water cracker'],
  },
  {
    category: 'pantry',
    product: 'Cream Crackers',
    brand: 'Excelsior',
    sizes: ['200g', '400g'],
    packaging: ['box', 'bag'],
    tags: ['cracker'],
  },
  {
    category: 'pantry',
    product: 'Vegetable Oil',
    brand: 'Eve',
    sizes: ['500ml', '1L'],
    packaging: ['bottle'],
    tags: ['oil'],
  },
  {
    category: 'pantry',
    product: 'Oats Porridge Mix',
    brand: 'Lasco',
    sizes: ['120g', '400g'],
    packaging: ['sachet', 'bag'],
    tags: ['porridge'],
  },
  {
    category: 'pantry',
    product: 'Counter Flour',
    brand: 'Counter Flour',
    sizes: ['1kg', '2kg'],
    packaging: ['bag'],
    tags: ['flour'],
  },
  {
    category: 'pantry',
    product: 'Parboiled Rice',
    brand: 'Gold Seal',
    sizes: ['2kg', '5kg'],
    packaging: ['bag'],
    tags: ['rice'],
  },
  {
    category: 'pantry',
    product: 'Jasmine Rice',
    brand: 'Jasmine Choice',
    sizes: ['2kg', '4.5kg'],
    packaging: ['bag'],
    tags: ['rice'],
  },
  {
    category: 'pantry',
    product: 'Brown Sugar',
    brand: 'Lionel',
    sizes: ['1kg', '2kg'],
    packaging: ['bag'],
    tags: ['sugar'],
  },
  {
    category: 'pantry',
    product: 'Bag Juice',
    brand: 'Wata',
    variants: ['Cherry', 'Pineapple', 'Fruit Punch'],
    packaging: ['pouch'],
    tags: ['juice'],
  },
  {
    category: 'pantry',
    product: 'Tomato Ketchup',
    brand: 'Grace',
    sizes: ['11oz', '24oz'],
    packaging: ['bottle'],
    tags: ['ketchup'],
  },
  {
    category: 'pantry',
    product: 'Sweet Chili Sauce',
    brand: 'Grace',
    sizes: ['255g', '450g'],
    packaging: ['bottle'],
    tags: ['sauce'],
  },
  {
    category: 'pantry',
    product: 'Powdered Milk',
    brand: 'Lasco',
    sizes: ['400g', '1kg'],
    packaging: ['bag', 'tin'],
    tags: ['milk powder'],
  },
  {
    category: 'pantry',
    product: 'Sweetened Condensed Milk',
    brand: 'Nestle',
    sizes: ['300g', '397g'],
    packaging: ['can'],
    tags: ['condensed milk'],
  },
  {
    category: 'pantry',
    product: 'Evaporated Milk',
    brand: 'Nestle',
    sizes: ['410g', '354g'],
    packaging: ['can'],
    tags: ['evaporated milk'],
  },
  {
    category: 'pantry',
    product: 'Chocolate Drink Mix',
    brand: 'Milo',
    sizes: ['200g', '400g', '1kg'],
    packaging: ['tin', 'bag'],
    tags: ['chocolate'],
  },
  {
    category: 'pantry',
    product: 'Malted Drink Mix',
    brand: 'Ovaltine',
    sizes: ['400g', '800g'],
    packaging: ['tin'],
    tags: ['malt'],
  },
  {
    category: 'pantry',
    product: 'Instant Porridge',
    brand: 'Grace',
    variants: ['Peanut', 'Banana', 'Plantain'],
    packaging: ['sachet'],
    tags: ['porridge'],
  },
  {
    category: 'pantry',
    product: 'Jerk BBQ Sauce',
    brand: 'Grace',
    sizes: ['480g'],
    packaging: ['bottle'],
    tags: ['jerk', 'bbq'],
  },
];

const beveragesSeeds: ExpandableSeed[] = [
  {
    category: 'beverages',
    product: 'Purified Water',
    brand: 'Wata',
    sizes: ['500ml', '1.5L', '5L'],
    packaging: ['bottle'],
    tags: ['water'],
  },
  {
    category: 'beverages',
    product: 'Ting Grapefruit Soda',
    brand: 'D&G',
    sizes: ['355ml', '2L'],
    packaging: ['bottle'],
    tags: ['soda', 'grapefruit'],
    aliases: ['ting'],
  },
  {
    category: 'beverages',
    product: 'Kola Champagne Soda',
    brand: 'D&G',
    sizes: ['335ml', '2L'],
    packaging: ['bottle'],
    tags: ['soda'],
    aliases: ['kola champagne'],
  },
  {
    category: 'beverages',
    product: 'Ginger Beer',
    brand: 'D&G',
    sizes: ['335ml', '2L'],
    packaging: ['bottle'],
    tags: ['ginger beer'],
  },
  {
    category: 'beverages',
    product: 'Tru-Juice Carrot Juice',
    brand: 'Tru-Juice',
    sizes: ['500ml', '1L'],
    packaging: ['carton'],
    tags: ['juice', 'carrot'],
  },
  {
    category: 'beverages',
    product: 'Tru-Juice Sorrel Drink',
    brand: 'Tru-Juice',
    sizes: ['500ml', '1L'],
    packaging: ['carton'],
    tags: ['juice', 'sorrel'],
  },
  {
    category: 'beverages',
    product: 'Supligen Nutritional Drink',
    brand: 'Supligen',
    variants: ['Vanilla', 'Peanut'],
    sizes: ['330ml', '1L'],
    packaging: ['tetra'],
    tags: ['meal drink'],
  },
  {
    category: 'beverages',
    product: 'Nutrament Energy Drink',
    brand: 'Nutrament',
    variants: ['Vanilla', 'Chocolate'],
    sizes: ['355ml'],
    packaging: ['can'],
    tags: ['meal drink'],
  },
  {
    category: 'beverages',
    product: 'Magnum Tonic Wine',
    brand: 'Wray & Nephew',
    sizes: ['200ml'],
    packaging: ['bottle'],
    tags: ['tonic wine'],
  },
  {
    category: 'beverages',
    product: 'Dragon Stout',
    brand: 'Red Stripe',
    sizes: ['284ml'],
    packaging: ['bottle'],
    tags: ['beer', 'stout'],
  },
  {
    category: 'beverages',
    product: 'Blue Mountain Coffee',
    brand: 'Wallens',
    variants: ['Ground', 'Instant'],
    sizes: ['200g', '500g'],
    packaging: ['bag', 'jar'],
    tags: ['coffee'],
  },
  {
    category: 'beverages',
    product: 'Ginger Tea Bags',
    brand: 'Caribbean Dreams',
    sizes: ['24ct'],
    packaging: ['box'],
    tags: ['tea', 'ginger'],
  },
  {
    category: 'beverages',
    product: 'Peppermint Tea Bags',
    brand: 'Caribbean Dreams',
    sizes: ['24ct'],
    packaging: ['box'],
    tags: ['tea', 'peppermint'],
  },
  {
    category: 'beverages',
    product: 'Instant Coffee',
    brand: 'Lasco',
    sizes: ['100g', '200g'],
    packaging: ['jar'],
    tags: ['coffee'],
  },
  {
    category: 'beverages',
    product: 'Cocoa Drink Mix',
    brand: 'Swiss',
    sizes: ['300g', '600g'],
    packaging: ['bag'],
    tags: ['cocoa'],
  },
  {
    category: 'beverages',
    product: 'Bagged Chocolate Tea',
    brand: 'Chubby',
    variants: ['Spiced', 'Original'],
    packaging: ['pouch'],
    tags: ['tea', 'cocoa'],
  },
];

const bakerySeeds: ExpandableSeed[] = [
  {
    category: 'bakery',
    product: 'Hardo Bread',
    brand: 'National',
    variants: ['Large', 'Small'],
    packaging: ['bag'],
    tags: ['bread'],
  },
  {
    category: 'bakery',
    product: 'Coco Bread',
    brand: 'National',
    sizes: ['6ct', '12ct'],
    packaging: ['bag'],
    tags: ['bread'],
  },
  {
    category: 'bakery',
    product: 'Tastee Patty',
    brand: 'Tastee',
    variants: ['Beef', 'Chicken', 'Veggie'],
    sizes: ['Single', '6-Pack'],
    packaging: ['box'],
    tags: ['patty'],
  },
  {
    category: 'bakery',
    product: 'Festival Mix',
    brand: 'Grace',
    sizes: ['500g', '1kg'],
    packaging: ['bag'],
    tags: ['festival mix'],
  },
  {
    category: 'bakery',
    product: 'Bammy',
    brand: 'St. Mary',
    variants: ['Round', 'Wedge'],
    packaging: ['bag'],
    tags: ['bammy'],
  },
  {
    category: 'bakery',
    product: 'Bulla Cake',
    brand: 'National',
    variants: ['Ginger', 'Coconut'],
    sizes: ['Single', 'Twin'],
    packaging: ['wrap'],
    tags: ['bulla'],
  },
  {
    category: 'bakery',
    product: 'Spice Bun',
    brand: 'National',
    variants: ['Small', 'Giant'],
    packaging: ['wrap'],
    tags: ['bun'],
  },
  {
    category: 'bakery',
    product: 'Gizzada',
    brand: 'Local Artisan',
    sizes: ['2ct', '4ct'],
    packaging: ['tray'],
    tags: ['pastry'],
  },
  {
    category: 'bakery',
    product: 'Coconut Drops',
    brand: 'Local Artisan',
    sizes: ['2ct', '4ct'],
    packaging: ['tray'],
    tags: ['pastry'],
  },
  {
    category: 'bakery',
    product: 'Banana Chips',
    brand: 'St. Mary',
    variants: ['Original', 'Ripe'],
    sizes: ['30g', '100g'],
    packaging: ['bag'],
    tags: ['chips'],
  },
  {
    category: 'bakery',
    product: 'Plantain Chips',
    brand: 'Chippies',
    variants: ['Salted', 'Sweet'],
    sizes: ['30g', '85g'],
    packaging: ['bag'],
    tags: ['chips'],
  },
  {
    category: 'bakery',
    product: 'Cheeze Trix',
    brand: 'Holiday',
    variants: ['Mini', 'Giant'],
    sizes: ['35g', '90g'],
    packaging: ['bag'],
    tags: ['snack'],
  },
  {
    category: 'bakery',
    product: 'Big Foot Snack',
    brand: 'Holiday',
    variants: ['Cheese', 'Spicy'],
    sizes: ['40g', '85g'],
    packaging: ['bag'],
    tags: ['snack'],
  },
  {
    category: 'bakery',
    product: 'Shirley Biscuits',
    brand: 'Wibisco',
    variants: ['Original', 'Coconut'],
    sizes: ['40g', '200g'],
    packaging: ['pack', 'box'],
    tags: ['biscuit'],
  },
  {
    category: 'bakery',
    product: 'Butterkist Cookies',
    brand: 'National',
    variants: ['Ginger', 'Chocolate'],
    packaging: ['tray'],
    tags: ['cookie'],
  },
];

const dairySeeds: ExpandableSeed[] = [
  {
    category: 'dairy',
    product: 'Salted Butter',
    brand: 'Anchor',
    sizes: ['227g', '454g'],
    packaging: ['wrap'],
    tags: ['butter'],
  },
  {
    category: 'dairy',
    product: 'Cheddar Cheese',
    brand: 'Tastee',
    sizes: ['500g', '1kg'],
    packaging: ['block'],
    tags: ['cheese'],
  },
  {
    category: 'dairy',
    product: 'Full Cream Milk',
    brand: 'Seprod',
    sizes: ['1L', '2L'],
    packaging: ['carton'],
    tags: ['milk'],
  },
  {
    category: 'dairy',
    product: 'Whole Milk Powder',
    brand: 'Lasco',
    sizes: ['400g', '1kg'],
    packaging: ['bag', 'tin'],
    tags: ['milk powder'],
  },
  {
    category: 'dairy',
    product: 'Sweetened Condensed Milk',
    brand: 'Betty',
    sizes: ['397g'],
    packaging: ['can'],
    tags: ['condensed milk'],
  },
  {
    category: 'dairy',
    product: 'Evaporated Milk',
    brand: 'Betty',
    sizes: ['410g'],
    packaging: ['can'],
    tags: ['evaporated milk'],
  },
  {
    category: 'dairy',
    product: 'Kremi Ice Cream',
    brand: 'Kremi',
    variants: ['Grape Nut', 'Rum & Raisin'],
    sizes: ['1L', '1.5L'],
    packaging: ['tub'],
    tags: ['ice cream'],
  },
  {
    category: 'dairy',
    product: 'Fruit Yogurt',
    brand: 'Serge',
    variants: ['Strawberry', 'Guava'],
    sizes: ['150g'],
    packaging: ['cup'],
    tags: ['yogurt'],
  },
  {
    category: 'dairy',
    product: 'Cream Cheese',
    brand: 'Island Dairy',
    sizes: ['226g'],
    packaging: ['tub'],
    tags: ['cheese'],
  },
  {
    category: 'dairy',
    product: 'Margarine',
    brand: 'Golden Ray',
    sizes: ['250g', '500g'],
    packaging: ['tub'],
    tags: ['margarine'],
  },
];

const frozenSeeds: ExpandableSeed[] = [
  {
    category: 'frozen',
    product: 'Mixed Vegetables',
    brand: 'Caribbean Choice',
    sizes: ['500g', '1kg'],
    packaging: ['bag'],
    tags: ['veggies'],
  },
  {
    category: 'frozen',
    product: 'Frozen Callaloo',
    brand: 'Jamaica Best',
    sizes: ['1lb'],
    packaging: ['bag'],
    tags: ['callaloo'],
  },
  {
    category: 'frozen',
    product: 'Frozen Ackee',
    brand: 'Linstead Market',
    sizes: ['1lb'],
    packaging: ['bag'],
    tags: ['ackee'],
  },
  {
    category: 'frozen',
    product: 'Frozen Bammy',
    brand: 'Coco Bread Co',
    sizes: ['2ct', '4ct'],
    packaging: ['bag'],
    tags: ['bammy'],
  },
  {
    category: 'frozen',
    product: 'Festival Dough',
    brand: 'Grace',
    sizes: ['500g', '1kg'],
    packaging: ['bag'],
    tags: ['festival'],
  },
  {
    category: 'frozen',
    product: 'Chicken Nuggets',
    brand: 'Best Dressed',
    sizes: ['500g', '1kg'],
    packaging: ['bag'],
    tags: ['nuggets'],
  },
  {
    category: 'frozen',
    product: 'French Fries',
    brand: 'Cavendish',
    variants: ['Straight', 'Crinkle'],
    sizes: ['900g'],
    packaging: ['bag'],
    tags: ['fries'],
  },
  {
    category: 'frozen',
    product: 'Fish Sticks',
    brand: 'Seafest',
    sizes: ['500g'],
    packaging: ['box'],
    tags: ['fish sticks'],
  },
  {
    category: 'frozen',
    product: 'Frozen Shrimp',
    brand: 'Rainforest',
    variants: ['Medium', 'Large'],
    sizes: ['454g'],
    packaging: ['bag'],
    tags: ['shrimp'],
  },
  {
    category: 'frozen',
    product: 'Frozen Patties',
    brand: 'Tastee',
    variants: ['Beef', 'Veggie'],
    sizes: ['4ct'],
    packaging: ['box'],
    tags: ['patty'],
  },
];

const meat_seafoodSeeds: ExpandableSeed[] = [
  {
    category: 'meat_seafood',
    product: 'Chicken Leg Quarters',
    brand: 'Best Dressed',
    sizes: ['5lb', '10lb'],
    packaging: ['bag'],
    tags: ['chicken'],
  },
  {
    category: 'meat_seafood',
    product: 'Chicken Thighs',
    brand: 'Best Dressed',
    sizes: ['2kg', '5kg'],
    packaging: ['bag'],
    tags: ['chicken'],
  },
  {
    category: 'meat_seafood',
    product: 'Whole Chicken',
    brand: 'Best Dressed',
    sizes: ['2kg', '3kg'],
    packaging: ['bag'],
    tags: ['chicken'],
  },
  {
    category: 'meat_seafood',
    product: 'Chicken Back',
    brand: 'Copperwood',
    sizes: ['2kg'],
    packaging: ['bag'],
    tags: ['chicken'],
  },
  {
    category: 'meat_seafood',
    product: 'Goat Meat',
    brand: 'Evergreen',
    sizes: ['1kg', '2kg'],
    packaging: ['tray'],
    tags: ['goat'],
  },
  {
    category: 'meat_seafood',
    product: 'Oxtail',
    brand: 'Evergreen',
    sizes: ['1kg'],
    packaging: ['tray'],
    tags: ['oxtail'],
  },
  {
    category: 'meat_seafood',
    product: 'Beef Stew',
    brand: 'Evergreen',
    sizes: ['1kg'],
    packaging: ['tray'],
    tags: ['beef'],
  },
  {
    category: 'meat_seafood',
    product: 'Pork Shoulder',
    brand: 'Copperwood',
    sizes: ['2kg'],
    packaging: ['tray'],
    tags: ['pork'],
  },
  {
    category: 'meat_seafood',
    product: 'Saltfish Fillet',
    brand: 'Grace',
    sizes: ['454g', '907g'],
    packaging: ['bag'],
    tags: ['saltfish'],
  },
  {
    category: 'meat_seafood',
    product: 'Whole Snapper',
    brand: 'Rainforest',
    variants: ['Small', 'Large'],
    packaging: ['tray'],
    tags: ['snapper'],
  },
  {
    category: 'meat_seafood',
    product: 'Tilapia Fillet',
    brand: 'Rainforest',
    sizes: ['1kg'],
    packaging: ['bag'],
    tags: ['tilapia'],
  },
  {
    category: 'meat_seafood',
    product: 'Smoked Herring',
    brand: 'Grace',
    sizes: ['200g'],
    packaging: ['pack'],
    tags: ['herring'],
  },
  {
    category: 'meat_seafood',
    product: 'Chicken Frankfurters',
    brand: 'Grace',
    sizes: ['454g', '900g'],
    packaging: ['pack'],
    tags: ['franks'],
  },
  {
    category: 'meat_seafood',
    product: 'Turkey Neck',
    brand: 'Evergreen',
    sizes: ['1kg'],
    packaging: ['tray'],
    tags: ['turkey neck'],
  },
  {
    category: 'meat_seafood',
    product: 'Pork Chops',
    brand: 'Copperwood',
    sizes: ['1kg'],
    packaging: ['tray'],
    tags: ['pork chops'],
  },
];

const snacksSeeds: ExpandableSeed[] = [
  {
    category: 'snacks',
    product: 'Banana Chips',
    brand: 'St. Mary',
    variants: ['Original', 'Ripe'],
    sizes: ['30g', '100g'],
    packaging: ['bag'],
    tags: ['banana chips'],
  },
  {
    category: 'snacks',
    product: 'Plantain Chips',
    brand: 'Chippies',
    variants: ['Salted', 'Sweet'],
    sizes: ['30g', '85g'],
    packaging: ['bag'],
    tags: ['plantain chips'],
  },
  {
    category: 'snacks',
    product: 'Cheeze Trix',
    brand: 'Holiday',
    variants: ['Mini', 'Giant'],
    sizes: ['35g', '90g'],
    packaging: ['bag'],
    tags: ['cheese snack'],
  },
  {
    category: 'snacks',
    product: 'Big Foot',
    brand: 'Holiday',
    variants: ['Cheese', 'Spicy'],
    sizes: ['40g', '85g'],
    packaging: ['bag'],
    tags: ['cheese snack'],
  },
  {
    category: 'snacks',
    product: 'Shirley Biscuits',
    brand: 'Wibisco',
    variants: ['Original', 'Coconut'],
    sizes: ['40g', '200g'],
    packaging: ['pack', 'box'],
    tags: ['biscuit'],
  },
  {
    category: 'snacks',
    product: 'Butterkist Cookies',
    brand: 'National',
    variants: ['Ginger', 'Chocolate'],
    packaging: ['tray'],
    tags: ['cookie'],
  },
  {
    category: 'snacks',
    product: 'Coconut Drops',
    brand: 'Local Artisan',
    sizes: ['2ct', '4ct'],
    packaging: ['tray'],
    tags: ['candy'],
  },
  {
    category: 'snacks',
    product: 'Peanut Cake',
    brand: 'Local Artisan',
    sizes: ['2ct', '4ct'],
    packaging: ['wrap'],
    tags: ['candy'],
  },
  {
    category: 'snacks',
    product: 'Gizzada',
    brand: 'Local Artisan',
    sizes: ['2ct', '4ct'],
    packaging: ['tray'],
    tags: ['pastry'],
  },
  {
    category: 'snacks',
    product: 'Tamarind Ball',
    brand: 'Annilu',
    sizes: ['4ct', '8ct'],
    packaging: ['jar'],
    tags: ['candy'],
  },
];

const householdSeeds: ExpandableSeed[] = [
  {
    category: 'household',
    product: 'Laundry Detergent',
    brand: 'Breeze',
    sizes: ['1.8kg', '3kg'],
    packaging: ['bag'],
    tags: ['detergent'],
  },
  {
    category: 'household',
    product: 'Dishwashing Liquid',
    brand: 'Sunlight',
    sizes: ['500ml', '1L'],
    packaging: ['bottle'],
    tags: ['dish soap'],
  },
  {
    category: 'household',
    product: 'Disinfectant Cleaner',
    brand: 'Fabuloso',
    sizes: ['1L', '1.8L'],
    packaging: ['bottle'],
    tags: ['cleaner'],
  },
  {
    category: 'household',
    product: 'Bleach',
    brand: 'Clorox',
    sizes: ['1L', '3.78L'],
    packaging: ['bottle'],
    tags: ['bleach'],
  },
  {
    category: 'household',
    product: 'Fabric Softener',
    brand: 'Downy',
    sizes: ['900ml', '1.8L'],
    packaging: ['bottle'],
    tags: ['softener'],
  },
  {
    category: 'household',
    product: 'Disinfectant Spray',
    brand: 'Lysol',
    sizes: ['354g'],
    packaging: ['aerosol'],
    tags: ['spray'],
  },
  {
    category: 'household',
    product: 'Air Freshener',
    brand: 'Glade',
    sizes: ['Twin Pack'],
    packaging: ['aerosol'],
    tags: ['air freshener'],
  },
  {
    category: 'household',
    product: 'Garbage Bags',
    brand: 'Glad',
    variants: ['Kitchen', 'Lawn'],
    sizes: ['20ct', '10ct'],
    packaging: ['box'],
    tags: ['bags'],
  },
  {
    category: 'household',
    product: 'Aluminum Foil',
    brand: 'Reynolds',
    sizes: ['50ft', '100ft'],
    packaging: ['box'],
    tags: ['foil'],
  },
  {
    category: 'household',
    product: 'Freezer Bags',
    brand: 'Ziploc',
    variants: ['Quart', 'Gallon'],
    sizes: ['30ct', '20ct'],
    packaging: ['box'],
    tags: ['bags'],
  },
  {
    category: 'household',
    product: 'Paper Towels',
    brand: 'Bounty',
    sizes: ['2 roll', '6 roll'],
    packaging: ['pack'],
    tags: ['paper towel'],
  },
  {
    category: 'household',
    product: 'Toilet Tissue',
    brand: 'Scott',
    sizes: ['4 pack', '12 pack'],
    packaging: ['pack'],
    tags: ['tissue'],
  },
];

const personal_careSeeds: ExpandableSeed[] = [
  {
    category: 'personal_care',
    product: 'Toothpaste',
    brand: 'Colgate',
    sizes: ['100ml', '150ml'],
    packaging: ['tube'],
    tags: ['toothpaste'],
  },
  {
    category: 'personal_care',
    product: 'Bath Soap',
    brand: 'Protex',
    variants: ['Original', 'Aloe'],
    packaging: ['bar'],
    tags: ['soap'],
  },
  {
    category: 'personal_care',
    product: 'Beauty Soap',
    brand: 'Dove',
    variants: ['Original', 'Shea'],
    packaging: ['bar'],
    tags: ['soap'],
  },
  {
    category: 'personal_care',
    product: 'Roll-on Deodorant',
    brand: 'Sure',
    variants: ['Powder', 'Fresh'],
    packaging: ['bottle'],
    tags: ['deodorant'],
  },
  {
    category: 'personal_care',
    product: 'Body Spray',
    brand: 'Axe',
    variants: ['Dark Temptation', 'Apollo'],
    packaging: ['aerosol'],
    tags: ['spray'],
  },
  {
    category: 'personal_care',
    product: 'Body Lotion',
    brand: 'Jergens',
    sizes: ['295ml', '621ml'],
    packaging: ['bottle'],
    tags: ['lotion'],
  },
  {
    category: 'personal_care',
    product: 'Hair Oil',
    brand: 'Blue Magic',
    sizes: ['142g', '340g'],
    packaging: ['jar'],
    tags: ['hair oil'],
  },
  {
    category: 'personal_care',
    product: 'Styling Gel',
    brand: 'Eco Styler',
    sizes: ['16oz', '32oz'],
    packaging: ['jar'],
    tags: ['hair gel'],
  },
  {
    category: 'personal_care',
    product: 'Sanitary Pads',
    brand: 'Always',
    variants: ['Regular', 'Overnight'],
    packaging: ['pack'],
    tags: ['pads'],
  },
  {
    category: 'personal_care',
    product: 'Pantyliners',
    brand: 'Stayfree',
    sizes: ['50ct'],
    packaging: ['box'],
    tags: ['liners'],
  },
  {
    category: 'personal_care',
    product: 'Shaving Foam',
    brand: 'Gillette',
    sizes: ['200ml'],
    packaging: ['can'],
    tags: ['shaving'],
  },
  {
    category: 'personal_care',
    product: 'Hair Relaxer',
    brand: 'Soft Sheen',
    variants: ['Regular', 'Super'],
    packaging: ['kit'],
    tags: ['relaxer'],
  },
];

const babySeeds: ExpandableSeed[] = [
  {
    category: 'baby',
    product: 'Diapers Size 2',
    brand: 'Huggies',
    sizes: ['36ct'],
    packaging: ['bag'],
    tags: ['diaper'],
  },
  {
    category: 'baby',
    product: 'Diapers Size 4',
    brand: 'Huggies',
    sizes: ['60ct'],
    packaging: ['bag'],
    tags: ['diaper'],
  },
  {
    category: 'baby',
    product: 'Baby Wipes',
    brand: 'Pampers',
    sizes: ['56ct', '168ct'],
    packaging: ['pack'],
    tags: ['wipes'],
  },
  {
    category: 'baby',
    product: 'Infant Formula',
    brand: 'Enfamil',
    sizes: ['12.5oz', '21oz'],
    packaging: ['tin'],
    tags: ['formula'],
  },
  {
    category: 'baby',
    product: 'Toddler Formula',
    brand: 'Nan Pro',
    sizes: ['400g', '800g'],
    packaging: ['tin'],
    tags: ['formula'],
  },
  {
    category: 'baby',
    product: 'Cereal',
    brand: 'Cerelac',
    variants: ['Wheat', 'Banana'],
    sizes: ['400g'],
    packaging: ['tin'],
    tags: ['cereal'],
  },
  {
    category: 'baby',
    product: 'Baby Lotion',
    brand: 'Johnson',
    sizes: ['200ml', '500ml'],
    packaging: ['bottle'],
    tags: ['lotion'],
  },
  {
    category: 'baby',
    product: 'Baby Oil',
    brand: 'Johnson',
    sizes: ['300ml'],
    packaging: ['bottle'],
    tags: ['oil'],
  },
  {
    category: 'baby',
    product: 'Feeding Bottles',
    brand: 'Avent',
    sizes: ['9oz Twin'],
    packaging: ['box'],
    tags: ['bottle'],
  },
  {
    category: 'baby',
    product: 'Bib Set',
    brand: 'Tiny Tots',
    sizes: ['3ct'],
    packaging: ['pack'],
    tags: ['bib'],
  },
];

const petSeeds: ExpandableSeed[] = [
  {
    category: 'pet',
    product: 'Dog Chow Adult',
    brand: 'Purina',
    sizes: ['3kg', '8kg'],
    packaging: ['bag'],
    tags: ['dog food'],
  },
  {
    category: 'pet',
    product: 'Pedigree Adult Meal',
    brand: 'Pedigree',
    sizes: ['5kg'],
    packaging: ['bag'],
    tags: ['dog food'],
  },
  {
    category: 'pet',
    product: 'Pedigree Puppy Meal',
    brand: 'Pedigree',
    sizes: ['3kg'],
    packaging: ['bag'],
    tags: ['dog food'],
  },
  {
    category: 'pet',
    product: 'Cat Chow Complete',
    brand: 'Purina',
    sizes: ['1.5kg'],
    packaging: ['bag'],
    tags: ['cat food'],
  },
  {
    category: 'pet',
    product: 'Whiskas Pouches',
    brand: 'Whiskas',
    sizes: ['85g'],
    packaging: ['pouch'],
    tags: ['cat food'],
  },
  {
    category: 'pet',
    product: 'Fresh Step Cat Litter',
    brand: 'Fresh Step',
    sizes: ['10lb'],
    packaging: ['box'],
    tags: ['litter'],
  },
  {
    category: 'pet',
    product: 'Pet Shampoo',
    brand: 'Bio-Groom',
    sizes: ['355ml'],
    packaging: ['bottle'],
    tags: ['shampoo'],
  },
  {
    category: 'pet',
    product: 'Dog Treats',
    brand: 'Beggin Strips',
    sizes: ['170g'],
    packaging: ['bag'],
    tags: ['treat'],
  },
];

const dictionarySeeds: ExpandableSeed[] = [
  ...produceSeeds,
  ...pantrySeeds,
  ...beveragesSeeds,
  ...bakerySeeds,
  ...dairySeeds,
  ...frozenSeeds,
  ...meat_seafoodSeeds,
  ...snacksSeeds,
  ...householdSeeds,
  ...personal_careSeeds,
  ...babySeeds,
  ...petSeeds
];

export const foodDictionary = expandSeeds(dictionarySeeds);
export const FOOD_DICTIONARY_VERSION = '2025.11.09';
export const FOOD_DICTIONARY_COUNT = foodDictionary.length;

if (FOOD_DICTIONARY_COUNT < 200) {
  console.warn(`foodDictionary seeded with ${FOOD_DICTIONARY_COUNT} entries, expected >= 200`);
}
