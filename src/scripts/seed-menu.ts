/**
 * Adds the full Savoria menu to an EXISTING database without deleting anything.
 *
 *   npm run seed:menu
 *
 * - creates any missing categories (Biryani, Kebab & Grill, Coffee & Tea, ...)
 * - adds any missing dishes (matched by name, so dishes you already have or edited are left alone)
 * - moves biryani dishes that sit in another category (e.g. "Rice") into "Biryani"
 * Safe to run more than once.
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { MenuCategory } from '../models/MenuCategory.model.js';
import { MenuItem } from '../models/MenuItem.model.js';
import { syncMenuCatalog } from '../services/menu-catalog.service.js';

const run = async () => {
  await connectDB();
  const r = await syncMenuCatalog();
  const totalItems = await MenuItem.countDocuments();
  const totalCats = await MenuCategory.countDocuments();
  console.log('====================================================');
  console.log(`✅ Menu updated — nothing was deleted.`);
  console.log(`   Categories added: ${r.categoriesAdded}  (now ${totalCats})`);
  console.log(`   Dishes added:     ${r.itemsAdded}  (already there: ${r.itemsSkipped}, now ${totalItems})`);
  console.log(`   Dishes moved into Biryani: ${r.moved}`);
  console.log('====================================================');
};

run()
  .catch((err) => {
    console.error('❌ Menu update failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
