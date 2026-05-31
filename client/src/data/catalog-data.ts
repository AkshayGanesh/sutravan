/**
 * Glob-free catalog metadata — the single source of truth for product + category
 * content, importable by BOTH Node (scripts/seed.ts) and Vite (client) because it
 * contains NO Vite-only glob macro (RESEARCH Pitfall 2 — the glob loader in
 * products.ts crashes outside Vite).
 *
 * This module holds only plain data + maps. Image bytes live on disk (seed time)
 * and in Storage (read time); this module never imports an image asset.
 *
 * Slugs are the globally-unique, category-prefixed identifiers (e.g. `soap-neem`,
 * `scrub-neem`) carried verbatim from products.ts `id` — do NOT collapse to bare
 * names (RESEARCH Pattern 1 / A2). Plan 02 re-exports these via products.ts.
 */

export type Category = 'soap' | 'scrub' | 'cream';

export interface ProductMeta {
  slug: string;
  name: string;
  subtitle: string;
  category: Category;
  benefits: string[];
  ingredients: string[];
  tips?: string[];
  shelfLife: string;
  batchNote: string;
}

export interface CategoryMeta {
  slug: Category;
  label: string;
  description: string;
  sortOrder: number;
}

export const BATCH_NOTE = 'Freshly handmade in small batches.';

export const categoryMeta: CategoryMeta[] = [
  {
    slug: 'soap',
    label: 'Soaps',
    description: 'Handcrafted cleansing bars made with natural ingredients for every skin type.',
    sortOrder: 0,
  },
  {
    slug: 'scrub',
    label: 'Scrubs',
    description: 'Gentle exfoliating formulations that double as face packs.',
    sortOrder: 1,
  },
  {
    slug: 'cream',
    label: 'Creams',
    description: 'Nourishing moisturizers crafted from fresh, natural ingredients.',
    sortOrder: 2,
  },
];

/**
 * Maps each soap product slug -> its disk folder under
 * client/src/assets/images/products/Soap/. Folder names verified on disk.
 */
export const SLUG_TO_SOAP_FOLDER: Record<string, string> = {
  'soap-neem': 'Neem',
  'soap-turmeric': 'Turmeric',
  'soap-aloe-vera': 'AloeVera',
  'soap-multani-mitti': "Fuller_s Earth",
  'soap-orange-peel': 'Orange',
  'soap-sandalwood': 'Sandalwood',
  'soap-charcoal': 'Charcoal',
  'soap-rose': 'Rose',
  'soap-lemon-peel': 'Lemon',
  'soap-rice': 'Rice',
  'soap-milk': 'Milk',
  'soap-oats': 'Oats',
  'soap-coffee': 'Coffee',
};

export const productMeta: ProductMeta[] = [
  // ─── SOAPS ───────────────────────────────────────────────
  {
    slug: 'soap-neem',
    name: 'Neem',
    subtitle: 'For oily, pimples & acne-prone skin',
    category: 'soap',
    benefits: [
      'Antibacterial & antifungal',
      'Reduces pimples and skin infections',
      'Controls excess oil',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Natural Neem leaves powder',
      'Dried Haldi powder (Turmeric)',
      'Aloe vera gel (optional - as per customisation request)',
      'Coconut oil (optional - as per customisation request)',
      'Few drops essential oil',
    ],
    shelfLife: 'Best enjoyed within 6 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'soap-turmeric',
    name: 'Turmeric',
    subtitle: 'For dull skin & pigmentation',
    category: 'soap',
    benefits: [
      'Brightens skin',
      'Reduces dark spots',
      'Anti-inflammatory',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Dried Haldi powder (Turmeric)',
      'Dried Chandan Powder (Sandalwood)',
      'Dried Multani Mitti Powder (Fuller\'s earth) (optional - as per customisation request)',
      'Few drops essential oil',
    ],
    shelfLife: 'Best enjoyed within 6 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'soap-aloe-vera',
    name: 'Aloe Vera',
    subtitle: 'For sensitive & dry skin',
    category: 'soap',
    benefits: [
      'Deep hydration',
      'Soothes irritation',
      'Helps sunburn',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Fresh Aloe vera gel',
      'Vitamin E oil',
      'Few drops essential oil',
    ],
    shelfLife: 'Best enjoyed within 3 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'soap-multani-mitti',
    name: 'Multani Mitti',
    subtitle: 'For oily & combination skin',
    category: 'soap',
    benefits: [
      'Absorbs excess oil',
      'Tightens pores',
      'Detoxifies skin',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Multani Mitti (Fuller\'s earth)',
      'Dried Chandan Powder (Sandalwood)',
      'Natural Homemade Gulab Jal (Rose Water) (optional - as per customisation request)',
      'Few drops essential oil',
    ],
    shelfLife: 'Best enjoyed within 6 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'soap-orange-peel',
    name: 'Orange Peel',
    subtitle: 'For tanned & uneven skin - Seasonal',
    category: 'soap',
    benefits: [
      'Natural exfoliation',
      'Removes tan',
      'Refreshing fragrance',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Dried Orange peel powder',
      'Dried Haldi powder (Turmeric)',
      'Few drops essential oil',
    ],
    tips: ['Best for cold climate', 'Not ideal for dry or sensitive skin'],
    shelfLife: 'Best enjoyed within 3 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'soap-sandalwood',
    name: 'Sandalwood',
    subtitle: 'For normal & sensitive skin',
    category: 'soap',
    benefits: [
      'Calms skin',
      'Reduces redness',
      'Natural fragrance',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Dried Chandan Powder (Sandalwood)',
      'Natural Homemade Gulab Jal (Rose Water)',
      'Few drops essential oil',
      'Coconut oil (optional - as per customisation request)',
    ],
    shelfLife: 'Best enjoyed within 6 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'soap-charcoal',
    name: 'Charcoal Herbal',
    subtitle: 'For deep cleansing',
    category: 'soap',
    benefits: [
      'Deep pore cleansing',
      'Removes toxins',
      'Helps blackheads',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Activated charcoal powder',
      'Aloe vera gel',
      'Tea tree oil',
    ],
    tips: ['Not ideal for dry or sensitive skin'],
    shelfLife: 'Best enjoyed within 6 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'soap-rose',
    name: 'Rose',
    subtitle: 'For sensitive, normal & dry skin',
    category: 'soap',
    benefits: [
      'Soothes irritation',
      'Reduces redness',
      'Mild toning effect',
      'Natural fragrance & freshness',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Natural Rose petal powder or dried crushed rose petals',
      'Vitamin E oil',
      'Few drops essential oil',
    ],
    shelfLife: 'Best enjoyed within 3 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'soap-lemon-peel',
    name: 'Lemon Peel',
    subtitle: 'For tanned & uneven skin - Seasonal',
    category: 'soap',
    benefits: [
      'Natural exfoliation',
      'Removes tan',
      'Refreshing fragrance',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Dried Lemon peel powder',
      'Dried Haldi powder (Turmeric)',
      'Dried Chandan Powder (Sandalwood) (optional - as per customisation request)',
      'Few drops essential oil',
    ],
    tips: ['Best for cold climate', 'Not ideal for dry or sensitive skin'],
    shelfLife: 'Best enjoyed within 6 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'soap-rice',
    name: 'Rice',
    subtitle: 'For dull skin, uneven tone & mild pigmentation',
    category: 'soap',
    benefits: [
      'Natural skin brightening',
      'Gentle exfoliation',
      'Improves skin texture',
      'Makes skin soft & smooth',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Rice flour or thick Rice water',
      'Coconut oil (optional - as per customisation request)',
      'Few drops essential oil',
    ],
    tips: ['Not ideal for dry skin'],
    shelfLife: 'Best enjoyed within 3 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'soap-milk',
    name: 'Milk',
    subtitle: 'For dull or dry skin',
    category: 'soap',
    benefits: [
      'Deep hydration',
      'Makes skin soft & supple',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Milk powder',
      'Coconut oil (optional - as per customisation request)',
      'Few drops essential oil',
    ],
    tips: ['Best for winter or dry climate', 'Not ideal for oily skin'],
    shelfLife: 'Best enjoyed within 3 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'soap-oats',
    name: 'Oats',
    subtitle: 'For sensitive skin',
    category: 'soap',
    benefits: [
      'Gentle exfoliation',
      'Soothes itchy skin',
      'Improves skin texture',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Finely ground oats',
      'Milk powder (optional - as per customisation request)',
      'Coconut oil',
    ],
    shelfLife: 'Best enjoyed within 3 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'soap-coffee',
    name: 'Coffee',
    subtitle: 'For tan removing and firming',
    category: 'soap',
    benefits: [
      'Removes tan',
      'Improves circulation',
      'Reduces rough skin',
      'Improves skin texture',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Finely ground coffee or coffee powder',
      'Coconut oil',
      'Few drops orange essential oil',
    ],
    tips: ['Not ideal for sensitive skin'],
    shelfLife: 'Best enjoyed within 3 months',
    batchNote: BATCH_NOTE,
  },

  // ─── SCRUBS ──────────────────────────────────────────────
  {
    slug: 'scrub-neem',
    name: 'Neem Face Scrub cum Face Pack',
    subtitle: 'For acne & oily skin',
    category: 'scrub',
    benefits: [
      'Prevents acne',
      'Antibacterial',
      'Controls excess oil',
      'Reduces inflammation',
    ],
    ingredients: [
      'Neem leaves powder',
      'Dried Haldi powder (Turmeric)',
      'Dried Chandan Powder (Sandalwood)',
      'Fine grounded white sugar',
    ],
    tips: ['Best to use it with aloe vera gel or rose water'],
    shelfLife: 'Best enjoyed within 6 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'scrub-multani-mitti',
    name: 'Multani Mitti Face Scrub cum Face Pack',
    subtitle: 'For oily & acne-prone skin',
    category: 'scrub',
    benefits: [
      'Absorbs excess oil',
      'Detoxifies skin',
      'Tightens pores',
      'Reduces acne',
    ],
    ingredients: [
      'Multani Mitti powder (Fuller\'s earth)',
      'Dried Chandan Powder (Sandalwood)',
      'Dried Haldi powder (Turmeric)',
      'Natural Rose petal powder or dried crushed rose petals (optional)',
      'Fine grounded white sugar',
    ],
    tips: ['Best to use it with rose water'],
    shelfLife: 'Best enjoyed within 6 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'scrub-orange-peel',
    name: 'Orange Peel Face Scrub cum Face Pack',
    subtitle: 'For dull & oily skin',
    category: 'scrub',
    benefits: [
      'Natural vitamin C boost',
      'Controls oil',
      'Reduces dullness',
      'Mild exfoliation',
    ],
    ingredients: [
      'Dried Orange peel powder',
      'Dried Haldi powder (Turmeric)',
      'Fine grounded white sugar (optional)',
    ],
    tips: ['Best to use it with curd or rose water'],
    shelfLife: 'Best enjoyed within 3 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'scrub-sandalwood',
    name: 'Sandalwood Face Scrub cum Face Pack',
    subtitle: 'For pigmentation & dull skin',
    category: 'scrub',
    benefits: [
      'Brightens complexion',
      'Reduces pigmentation',
      'Calms inflammation',
      'Controls mild acne',
    ],
    ingredients: [
      'Dried Chandan Powder (Sandalwood)',
      'Dried Haldi powder (Turmeric)',
      'Natural Rose petal powder or dried crushed rose petals (optional)',
      'Fine grounded white sugar',
    ],
    tips: ['Best to use it with fresh milk cream (dry skin) or rose water (oily skin)'],
    shelfLife: 'Best enjoyed within 6 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'scrub-lemon-peel',
    name: 'Lemon Peel Face Scrub cum Face Pack',
    subtitle: 'For dull & oily skin',
    category: 'scrub',
    benefits: [
      'Natural vitamin C boost',
      'Controls oil',
      'Reduces dullness',
      'Mild exfoliation',
    ],
    ingredients: [
      'Dried Lemon peel powder',
      'Dried Haldi powder (Turmeric)',
      'Fine grounded white sugar (optional)',
    ],
    tips: ['Best to use it with curd or rose water'],
    shelfLife: 'Best enjoyed within 3 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'scrub-rice',
    name: 'Rice Face Scrub cum Face Pack',
    subtitle: 'For pigmentation & uneven skin',
    category: 'scrub',
    benefits: [
      'Gentle exfoliation',
      'Reduces pigmentation',
      'Tightens pores',
      'Improves skin texture',
      'Natural glow booster',
    ],
    ingredients: [
      'Rice flour',
      'Dried Chandan Powder (Sandalwood)',
      'Fine grounded white sugar',
      'Dried Haldi powder (Turmeric) (optional)',
    ],
    tips: ['Best to use it with rose water (oily skin) or raw milk (dry skin) or aloe vera (sensitive skin)'],
    shelfLife: 'Best enjoyed within 3 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'scrub-coffee-face',
    name: 'Coffee Face Scrub cum Face Pack',
    subtitle: 'For tan & rough skin',
    category: 'scrub',
    benefits: [
      'Removes tan',
      'Removes dead skin',
      'Improves circulation',
      'Smoothens rough patches',
    ],
    ingredients: [
      'Finely ground coffee or coffee powder',
      'Fine grounded white sugar',
      'Dried Chandan Powder (Sandalwood) (optional)',
      'Cinnamon powder (optional)',
    ],
    tips: ['Best to use it with rose water (oily skin) or oil (dry skin)'],
    shelfLife: 'Best enjoyed within 3 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'scrub-mix',
    name: 'Mix Face Scrub cum Face Pack',
    subtitle: 'For rough & textured skin',
    category: 'scrub',
    benefits: [
      'Improves circulation',
      'Reduces rough skin',
      'Improves skin texture',
    ],
    ingredients: [
      'Finely ground Potato and Cucumber peel',
      'Dried Chandan Powder (Sandalwood)',
      'Dried Haldi powder (Turmeric)',
      'Multani Mitti powder (Fuller\'s earth)',
      'Neem leaves powder (optional)',
      'Natural Rose petal powder or dried crushed rose petals (optional)',
      'Fine grounded white sugar',
    ],
    tips: ['Best to use it with rose water'],
    shelfLife: 'Best enjoyed within 6 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'scrub-coffee-body',
    name: 'Coffee Body Scrub',
    subtitle: 'For tan & rough body skin',
    category: 'scrub',
    benefits: [
      'Removes tan',
      'Improves blood circulation',
      'Reduces appearance of cellulite',
      'Smoothens rough skin',
    ],
    ingredients: [
      'Coffee powder or used coffee grounds',
      'Coconut oil',
      'Fine grounded white sugar',
      'Few drops essential oil',
    ],
    tips: ['Best 2–3 times/week'],
    shelfLife: 'Best enjoyed within 3 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'scrub-lip',
    name: 'Sugar and Honey Lip Scrub',
    subtitle: 'For tan & dry lips',
    category: 'scrub',
    benefits: [
      'Natural exfoliation',
      'Removes tan',
      'Hydrates skin',
    ],
    ingredients: [
      'Grounded white sugar',
      'Coconut oil',
      'Honey',
    ],
    tips: ['Best 2–3 times/week'],
    shelfLife: 'Best enjoyed within 1 month',
    batchNote: BATCH_NOTE,
  },

  // ─── CREAMS ──────────────────────────────────────────────
  {
    slug: 'cream-aloe-vera-face',
    name: 'Aloe Vera Face Cream',
    subtitle: 'For acne-prone & sensitive skin',
    category: 'cream',
    benefits: [
      'Reduces pimples and skin infections',
      'Soothes irritation',
      'Hydrates without greasiness',
      'Helps sunburn & redness',
    ],
    ingredients: [
      'Fresh Aloe vera gel',
      'Vitamin E oil',
      'Raw buffalo milk or unpasteurized buffalo milk',
    ],
    shelfLife: 'Best enjoyed within 1 month',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'cream-aloe-vera-body',
    name: 'Aloe Vera Body Cream',
    subtitle: 'For dry & infection-prone skin',
    category: 'cream',
    benefits: [
      'Antibacterial & antifungal',
      'Reduces skin infections',
      'Hydrates without greasiness',
    ],
    ingredients: [
      'Fresh Aloe vera gel',
      'Vitamin E oil',
      'Coconut oil or Almond oil',
      'Olive oil (optional)',
      'Glycerine',
    ],
    shelfLife: 'Best enjoyed within 3 months',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'cream-rice',
    name: 'Rice Face Cream',
    subtitle: 'For dull skin & pigmentation',
    category: 'cream',
    benefits: [
      'Brightens complexion',
      'Reduces pigmentation',
      'Improves skin texture',
      'Smooth finish',
    ],
    ingredients: [
      'Natural Rice Water',
      'Fresh Aloe vera gel',
      'Vitamin E oil',
      'Coconut oil',
    ],
    shelfLife: 'Best enjoyed within 1 month',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'cream-rose',
    name: 'Rose Cream',
    subtitle: 'For glow & mild toning',
    category: 'cream',
    benefits: [
      'Improves glow',
      'Mild skin toning',
      'Reduces redness',
    ],
    ingredients: [
      'Natural Homemade Gulab Jal (Rose Water)',
      'Fresh Aloe vera gel',
      'Vitamin E oil',
      'Almond oil or Olive oil',
    ],
    shelfLife: 'Best enjoyed within 1 month',
    batchNote: BATCH_NOTE,
  },
  {
    slug: 'cream-sandalwood',
    name: 'Sandalwood Cream',
    subtitle: 'For acne & blemishes',
    category: 'cream',
    benefits: [
      'Reduces acne',
      'Lightens blemishes',
      'Calms inflamed skin',
      'Controls oil',
    ],
    ingredients: [
      'Dried Chandan Powder (Sandalwood)',
      'Natural Homemade Gulab Jal (Rose Water)',
      'Fresh Aloe vera gel',
      'Tea Tree oil (optional)',
    ],
    shelfLife: 'Best enjoyed within 1 month',
    batchNote: BATCH_NOTE,
  },
];
