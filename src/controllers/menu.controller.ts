import { Request, Response } from 'express';
import { MenuCategory } from '../models/MenuCategory.model.js';
import { MenuItem } from '../models/MenuItem.model.js';
import { AuthenticatedRequest } from '../types/index.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { escapeRegex, isValidObjectId, pick } from '../utils/helpers.js';

const MENU_ITEM_FIELDS = ['name', 'description', 'price', 'discountPrice', 'image', 'categoryId', 'available', 'featured', 'popular', 'prepTime', 'ingredients', 'allergens', 'modifiers', 'recipe'];

// --- CATEGORIES ---
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await MenuCategory.find().sort({ order: 1 });
    const formatted = categories.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      icon: c.icon,
      image: c.image || '',
      active: c.active,
      order: c.order,
    }));
    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCategory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, icon, order, active, image } = req.body;
    if (!name) {
      res.status(400).json({ success: false, message: 'Category name is required.' });
      return;
    }

    const category = await MenuCategory.create({
      name,
      icon: icon || '🍽️',
      image: typeof image === 'string' ? image : '',
      order: order || 0,
      active: active !== undefined ? active : true,
    });

    res.status(201).json({
      success: true,
      message: 'Category created',
      data: {
        id: category._id.toString(),
        name: category.name,
        icon: category.icon,
        image: category.image,
        active: category.active,
        order: category.order,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCategory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: 'Invalid category id' });
      return;
    }
    const updates = pick(req.body, ['name', 'icon', 'image', 'active', 'order']);
    const category = await MenuCategory.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!category) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }
    // keep the denormalised category name on menu items in sync
    if (updates.name) await MenuItem.updateMany({ categoryId: id }, { categoryName: category.name });
    res.status(200).json({ success: true, data: category });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCategory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const itemCount = await MenuItem.countDocuments({ categoryId: id });
    if (itemCount > 0) {
      res.status(409).json({
        success: false,
        message: `This category still has ${itemCount} menu item(s). Move or delete them first.`,
      });
      return;
    }
    await MenuCategory.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- MENU ITEMS ---
export const getMenuItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId, search, featured, popular, available } = req.query;
    const filter: any = {};

    if (categoryId) filter.categoryId = String(categoryId);
    if (featured !== undefined) filter.featured = featured === 'true';
    if (popular !== undefined) filter.popular = popular === 'true';
    if (available !== undefined) filter.available = available === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: escapeRegex(search), $options: 'i' } },
        { description: { $regex: escapeRegex(search), $options: 'i' } },
      ];
    }

    const items = await MenuItem.find(filter).sort({ createdAt: -1 });

    const formatted = items.map((item) => ({
      id: item._id.toString(),
      name: item.name,
      description: item.description,
      price: item.price,
      discountPrice: item.discountPrice,
      image: item.image,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      available: item.available,
      featured: item.featured,
      popular: item.popular,
      rating: item.rating,
      reviewCount: item.reviewCount,
      prepTime: item.prepTime,
      ingredients: item.ingredients,
      allergens: item.allergens,
      modifiers: item.modifiers,
    }));

    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMenuItemById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const item = isValidObjectId(id) ? await MenuItem.findById(id) : null;
    if (!item) {
      res.status(404).json({ success: false, message: 'Menu item not found' });
      return;
    }
    res.status(200).json({
      success: true,
      data: {
        id: item._id.toString(),
        name: item.name,
        description: item.description,
        price: item.price,
        discountPrice: item.discountPrice,
        image: item.image,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        available: item.available,
        featured: item.featured,
        popular: item.popular,
        rating: item.rating,
        reviewCount: item.reviewCount,
        prepTime: item.prepTime,
        ingredients: item.ingredients,
        allergens: item.allergens,
        modifiers: item.modifiers,
        recipe: item.recipe,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createMenuItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, description, price, discountPrice, image, categoryId, prepTime, ingredients, allergens, modifiers, recipe, featured, popular } = req.body;
    const cleanDiscount = discountPrice === '' || discountPrice === null || discountPrice === undefined ? undefined : Number(discountPrice);

    if (!name || price === undefined || !categoryId) {
      res.status(400).json({ success: false, message: 'Name, price, and categoryId are required.' });
      return;
    }

    const category = isValidObjectId(categoryId) ? await MenuCategory.findById(categoryId) : null;
    if (!category) {
      res.status(400).json({ success: false, message: 'Please choose a valid category.' });
      return;
    }
    if (!(Number(price) >= 0)) {
      res.status(400).json({ success: false, message: 'Price must be a positive number.' });
      return;
    }

    const item = await MenuItem.create({
      name,
      description: description || '',
      price,
      discountPrice: cleanDiscount,
      image: image || 'https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg?auto=compress&cs=tinysrgb&w=600',
      categoryId,
      categoryName: category.name,
      prepTime: prepTime || 15,
      ingredients: ingredients || [],
      allergens: allergens || [],
      modifiers: modifiers || [],
      recipe: recipe || [],
      featured: !!featured,
      popular: !!popular,
      available: req.body.available !== false,
    });

    await AuditLog.create({
      userId: req.user?.userId,
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'admin',
      action: 'CREATE_MENU_ITEM',
      entity: 'MenuItem',
      entityId: item._id.toString(),
      details: `Created menu item ${item.name} with price ৳${item.price}`,
    });

    res.status(201).json({ success: true, message: 'Menu item created', data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMenuItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      res.status(400).json({ success: false, message: 'Invalid menu item id' });
      return;
    }
    const updates: any = pick(req.body, MENU_ITEM_FIELDS);
    if (updates.categoryId) {
      const category = isValidObjectId(updates.categoryId) ? await MenuCategory.findById(updates.categoryId) : null;
      if (!category) {
        res.status(400).json({ success: false, message: 'Please choose a valid category.' });
        return;
      }
      updates.categoryName = category.name;
    }
    if (updates.discountPrice === '' || updates.discountPrice === null) {
      delete updates.discountPrice;
      updates.$unset = { discountPrice: 1 };
    }
    const item = await MenuItem.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!item) {
      res.status(404).json({ success: false, message: 'Menu item not found' });
      return;
    }

    await AuditLog.create({
      userId: req.user?.userId,
      userName: req.user?.name || 'Staff',
      userRole: req.user?.role || 'admin',
      action: 'UPDATE_MENU_ITEM',
      entity: 'MenuItem',
      entityId: item._id.toString(),
      details: `Updated menu item ${item.name}`,
    });

    res.status(200).json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleAvailability = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const item = await MenuItem.findById(id);
    if (!item) {
      res.status(404).json({ success: false, message: 'Menu item not found' });
      return;
    }

    item.available = !item.available;
    await item.save();

    res.status(200).json({
      success: true,
      message: `Item availability set to ${item.available ? 'available' : 'unavailable'}`,
      data: item,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteMenuItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const item = await MenuItem.findByIdAndDelete(id);
    if (!item) {
      res.status(404).json({ success: false, message: 'Menu item not found' });
      return;
    }

    await AuditLog.create({
      userId: req.user?.userId,
      userName: req.user?.name || 'Admin',
      userRole: req.user?.role || 'admin',
      action: 'DELETE_MENU_ITEM',
      entity: 'MenuItem',
      entityId: id,
      details: `Deleted menu item ${item.name}`,
    });

    res.status(200).json({ success: true, message: 'Menu item deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
