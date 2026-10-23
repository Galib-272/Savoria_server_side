/**
 * The full Savoria menu: categories and the dishes inside each one.
 * Used by `npm run seed` (fresh database) and `npm run seed:menu` (adds anything missing to an existing database).
 *
 * Photos are free images from Pexels. Any photo can be changed later in Dashboard → Menu → Edit.
 */

const px = (id: number) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=600`;

export interface CatalogCategory {
  name: string;
  icon: string;
  order: number;
  /** photo shown on the category card */
  image: string;
  /** older category names that should be treated as this one (e.g. after a rename) */
  aliases?: string[];
}

export interface CatalogItem {
  name: string;
  category: string;
  price: number;
  discountPrice?: number;
  description: string;
  image: string;
  prepTime: number;
  featured?: boolean;
  popular?: boolean;
  ingredients?: string[];
  allergens?: string[];
  modifiers?: { id: string; name: string; type: 'single' | 'multiple'; required: boolean; options: { id: string; name: string; price: number }[] }[];
}

/** bump this when dishes/categories are added so running servers pick them up once */
export const CATALOG_VERSION = 1;

export const CATALOG_CATEGORIES: CatalogCategory[] = [
  { name: 'Burgers', icon: '🍔', order: 1, image: px(1639562) },
  { name: 'Pizza', icon: '🍕', order: 2, image: px(2147491) },
  { name: 'Biryani', icon: '🍛', order: 3, image: px(5410401) },
  { name: 'Pasta', icon: '🍝', order: 4, image: px(1279330) },
  { name: 'Chicken', icon: '🍗', order: 5, image: px(33254639) },
  { name: 'Kebab & Grill', icon: '🍢', order: 6, image: px(2233729) },
  { name: 'Rice', icon: '🍚', order: 7, image: px(3926133) },
  { name: 'Seafood', icon: '🦐', order: 8, image: px(8697543) },
  { name: 'Soups & Salads', icon: '🥗', order: 9, image: px(539451) },
  { name: 'Snacks', icon: '🍟', order: 10, image: px(1583884) },
  { name: 'Desserts', icon: '🍰', order: 11, image: px(2067396) },
  { name: 'Drinks', icon: '🥤', order: 12, image: px(8771967) },
  { name: 'Coffee & Tea', icon: '☕', order: 13, image: px(6747870) },
  { name: 'Juices & Shakes', icon: '🧃', order: 14, image: px(14509267) },
];

// ---- reusable add-on choices -------------------------------------------------
const burgerExtras = (p: string) => [
  { id: `${p}-extras`, name: 'Extras', type: 'multiple' as const, required: false, options: [
    { id: `${p}-x1`, name: 'Extra Cheese', price: 50 },
    { id: `${p}-x2`, name: 'Extra Patty', price: 150 },
    { id: `${p}-x3`, name: 'Jalapeños', price: 30 },
    { id: `${p}-x4`, name: 'Fries on the side', price: 90 },
  ] },
];
const pizzaSize = (p: string) => [
  { id: `${p}-size`, name: 'Size', type: 'single' as const, required: true, options: [
    { id: `${p}-s1`, name: 'Medium (10")', price: 0 },
    { id: `${p}-s2`, name: 'Large (14")', price: 200 },
  ] },
  { id: `${p}-crust`, name: 'Crust', type: 'single' as const, required: false, options: [
    { id: `${p}-c1`, name: 'Classic Hand-Tossed', price: 0 },
    { id: `${p}-c2`, name: 'Thin Crust', price: 0 },
    { id: `${p}-c3`, name: 'Cheese-Stuffed Crust', price: 120 },
  ] },
];
const drinkSize = (p: string, large = 40) => [
  { id: `${p}-size`, name: 'Size', type: 'single' as const, required: true, options: [
    { id: `${p}-s1`, name: 'Regular', price: 0 },
    { id: `${p}-s2`, name: 'Large', price: large },
  ] },
];
const coffeeOptions = (p: string) => [
  ...drinkSize(p, 50),
  { id: `${p}-add`, name: 'Add-ons', type: 'multiple' as const, required: false, options: [
    { id: `${p}-a1`, name: 'Extra Shot', price: 60 },
    { id: `${p}-a2`, name: 'Caramel Syrup', price: 40 },
    { id: `${p}-a3`, name: 'Whipped Cream', price: 40 },
  ] },
];
const biryaniPortion = (p: string) => [
  { id: `${p}-portion`, name: 'Portion', type: 'single' as const, required: true, options: [
    { id: `${p}-p1`, name: 'Single', price: 0 },
    { id: `${p}-p2`, name: 'Half Platter (2 people)', price: 320 },
  ] },
  { id: `${p}-extra`, name: 'Extras', type: 'multiple' as const, required: false, options: [
    { id: `${p}-e1`, name: 'Extra Egg', price: 30 },
    { id: `${p}-e2`, name: 'Borhani', price: 80 },
  ] },
];

// ---- dishes -----------------------------------------------------------------
// The 9 original dishes (Classic Beef Burger, Pepperoni Pizza, Chicken Biryani, ...) live in seed.ts
// with their recipes; everything below is added on top of them.
export const CATALOG_ITEMS: CatalogItem[] = [
  // Burgers
  { name: 'Chicken Cheese Burger', category: 'Burgers', price: 320, prepTime: 12, popular: true, image: px(1639562),
    description: 'Crispy fried chicken fillet, melted cheddar, lettuce and creamy mayo in a toasted sesame bun.', ingredients: ['Chicken', 'Cheddar', 'Lettuce', 'Mayo', 'Bun'], allergens: ['Gluten', 'Dairy', 'Egg'], modifiers: burgerExtras('b1') },
  { name: 'Beef Cheese Burger', category: 'Burgers', price: 380, prepTime: 14, image: px(1633578),
    description: 'Flame-grilled beef patty with a double slice of cheese, pickles, onion and house sauce.', ingredients: ['Beef', 'Cheese', 'Pickles', 'Onion', 'Bun'], allergens: ['Gluten', 'Dairy'], modifiers: burgerExtras('b2') },
  { name: 'Mushroom Burger', category: 'Burgers', price: 360, prepTime: 14, image: px(2983101),
    description: 'Juicy beef patty topped with garlic-sautéed mushrooms and melted Swiss cheese.', ingredients: ['Beef', 'Mushroom', 'Swiss Cheese', 'Bun'], allergens: ['Gluten', 'Dairy'], modifiers: burgerExtras('b3') },
  { name: 'Double Decker Burger', category: 'Burgers', price: 520, discountPrice: 470, prepTime: 18, featured: true, image: px(3616956),
    description: 'Two beef patties, two layers of cheese, caramelised onions and smoky sauce stacked high.', ingredients: ['Beef', 'Cheese', 'Onion', 'Bun'], allergens: ['Gluten', 'Dairy'], modifiers: burgerExtras('b4') },
  { name: 'Smashed Burger', category: 'Burgers', price: 450, prepTime: 12, image: px(1199960),
    description: 'Thin, crispy-edged smashed beef patties with American cheese, pickles and burger sauce.', ingredients: ['Beef', 'American Cheese', 'Pickles', 'Bun'], allergens: ['Gluten', 'Dairy'], modifiers: burgerExtras('b5') },
  { name: 'Crispy Chicken Burger', category: 'Burgers', price: 300, prepTime: 12, image: px(2271107),
    description: 'Buttermilk-fried chicken thigh, coleslaw and spicy mayo in a soft brioche bun.', ingredients: ['Chicken', 'Coleslaw', 'Spicy Mayo', 'Brioche'], allergens: ['Gluten', 'Dairy', 'Egg'], modifiers: burgerExtras('b6') },
  { name: 'BBQ Beef Burger', category: 'Burgers', price: 420, prepTime: 15, image: px(1556698),
    description: 'Grilled beef patty glazed in smoky BBQ sauce with crispy onion rings and cheddar.', ingredients: ['Beef', 'BBQ Sauce', 'Onion Rings', 'Cheddar'], allergens: ['Gluten', 'Dairy'], modifiers: burgerExtras('b7') },
  { name: 'Veggie Burger', category: 'Burgers', price: 260, prepTime: 12, image: px(3607284),
    description: 'Golden vegetable and potato patty with lettuce, tomato and mint yoghurt sauce.', ingredients: ['Vegetables', 'Potato', 'Lettuce', 'Tomato'], allergens: ['Gluten', 'Dairy'], modifiers: burgerExtras('b8') },

  // Pizza
  { name: 'Chicken Pizza', category: 'Pizza', price: 520, prepTime: 20, image: px(2619967),
    description: 'Tender chicken chunks, capsicum, onion and mozzarella on our signature tomato base.', ingredients: ['Chicken', 'Mozzarella', 'Capsicum', 'Onion'], allergens: ['Gluten', 'Dairy'], modifiers: pizzaSize('p1') },
  { name: 'Beef Cheese Pizza', category: 'Pizza', price: 580, prepTime: 20, image: px(16014994),
    description: 'Spiced minced beef with a three-cheese blend of mozzarella, cheddar and parmesan.', ingredients: ['Beef', 'Mozzarella', 'Cheddar', 'Parmesan'], allergens: ['Gluten', 'Dairy'], modifiers: pizzaSize('p2') },
  { name: 'Cheesy Blast Pizza', category: 'Pizza', price: 620, prepTime: 22, popular: true, image: px(315755),
    description: 'Loaded with four cheeses and a cheese-stuffed crust — for serious cheese lovers.', ingredients: ['Mozzarella', 'Cheddar', 'Parmesan', 'Cream Cheese'], allergens: ['Gluten', 'Dairy'], modifiers: pizzaSize('p3') },
  { name: 'BBQ Meat Machine Pizza', category: 'Pizza', price: 690, discountPrice: 620, prepTime: 22, featured: true, image: px(3915854),
    description: 'BBQ chicken, beef pepperoni, minced beef and sausage on a smoky BBQ sauce base.', ingredients: ['BBQ Chicken', 'Beef Pepperoni', 'Minced Beef', 'Sausage'], allergens: ['Gluten', 'Dairy'], modifiers: pizzaSize('p4') },
  { name: 'Margherita Pizza', category: 'Pizza', price: 450, prepTime: 18, image: px(1260968),
    description: 'The classic — San Marzano tomato sauce, fresh mozzarella and basil.', ingredients: ['Tomato', 'Mozzarella', 'Basil'], allergens: ['Gluten', 'Dairy'], modifiers: pizzaSize('p5') },
  { name: 'Chicken Tikka Pizza', category: 'Pizza', price: 560, prepTime: 20, image: px(1653877),
    description: 'Tandoori chicken tikka, green chilli, onion and mozzarella with a mint-mayo drizzle.', ingredients: ['Chicken Tikka', 'Green Chilli', 'Onion', 'Mozzarella'], allergens: ['Gluten', 'Dairy'], modifiers: pizzaSize('p6') },
  { name: 'Vegetable Supreme Pizza', category: 'Pizza', price: 480, prepTime: 20, image: px(1146760),
    description: 'Mushroom, olives, capsicum, sweet corn, onion and tomato on a mozzarella base.', ingredients: ['Mushroom', 'Olives', 'Capsicum', 'Corn'], allergens: ['Gluten', 'Dairy'], modifiers: pizzaSize('p7') },

  // Biryani
  { name: 'Beef Biryani', category: 'Biryani', price: 420, prepTime: 15, popular: true, image: px(8846746),
    description: 'Slow-cooked beef layered with fragrant basmati rice, saffron and fried onions.', ingredients: ['Beef', 'Basmati Rice', 'Saffron', 'Fried Onion'], allergens: ['Dairy'], modifiers: biryaniPortion('r1') },
  { name: 'Mutton Biryani', category: 'Biryani', price: 520, prepTime: 15, image: px(5695615),
    description: 'Tender mutton pieces dum-cooked with aromatic rice, potato and whole spices.', ingredients: ['Mutton', 'Basmati Rice', 'Potato', 'Spices'], allergens: ['Dairy'], modifiers: biryaniPortion('r2') },
  { name: 'Kacchi Biryani', category: 'Biryani', price: 480, prepTime: 15, featured: true, image: px(5410401),
    description: 'Old-Dhaka style kacchi — marinated mutton and chinigura rice cooked together on dum.', ingredients: ['Mutton', 'Chinigura Rice', 'Potato', 'Ghee'], allergens: ['Dairy'], modifiers: biryaniPortion('r3') },
  { name: 'Hyderabadi Chicken Dum Biryani', category: 'Biryani', price: 450, prepTime: 15, image: px(28674660),
    description: 'Spicy Hyderabadi-style chicken biryani sealed and slow-cooked on dum.', ingredients: ['Chicken', 'Basmati Rice', 'Mint', 'Spices'], allergens: ['Dairy'], modifiers: biryaniPortion('r4') },
  { name: 'Egg Biryani', category: 'Biryani', price: 260, prepTime: 12, image: px(31537385),
    description: 'Boiled eggs tossed in masala and layered with spiced basmati rice.', ingredients: ['Egg', 'Basmati Rice', 'Spices'], allergens: ['Egg'], modifiers: biryaniPortion('r5') },

  // Pasta
  { name: 'Spaghetti Bolognese', category: 'Pasta', price: 450, prepTime: 18, image: px(1279330),
    description: 'Spaghetti in a slow-simmered beef and tomato ragù, topped with parmesan.', ingredients: ['Spaghetti', 'Beef', 'Tomato', 'Parmesan'], allergens: ['Gluten', 'Dairy'] },
  { name: 'Penne Arrabbiata', category: 'Pasta', price: 380, prepTime: 15, image: px(1437267),
    description: 'Penne in a fiery garlic, chilli and tomato sauce with fresh basil.', ingredients: ['Penne', 'Tomato', 'Garlic', 'Chilli'], allergens: ['Gluten'] },
  { name: 'Chicken Pesto Pasta', category: 'Pasta', price: 440, prepTime: 16, image: px(1527603),
    description: 'Grilled chicken and fusilli tossed in basil pesto with cherry tomatoes.', ingredients: ['Fusilli', 'Chicken', 'Basil Pesto', 'Cherry Tomato'], allergens: ['Gluten', 'Dairy', 'Nuts'] },
  { name: 'Baked Mac & Cheese', category: 'Pasta', price: 360, prepTime: 18, image: px(25524076),
    description: 'Macaroni baked in a rich cheddar sauce with a golden breadcrumb crust.', ingredients: ['Macaroni', 'Cheddar', 'Breadcrumbs'], allergens: ['Gluten', 'Dairy'] },
  { name: 'Seafood Pasta', category: 'Pasta', price: 560, prepTime: 20, image: px(1487511),
    description: 'Linguine with prawns, squid and mussels in a garlic white-wine-style cream sauce.', ingredients: ['Linguine', 'Prawn', 'Squid', 'Cream'], allergens: ['Gluten', 'Dairy', 'Shellfish'] },

  // Chicken
  { name: 'Hot & Spicy Chicken Wings', category: 'Chicken', price: 320, prepTime: 15, popular: true, image: px(2338407),
    description: 'Eight crispy wings tossed in our hot buffalo sauce, served with a cooling dip.', ingredients: ['Chicken Wings', 'Buffalo Sauce'], allergens: ['Dairy'] },
  { name: 'Chicken Strips', category: 'Chicken', price: 290, prepTime: 12, image: px(1059943),
    description: 'Golden breaded chicken tenders with honey-mustard dip.', ingredients: ['Chicken', 'Breadcrumbs'], allergens: ['Gluten', 'Egg'] },
  { name: 'Chicken Lollipop', category: 'Chicken', price: 300, prepTime: 15, image: px(7353380),
    description: 'Indo-Chinese style frenched drumettes, fried crisp and tossed in chilli-garlic sauce.', ingredients: ['Chicken', 'Chilli', 'Garlic'], allergens: ['Gluten', 'Soy'] },
  { name: 'Butter Chicken', category: 'Chicken', price: 450, prepTime: 18, image: px(7625056),
    description: 'Tandoori chicken in a velvety tomato, butter and cream gravy. Best with naan or rice.', ingredients: ['Chicken', 'Tomato', 'Butter', 'Cream'], allergens: ['Dairy'] },
  { name: 'Chicken Shashlik', category: 'Chicken', price: 420, prepTime: 16, image: px(32754748),
    description: 'Chicken, capsicum, onion and tomato skewers in a tangy sauce, served with rice.', ingredients: ['Chicken', 'Capsicum', 'Onion', 'Tomato'], allergens: [] },

  // Kebab & Grill
  { name: 'Beef Seekh Kebab', category: 'Kebab & Grill', price: 380, prepTime: 18, image: px(37080242),
    description: 'Minced beef with herbs and spices, chargrilled on skewers. Served with naan and salad.', ingredients: ['Beef', 'Herbs', 'Spices'], allergens: ['Gluten'] },
  { name: 'Chicken Tikka Kebab', category: 'Kebab & Grill', price: 340, prepTime: 18, image: px(20702403),
    description: 'Yoghurt-marinated boneless chicken, cooked in the tandoor until smoky and tender.', ingredients: ['Chicken', 'Yoghurt', 'Tandoori Spices'], allergens: ['Dairy'] },
  { name: 'Grilled Chicken (Half)', category: 'Kebab & Grill', price: 420, prepTime: 25, image: px(2673353),
    description: 'Half a chicken marinated overnight and charcoal-grilled. Comes with naan and garlic dip.', ingredients: ['Chicken', 'Spices'], allergens: ['Dairy'] },
  { name: 'Mutton Boti Kebab', category: 'Kebab & Grill', price: 480, prepTime: 22, image: px(7340982),
    description: 'Spiced mutton cubes grilled over charcoal with onion and green chilli.', ingredients: ['Mutton', 'Onion', 'Spices'], allergens: [] },
  { name: 'Chicken Reshmi Kebab', category: 'Kebab & Grill', price: 360, prepTime: 18, image: px(6522616),
    description: 'Silky, mildly spiced chicken kebab with cream and cashew marinade.', ingredients: ['Chicken', 'Cream', 'Cashew'], allergens: ['Dairy', 'Nuts'] },
  { name: 'Mixed Grill Platter', category: 'Kebab & Grill', price: 950, discountPrice: 850, prepTime: 30, featured: true, image: px(2233729),
    description: 'Seekh kebab, chicken tikka, boti kebab and grilled chicken with naan — serves 2 to 3.', ingredients: ['Beef', 'Chicken', 'Mutton', 'Naan'], allergens: ['Gluten', 'Dairy'] },

  // Rice
  { name: 'Chicken Fried Rice', category: 'Rice', price: 320, prepTime: 12, image: px(723198),
    description: 'Wok-tossed rice with chicken, egg, vegetables and soy sauce.', ingredients: ['Rice', 'Chicken', 'Egg', 'Vegetables'], allergens: ['Egg', 'Soy'] },
  { name: 'Egg Fried Rice', category: 'Rice', price: 240, prepTime: 10, image: px(32845321),
    description: 'Classic fried rice with scrambled egg, spring onion and peas.', ingredients: ['Rice', 'Egg', 'Spring Onion', 'Peas'], allergens: ['Egg', 'Soy'] },
  { name: 'Vegetable Fried Rice', category: 'Rice', price: 220, prepTime: 10, image: px(3926133),
    description: 'Fried rice with carrot, beans, corn and capsicum.', ingredients: ['Rice', 'Carrot', 'Beans', 'Corn'], allergens: ['Soy'] },
  { name: 'Morog Polao', category: 'Rice', price: 400, prepTime: 15, image: px(12669168),
    description: 'Fragrant chinigura polao with rich, mildly spiced chicken roast — a Bengali wedding favourite.', ingredients: ['Chinigura Rice', 'Chicken', 'Ghee'], allergens: ['Dairy'] },
  { name: 'Beef Khichuri', category: 'Rice', price: 350, prepTime: 15, image: px(24206918),
    description: 'Comforting rice and lentil khichuri cooked with spiced beef.', ingredients: ['Rice', 'Lentils', 'Beef'], allergens: [] },
  { name: 'Plain Basmati Rice', category: 'Rice', price: 120, prepTime: 5, image: px(8956718),
    description: 'Steamed long-grain basmati rice. Perfect with curries and kebabs.', ingredients: ['Basmati Rice'], allergens: [] },

  // Seafood
  { name: 'Fish & Chips', category: 'Seafood', price: 480, prepTime: 18, image: px(5863643),
    description: 'Beer-style battered fish fillet with chunky fries, tartar sauce and lemon.', ingredients: ['Fish', 'Potato', 'Tartar Sauce'], allergens: ['Fish', 'Gluten', 'Egg'] },
  { name: 'Garlic Butter Prawns', category: 'Seafood', price: 620, prepTime: 15, image: px(8697543),
    description: 'Tiger prawns pan-fried in garlic butter with herbs, served with toasted bread.', ingredients: ['Prawn', 'Garlic', 'Butter'], allergens: ['Shellfish', 'Dairy', 'Gluten'] },
  { name: 'Fried Calamari', category: 'Seafood', price: 450, prepTime: 12, image: px(11160096),
    description: 'Crispy squid rings with lemon and garlic aioli.', ingredients: ['Squid', 'Flour', 'Garlic Aioli'], allergens: ['Shellfish', 'Gluten', 'Egg'] },
  { name: 'Grilled Bhetki Fillet', category: 'Seafood', price: 650, prepTime: 22, image: px(3763847),
    description: 'Bhetki fish fillet marinated in herbs and spices, grilled and served with sautéed vegetables.', ingredients: ['Bhetki Fish', 'Herbs', 'Vegetables'], allergens: ['Fish'] },
  { name: 'Prawn Malai Curry', category: 'Seafood', price: 590, prepTime: 20, image: px(33413491),
    description: 'Bengali-style golda chingri in a mild coconut-milk curry. Served with rice.', ingredients: ['Prawn', 'Coconut Milk', 'Spices'], allergens: ['Shellfish'] },

  // Soups & Salads
  { name: 'Thai Clear Soup', category: 'Soups & Salads', price: 280, prepTime: 10, image: px(30708195),
    description: 'Light lemongrass broth with chicken, prawn, mushroom and vegetables.', ingredients: ['Chicken', 'Prawn', 'Lemongrass', 'Mushroom'], allergens: ['Shellfish'] },
  { name: 'Chicken Corn Soup', category: 'Soups & Salads', price: 260, prepTime: 10, image: px(29538431),
    description: 'Thick, comforting soup with shredded chicken, sweet corn and egg ribbons.', ingredients: ['Chicken', 'Sweet Corn', 'Egg'], allergens: ['Egg'] },
  { name: 'Tom Yum Soup', category: 'Soups & Salads', price: 340, prepTime: 12, image: px(12561892),
    description: 'Hot and sour Thai soup with prawns, mushrooms, lime leaf and chilli.', ingredients: ['Prawn', 'Mushroom', 'Lime Leaf', 'Chilli'], allergens: ['Shellfish'] },
  { name: 'Caesar Salad', category: 'Soups & Salads', price: 320, prepTime: 8, image: px(29935339),
    description: 'Crisp romaine, grilled chicken, croutons and parmesan in creamy Caesar dressing.', ingredients: ['Romaine', 'Chicken', 'Croutons', 'Parmesan'], allergens: ['Gluten', 'Dairy', 'Egg'] },
  { name: 'Greek Salad', category: 'Soups & Salads', price: 300, prepTime: 8, image: px(1059905),
    description: 'Tomato, cucumber, olives, red onion and feta with oregano olive-oil dressing.', ingredients: ['Tomato', 'Cucumber', 'Olives', 'Feta'], allergens: ['Dairy'] },
  { name: 'Chicken Cashew Salad', category: 'Soups & Salads', price: 360, prepTime: 10, image: px(1640777),
    description: 'Thai-style salad with chicken, roasted cashews, fresh herbs and a sweet-chilli dressing.', ingredients: ['Chicken', 'Cashew', 'Herbs'], allergens: ['Nuts'] },

  // Snacks
  { name: 'Onion Rings', category: 'Snacks', price: 180, prepTime: 8, image: px(17313960),
    description: 'Beer-battered onion rings, golden and crunchy, with chipotle mayo.', ingredients: ['Onion', 'Batter'], allergens: ['Gluten', 'Egg'] },
  { name: 'Chicken Nuggets', category: 'Snacks', price: 220, prepTime: 8, image: px(6941010),
    description: 'Eight crispy chicken nuggets with BBQ and honey-mustard dips.', ingredients: ['Chicken', 'Breadcrumbs'], allergens: ['Gluten', 'Egg'] },
  { name: 'Mozzarella Sticks', category: 'Snacks', price: 280, prepTime: 8, image: px(9650081),
    description: 'Breaded mozzarella fried until gooey, with marinara dip.', ingredients: ['Mozzarella', 'Breadcrumbs', 'Marinara'], allergens: ['Gluten', 'Dairy', 'Egg'] },
  { name: 'Chicken Spring Rolls', category: 'Snacks', price: 200, prepTime: 10, image: px(15801051),
    description: 'Four crispy rolls filled with chicken and vegetables, with sweet-chilli sauce.', ingredients: ['Chicken', 'Vegetables', 'Pastry'], allergens: ['Gluten', 'Soy'] },
  { name: 'Beef Samosa (4 pcs)', category: 'Snacks', price: 160, prepTime: 8, image: px(14477873),
    description: 'Flaky pastry triangles stuffed with spiced minced beef.', ingredients: ['Beef', 'Pastry', 'Spices'], allergens: ['Gluten'] },
  { name: 'Peri Peri Fries', category: 'Snacks', price: 170, prepTime: 10, image: px(1586942),
    description: 'Crispy fries tossed in spicy peri peri seasoning, with garlic mayo.', ingredients: ['Potato', 'Seasoning'], allergens: ['Egg'] },

  // Desserts
  { name: 'New York Cheesecake', category: 'Desserts', price: 320, prepTime: 5, image: px(38495630),
    description: 'Rich, creamy baked cheesecake on a buttery biscuit base with berry compote.', ingredients: ['Cream Cheese', 'Biscuit', 'Berries'], allergens: ['Gluten', 'Dairy', 'Egg'] },
  { name: 'Tiramisu', category: 'Desserts', price: 280, prepTime: 5, image: px(6880219),
    description: 'Coffee-soaked sponge layered with mascarpone cream and dusted with cocoa.', ingredients: ['Sponge', 'Coffee', 'Mascarpone', 'Cocoa'], allergens: ['Gluten', 'Dairy', 'Egg'] },
  { name: 'Brownie with Ice Cream', category: 'Desserts', price: 260, prepTime: 6, popular: true, image: px(7491900),
    description: 'Warm fudgy chocolate brownie topped with vanilla ice cream and chocolate sauce.', ingredients: ['Chocolate', 'Flour', 'Vanilla Ice Cream'], allergens: ['Gluten', 'Dairy', 'Egg'] },
  { name: 'Firni', category: 'Desserts', price: 150, prepTime: 3, image: px(33430555),
    description: 'Chilled ground-rice pudding with cardamom, saffron and pistachio, served in a clay bowl.', ingredients: ['Rice', 'Milk', 'Cardamom', 'Pistachio'], allergens: ['Dairy', 'Nuts'] },
  { name: 'Rasmalai', category: 'Desserts', price: 180, prepTime: 3, image: px(39973385),
    description: 'Soft cottage-cheese dumplings soaked in sweet saffron milk.', ingredients: ['Chhana', 'Milk', 'Saffron'], allergens: ['Dairy', 'Nuts'] },
  { name: 'Ice Cream Sundae', category: 'Desserts', price: 240, prepTime: 4, image: px(9510367),
    description: 'Three scoops with chocolate sauce, whipped cream, nuts and a cherry on top.', ingredients: ['Ice Cream', 'Chocolate Sauce', 'Nuts'], allergens: ['Dairy', 'Nuts'] },

  // Drinks
  { name: 'Coca-Cola', category: 'Drinks', price: 60, prepTime: 1, image: px(33469209),
    description: 'Chilled 500ml bottle.', ingredients: [], allergens: [] },
  { name: 'Sprite', category: 'Drinks', price: 60, prepTime: 1, image: px(9996446),
    description: 'Chilled 500ml bottle of lemon-lime soda.', ingredients: [], allergens: [] },
  { name: 'Mineral Water', category: 'Drinks', price: 30, prepTime: 1, image: px(1540235),
    description: '500ml bottled drinking water.', ingredients: [], allergens: [] },
  { name: 'Blue Lagoon Mocktail', category: 'Drinks', price: 180, prepTime: 4, image: px(8771967),
    description: 'Blue curaçao syrup, lemonade and soda over crushed ice.', ingredients: ['Blue Curaçao Syrup', 'Lemonade', 'Soda'], allergens: [], modifiers: drinkSize('d1') },
  { name: 'Virgin Piña Colada', category: 'Drinks', price: 220, prepTime: 4, image: px(10986589),
    description: 'Creamy blend of pineapple and coconut, alcohol-free.', ingredients: ['Pineapple', 'Coconut Cream'], allergens: ['Dairy'], modifiers: drinkSize('d2') },
  { name: 'Passion Fruit Mojito', category: 'Drinks', price: 160, prepTime: 4, image: px(17612801),
    description: 'Passion fruit, fresh mint, lime and soda — tangy and refreshing.', ingredients: ['Passion Fruit', 'Mint', 'Lime', 'Soda'], allergens: [], modifiers: drinkSize('d3') },
  { name: 'Lemon Iced Tea', category: 'Drinks', price: 140, prepTime: 3, image: px(8619612),
    description: 'Fresh-brewed black tea with lemon, lightly sweetened and served over ice.', ingredients: ['Black Tea', 'Lemon'], allergens: [], modifiers: drinkSize('d4') },

  // Coffee & Tea
  { name: 'Espresso', category: 'Coffee & Tea', price: 150, prepTime: 3, image: px(18604200),
    description: 'A rich, concentrated double shot of our house-roast beans.', ingredients: ['Coffee'], allergens: [] },
  { name: 'Cappuccino', category: 'Coffee & Tea', price: 220, prepTime: 4, popular: true, image: px(6747870),
    description: 'Espresso with steamed milk and a thick layer of velvety foam.', ingredients: ['Coffee', 'Milk'], allergens: ['Dairy'], modifiers: coffeeOptions('c1') },
  { name: 'Caffe Latte', category: 'Coffee & Tea', price: 230, prepTime: 4, image: px(459489),
    description: 'Smooth espresso with plenty of steamed milk and light foam.', ingredients: ['Coffee', 'Milk'], allergens: ['Dairy'], modifiers: coffeeOptions('c2') },
  { name: 'Iced Americano', category: 'Coffee & Tea', price: 200, prepTime: 3, image: px(18457338),
    description: 'Espresso over ice and cold water — bold and refreshing.', ingredients: ['Coffee', 'Ice'], allergens: [], modifiers: coffeeOptions('c3') },
  { name: 'Cold Coffee', category: 'Coffee & Tea', price: 220, prepTime: 4, popular: true, image: px(35229818),
    description: 'Creamy blended coffee with milk and ice cream.', ingredients: ['Coffee', 'Milk', 'Ice Cream'], allergens: ['Dairy'], modifiers: coffeeOptions('c4') },
  { name: 'Hot Chocolate', category: 'Coffee & Tea', price: 240, prepTime: 4, image: px(5264675),
    description: 'Thick Belgian-style hot chocolate topped with whipped cream.', ingredients: ['Chocolate', 'Milk', 'Cream'], allergens: ['Dairy'] },
  { name: 'Masala Tea', category: 'Coffee & Tea', price: 80, prepTime: 4, image: px(37186989),
    description: 'Milk tea brewed with ginger, cardamom and cinnamon.', ingredients: ['Tea', 'Milk', 'Ginger', 'Cardamom'], allergens: ['Dairy'] },
  { name: 'Green Tea', category: 'Coffee & Tea', price: 90, prepTime: 3, image: px(36028821),
    description: 'Light, soothing green tea served hot with honey on the side.', ingredients: ['Green Tea', 'Honey'], allergens: [] },

  // Juices & Shakes
  { name: 'Fresh Orange Juice', category: 'Juices & Shakes', price: 180, prepTime: 4, image: px(30900665),
    description: 'Freshly squeezed oranges, no added sugar.', ingredients: ['Orange'], allergens: [], modifiers: drinkSize('j1') },
  { name: 'Watermelon Juice', category: 'Juices & Shakes', price: 150, prepTime: 4, image: px(11009203),
    description: 'Fresh watermelon blended with a touch of mint and lime.', ingredients: ['Watermelon', 'Mint', 'Lime'], allergens: [], modifiers: drinkSize('j2') },
  { name: 'Mango Lassi', category: 'Juices & Shakes', price: 180, prepTime: 4, image: px(14509267),
    description: 'Thick, sweet yoghurt drink blended with ripe mango.', ingredients: ['Mango', 'Yoghurt'], allergens: ['Dairy'], modifiers: drinkSize('j3') },
  { name: 'Borhani', category: 'Juices & Shakes', price: 90, prepTime: 2, image: px(18142603),
    description: 'Traditional spiced yoghurt drink with mint and black salt — the perfect partner for biryani.', ingredients: ['Yoghurt', 'Mint', 'Spices'], allergens: ['Dairy'] },
  { name: 'Strawberry Milkshake', category: 'Juices & Shakes', price: 250, prepTime: 5, image: px(8001832),
    description: 'Strawberries, milk and vanilla ice cream blended smooth.', ingredients: ['Strawberry', 'Milk', 'Ice Cream'], allergens: ['Dairy'], modifiers: drinkSize('j4', 60) },
  { name: 'Chocolate Milkshake', category: 'Juices & Shakes', price: 250, prepTime: 5, image: px(18142621),
    description: 'Rich chocolate shake topped with whipped cream.', ingredients: ['Chocolate', 'Milk', 'Ice Cream'], allergens: ['Dairy'], modifiers: drinkSize('j5', 60) },
  { name: 'Oreo Milkshake', category: 'Juices & Shakes', price: 270, prepTime: 5, popular: true, image: px(16825488),
    description: 'Cookies-and-cream shake blended with crushed Oreo biscuits.', ingredients: ['Oreo', 'Milk', 'Ice Cream'], allergens: ['Gluten', 'Dairy'], modifiers: drinkSize('j6', 60) },
];

/** Original dishes that should move into a new category when the menu is upgraded. */
export const CATEGORY_MOVES: { namePattern: RegExp; to: string }[] = [
  { namePattern: /biryani|biriyani|kacchi/i, to: 'Biryani' },
];

/**
 * Photo links that turned out to be broken → their replacement.
 * Applied on every server start, only to records that still use the exact broken link
 * (a photo you changed yourself is never touched).
 */
export const IMAGE_FIXES: Record<string, string> = {
  'https://images.pexels.com/photos/60616/pexels-photo-60616.jpeg?auto=compress&cs=tinysrgb&w=600': px(33254639),
  'https://plus.unsplash.com/premium_photo-1721025990485-73e7e54d4256?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D': px(4051220),
};
