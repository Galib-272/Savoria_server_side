import { MenuCategory } from '../models/MenuCategory.model.js';
import { MenuItem } from '../models/MenuItem.model.js';
import { Counter } from '../models/Counter.model.js';
import { escapeRegex } from '../utils/helpers.js';
import { CATALOG_CATEGORIES, CATALOG_ITEMS, CATALOG_VERSION, CATEGORY_MOVES, IMAGE_FIXES } from '../scripts/menuCatalog.js';

const sameName = (name: string) => ({ $regex: `^${escapeRegex(name.trim())}$`, $options: 'i' });

export interface MenuSyncResult {
  categoriesAdded: number;
  itemsAdded: number;
  itemsSkipped: number;
  moved: number;
}

/**
 * Adds every category and dish from the Savoria catalog that is not in the database yet.
 * Never deletes or overwrites anything you already have (dishes are matched by name).
 */
export const syncMenuCatalog = async (): Promise<MenuSyncResult> => {
  const result: MenuSyncResult = { categoriesAdded: 0, itemsAdded: 0, itemsSkipped: 0, moved: 0 };
  const catByName = new Map<string, { id: string; name: string }>();

  for (const cat of CATALOG_CATEGORIES) {
    let doc = await MenuCategory.findOne({ name: sameName(cat.name) });
    if (!doc) {
      doc = await MenuCategory.create({ name: cat.name, icon: cat.icon, image: cat.image, order: cat.order, active: true });
      result.categoriesAdded += 1;
    } else {
      let changed = false;
      if (doc.order !== cat.order) { doc.order = cat.order; changed = true; }
      if (!doc.image) { doc.image = cat.image; changed = true; } // only fills an empty photo
      if (changed) await doc.save();
    }
    catByName.set(cat.name, { id: doc._id.toString(), name: doc.name });
  }

  for (const move of CATEGORY_MOVES) {
    const target = catByName.get(move.to);
    if (!target) continue;
    const res = await MenuItem.updateMany(
      { name: { $regex: move.namePattern.source, $options: 'i' }, categoryId: { $ne: target.id } },
      { $set: { categoryId: target.id, categoryName: target.name } }
    );
    result.moved += res.modifiedCount ?? 0;
  }

  for (const item of CATALOG_ITEMS) {
    if (await MenuItem.exists({ name: sameName(item.name) })) {
      result.itemsSkipped += 1;
      continue;
    }
    const cat = catByName.get(item.category);
    if (!cat) throw new Error(`Unknown category "${item.category}" for ${item.name}`);
    await MenuItem.create({
      name: item.name,
      description: item.description,
      price: item.price,
      discountPrice: item.discountPrice,
      image: item.image,
      categoryId: cat.id,
      categoryName: cat.name,
      available: true,
      featured: !!item.featured,
      popular: !!item.popular,
      rating: 0,
      reviewCount: 0,
      prepTime: item.prepTime,
      ingredients: item.ingredients || [],
      allergens: item.allergens || [],
      modifiers: item.modifiers || [],
      recipe: [],
    });
    result.itemsAdded += 1;
  }

  await fixBrokenImages();
  await Counter.updateOne({ _id: 'menuCatalogVersion' }, { $set: { seq: CATALOG_VERSION } }, { upsert: true });
  return result;
};

/**
 * Runs once per catalog version when the server starts, so the full menu shows up without
 * anyone running a script. Dishes you delete later are not brought back (it won't run again).
 */
/** Swap known-broken photo links for working ones (only exact matches, so custom photos are kept). */
export const fixBrokenImages = async (): Promise<number> => {
  let fixed = 0;
  for (const [broken, replacement] of Object.entries(IMAGE_FIXES)) {
    const a = await MenuCategory.updateMany({ image: broken }, { $set: { image: replacement } });
    const b = await MenuItem.updateMany({ image: broken }, { $set: { image: replacement } });
    fixed += (a.modifiedCount ?? 0) + (b.modifiedCount ?? 0);
  }
  return fixed;
};

export const ensureMenuCatalog = async (): Promise<void> => {
  try {
    const fixed = await fixBrokenImages();
    if (fixed) console.log(`🖼️  Replaced ${fixed} broken menu photo link(s).`);
    const marker = await Counter.findById('menuCatalogVersion').lean();
    if (marker && marker.seq >= CATALOG_VERSION) {
      // already synced — just give any catalog category that has no photo its default one
      for (const cat of CATALOG_CATEGORIES) {
        await MenuCategory.updateOne({ name: sameName(cat.name), $or: [{ image: '' }, { image: { $exists: false } }] }, { $set: { image: cat.image } });
      }
      return;
    }
    const r = await syncMenuCatalog();
    console.log(`🍽️  Menu catalog v${CATALOG_VERSION}: added ${r.categoriesAdded} categories and ${r.itemsAdded} dishes (nothing deleted).`);
  } catch (err: any) {
    console.error('⚠️  Could not update the menu catalog:', err.message);
  }
};
