import soapImg from '../assets/images/product-soap.png';
import scrubImg from '../assets/images/product-scrub.png';
import creamImg from '../assets/images/product-cream.png';

export type Category = 'soap' | 'scrub' | 'cream';

export interface Product {
  id: string;
  name: string;
  subtitle: string;
  category: Category;
  price: string;
  benefits: string[];
  ingredients: string[];
  tips?: string[];
  shelfLife: string;
  batchNote: string;
  image: string;
}

export interface CategoryInfo {
  id: Category;
  label: string;
  description: string;
  image: string;
}

export const categories: CategoryInfo[] = [
  {
    id: 'soap',
    label: 'Soaps',
    description: 'Handcrafted cleansing bars made with natural ingredients for every skin type.',
    image: soapImg,
  },
  {
    id: 'scrub',
    label: 'Scrubs',
    description: 'Gentle exfoliating formulations that double as face packs.',
    image: scrubImg,
  },
  {
    id: 'cream',
    label: 'Creams',
    description: 'Nourishing moisturizers crafted from fresh, natural ingredients.',
    image: creamImg,
  },
];

const categoryImages: Record<Category, string> = {
  soap: soapImg,
  scrub: scrubImg,
  cream: creamImg,
};

const BATCH_NOTE = 'Freshly handmade in small batches.';

export const products: Product[] = [
  // ─── SOAPS ───────────────────────────────────────────────
  {
    id: 'soap-neem',
    name: 'Neem Soap',
    subtitle: 'For oily, pimples & acne-prone skin',
    category: 'soap',
    price: 'Rs. 175',
    benefits: [
      'Antibacterial & antifungal',
      'Reduces pimples and skin infections',
      'Controls excess oil',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Neem leaves powder',
      'Tulsi leaves powder',
      'Dried Haldi powder (Turmeric)',
      'Fresh Aloe vera gel (optional)',
      'Coconut or Almond oil (optional)',
      'Few drops essential oil',
    ],
    shelfLife: 'Best enjoyed within 6 months',
    batchNote: BATCH_NOTE,
    image: categoryImages.soap,
  },
  {
    id: 'soap-turmeric',
    name: 'Turmeric Soap',
    subtitle: 'For dull skin & pigmentation',
    category: 'soap',
    price: 'Rs. 175',
    benefits: [
      'Brightens skin',
      'Reduces dark spots',
      'Anti-inflammatory',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Dried Haldi powder (Turmeric)',
      'Dried Chandan Powder (Sandalwood)',
      'Dried Multani Mitti Powder (Fuller\'s earth) (optional)',
      'Few drops essential oil',
    ],
    shelfLife: 'Best enjoyed within 6 months',
    batchNote: BATCH_NOTE,
    image: categoryImages.soap,
  },
  {
    id: 'soap-aloe-vera',
    name: 'Aloe Vera Soap',
    subtitle: 'For sensitive & dry skin',
    category: 'soap',
    price: 'Rs. 175',
    benefits: [
      'Deep hydration',
      'Soothes irritation',
      'Helps sunburn',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Fresh Aloe vera gel',
      'Vitamin E oil',
      'Milk powder (optional)',
      'Few drops essential oil',
    ],
    shelfLife: 'Best enjoyed within 3 months',
    batchNote: BATCH_NOTE,
    image: categoryImages.soap,
  },
  {
    id: 'soap-multani-mitti',
    name: 'Multani Mitti Soap',
    subtitle: 'For oily & combination skin',
    category: 'soap',
    price: 'Rs. 175',
    benefits: [
      'Absorbs excess oil',
      'Tightens pores',
      'Detoxifies skin',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Multani Mitti (Fuller\'s earth)',
      'Dried Chandan Powder (Sandalwood)',
      'Natural Homemade Gulab Jal (Rose Water) (optional)',
      'Few drops essential oil',
    ],
    shelfLife: 'Best enjoyed within 6 months',
    batchNote: BATCH_NOTE,
    image: categoryImages.soap,
  },
  {
    id: 'soap-orange-peel',
    name: 'Orange Peel Soap',
    subtitle: 'For tanned & uneven skin',
    category: 'soap',
    price: 'Rs. 175',
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
    image: categoryImages.soap,
  },
  {
    id: 'soap-sandalwood',
    name: 'Sandalwood Soap',
    subtitle: 'For normal & sensitive skin',
    category: 'soap',
    price: 'Rs. 175',
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
      'Coconut or Almond oil (optional)',
    ],
    shelfLife: 'Best enjoyed within 6 months',
    batchNote: BATCH_NOTE,
    image: categoryImages.soap,
  },
  {
    id: 'soap-charcoal',
    name: 'Charcoal Herbal Soap',
    subtitle: 'For deep cleansing',
    category: 'soap',
    price: 'Rs. 175',
    benefits: [
      'Deep pore cleansing',
      'Removes toxins',
      'Helps blackheads',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Activated charcoal powder',
      'Fresh Aloe vera gel',
      'Tea tree oil',
    ],
    tips: ['Not ideal for dry or sensitive skin'],
    shelfLife: 'Best enjoyed within 6 months',
    batchNote: BATCH_NOTE,
    image: categoryImages.soap,
  },
  {
    id: 'soap-rose',
    name: 'Rose Soap',
    subtitle: 'For sensitive, normal & dry skin',
    category: 'soap',
    price: 'Rs. 175',
    benefits: [
      'Soothes irritation',
      'Reduces redness',
      'Mild toning effect',
      'Natural fragrance & freshness',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Natural Rose petal powder or dried crushed rose petals',
      'Natural Homemade Gulab Jal (Rose Water)',
      'Vitamin E oil',
      'Few drops essential oil',
    ],
    shelfLife: 'Best enjoyed within 3 months',
    batchNote: BATCH_NOTE,
    image: categoryImages.soap,
  },
  {
    id: 'soap-lemon-peel',
    name: 'Lemon Peel Soap',
    subtitle: 'For tanned & uneven skin',
    category: 'soap',
    price: 'Rs. 175',
    benefits: [
      'Natural exfoliation',
      'Removes tan',
      'Refreshing fragrance',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Dried Lemon peel powder',
      'Dried Haldi powder (Turmeric)',
      'Dried Chandan Powder (Sandalwood) (optional)',
      'Few drops essential oil',
    ],
    tips: ['Best for cold climate', 'Not ideal for dry or sensitive skin'],
    shelfLife: 'Best enjoyed within 6 months',
    batchNote: BATCH_NOTE,
    image: categoryImages.soap,
  },
  {
    id: 'soap-rice',
    name: 'Rice Soap',
    subtitle: 'For dull skin, uneven tone & mild pigmentation',
    category: 'soap',
    price: 'Rs. 175',
    benefits: [
      'Natural skin brightening',
      'Gentle exfoliation',
      'Improves skin texture',
      'Makes skin soft & smooth',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Rice flour or thick Rice water',
      'Milk powder',
      'Coconut oil (optional)',
      'Few drops essential oil',
    ],
    tips: ['Not ideal for dry skin'],
    shelfLife: 'Best enjoyed within 3 months',
    batchNote: BATCH_NOTE,
    image: categoryImages.soap,
  },
  {
    id: 'soap-milk',
    name: 'Milk Soap',
    subtitle: 'For dull or dry skin',
    category: 'soap',
    price: 'Rs. 175',
    benefits: [
      'Deep hydration',
      'Makes skin soft & supple',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Milk powder',
      'Coconut or Almond oil (optional)',
      'Few drops essential oil',
    ],
    tips: ['Best for winter or dry climate', 'Not ideal for oily skin'],
    shelfLife: 'Best enjoyed within 3 months',
    batchNote: BATCH_NOTE,
    image: categoryImages.soap,
  },
  {
    id: 'soap-oats',
    name: 'Oats Soap',
    subtitle: 'For sensitive skin',
    category: 'soap',
    price: 'Rs. 175',
    benefits: [
      'Gentle exfoliation',
      'Soothes itchy skin',
      'Improves skin texture',
    ],
    ingredients: [
      'Soap base (goat-milk or glycerin)',
      'Finely ground oats',
      'Milk powder (optional)',
      'Coconut or Almond oil',
    ],
    shelfLife: 'Best enjoyed within 3 months',
    batchNote: BATCH_NOTE,
    image: categoryImages.soap,
  },
  {
    id: 'soap-coffee',
    name: 'Coffee Soap',
    subtitle: 'For tan removing and firming',
    category: 'soap',
    price: 'Rs. 175',
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
    image: categoryImages.soap,
  },

  // ─── SCRUBS ──────────────────────────────────────────────
  {
    id: 'scrub-neem',
    name: 'Neem Face Scrub cum Face Pack',
    subtitle: 'For acne & oily skin',
    category: 'scrub',
    price: 'Rs. 175',
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
    image: categoryImages.scrub,
  },
  {
    id: 'scrub-multani-mitti',
    name: 'Multani Mitti Face Scrub cum Face Pack',
    subtitle: 'For oily & acne-prone skin',
    category: 'scrub',
    price: 'Rs. 175',
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
    image: categoryImages.scrub,
  },
  {
    id: 'scrub-orange-peel',
    name: 'Orange Peel Face Scrub cum Face Pack',
    subtitle: 'For dull & oily skin',
    category: 'scrub',
    price: 'Rs. 175',
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
    image: categoryImages.scrub,
  },
  {
    id: 'scrub-sandalwood',
    name: 'Sandalwood Face Scrub cum Face Pack',
    subtitle: 'For pigmentation & dull skin',
    category: 'scrub',
    price: 'Rs. 175',
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
    image: categoryImages.scrub,
  },
  {
    id: 'scrub-lemon-peel',
    name: 'Lemon Peel Face Scrub cum Face Pack',
    subtitle: 'For dull & oily skin',
    category: 'scrub',
    price: 'Rs. 175',
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
    image: categoryImages.scrub,
  },
  {
    id: 'scrub-rice',
    name: 'Rice Face Scrub cum Face Pack',
    subtitle: 'For pigmentation & uneven skin',
    category: 'scrub',
    price: 'Rs. 175',
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
    image: categoryImages.scrub,
  },
  {
    id: 'scrub-coffee-face',
    name: 'Coffee Face Scrub cum Face Pack',
    subtitle: 'For tan & rough skin',
    category: 'scrub',
    price: 'Rs. 175',
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
    image: categoryImages.scrub,
  },
  {
    id: 'scrub-mix',
    name: 'Mix Face Scrub cum Face Pack',
    subtitle: 'For rough & textured skin',
    category: 'scrub',
    price: 'Rs. 175',
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
    image: categoryImages.scrub,
  },
  {
    id: 'scrub-coffee-body',
    name: 'Coffee Body Scrub',
    subtitle: 'For tan & rough body skin',
    category: 'scrub',
    price: 'Rs. 175',
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
    tips: ['Best 2\u20133 times/week'],
    shelfLife: 'Best enjoyed within 3 months',
    batchNote: BATCH_NOTE,
    image: categoryImages.scrub,
  },
  {
    id: 'scrub-lip',
    name: 'Sugar and Honey Lip Scrub',
    subtitle: 'For tan & dry lips',
    category: 'scrub',
    price: 'Rs. 175',
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
    tips: ['Best 2\u20133 times/week'],
    shelfLife: 'Best enjoyed within 1 month',
    batchNote: BATCH_NOTE,
    image: categoryImages.scrub,
  },

  // ─── CREAMS ──────────────────────────────────────────────
  {
    id: 'cream-aloe-vera-face',
    name: 'Aloe Vera Face Cream',
    subtitle: 'For acne-prone & sensitive skin',
    category: 'cream',
    price: 'Rs. 175',
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
    image: categoryImages.cream,
  },
  {
    id: 'cream-aloe-vera-body',
    name: 'Aloe Vera Body Cream',
    subtitle: 'For dry & infection-prone skin',
    category: 'cream',
    price: 'Rs. 175',
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
    image: categoryImages.cream,
  },
  {
    id: 'cream-rice',
    name: 'Rice Face Cream',
    subtitle: 'For dull skin & pigmentation',
    category: 'cream',
    price: 'Rs. 175',
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
    image: categoryImages.cream,
  },
  {
    id: 'cream-rose',
    name: 'Rose Cream',
    subtitle: 'For glow & mild toning',
    category: 'cream',
    price: 'Rs. 175',
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
    image: categoryImages.cream,
  },
  {
    id: 'cream-sandalwood',
    name: 'Sandalwood Cream',
    subtitle: 'For acne & blemishes',
    category: 'cream',
    price: 'Rs. 175',
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
    image: categoryImages.cream,
  },

];

export function getProductsByCategory(category: Category): Product[] {
  return products.filter((p) => p.category === category);
}

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getFeaturedProducts(): Product[] {
  const featured: Product[] = [];
  for (const cat of categories) {
    const first = products.find((p) => p.category === cat.id);
    if (first) featured.push(first);
  }
  return featured;
}
