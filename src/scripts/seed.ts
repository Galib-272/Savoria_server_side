import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.model.js';
import { Table } from '../models/Table.model.js';
import { MenuCategory } from '../models/MenuCategory.model.js';
import { MenuItem } from '../models/MenuItem.model.js';
import { Order } from '../models/Order.model.js';
import { InventoryItem } from '../models/Inventory.model.js';
import { Supplier } from '../models/Supplier.model.js';
import { Purchase } from '../models/Purchase.model.js';
import { Expense } from '../models/Expense.model.js';
import { Coupon } from '../models/Coupon.model.js';
import { Review } from '../models/Review.model.js';
import { Notification } from '../models/Notification.model.js';
import { Reservation } from '../models/Reservation.model.js';
import { RestaurantSettings } from '../models/Settings.model.js';
import { Payment } from '../models/Payment.model.js';
import { AuditLog } from '../models/AuditLog.model.js';

const seedDatabase = async () => {
  try {
    await connectDB();
    console.log('[Seed] Clearing existing collections...');

    await Promise.all([
      User.deleteMany({}),
      Table.deleteMany({}),
      MenuCategory.deleteMany({}),
      MenuItem.deleteMany({}),
      Order.deleteMany({}),
      InventoryItem.deleteMany({}),
      Supplier.deleteMany({}),
      Purchase.deleteMany({}),
      Expense.deleteMany({}),
      Coupon.deleteMany({}),
      Review.deleteMany({}),
      Notification.deleteMany({}),
      Reservation.deleteMany({}),
      RestaurantSettings.deleteMany({}),
      Payment.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);

    console.log('[Seed] Seeding Restaurant Settings...');
    await RestaurantSettings.create({
      name: 'Savoria',
      tagline: 'Where Every Bite Tells a Story',
      description:
        'A premium dining experience serving authentic cuisine crafted with the finest ingredients since 2014.',
      address: '123 Culinary Avenue, Dhaka 1213',
      phone: '+880 1700-000000',
      email: 'hello@savoria.com',
      hours: 'Mon–Sun: 10:00 AM – 11:00 PM',
      currency: '৳',
      taxRate: 10,
      serviceChargeRate: 0,
      deliveryFee: 50,
      logo: '',
      coverImage: 'https://images.pexels.com/photos/2387675/pexels-photo-2387675.jpeg?auto=compress&cs=tinysrgb&w=1000',
      primaryColor: '#E11D48',
    });

    console.log('[Seed] Seeding Users & Staff...');
    // 1. Protected Main Admin
    await User.create({
      name: 'Owner Admin',
      email: 'admin@savoria.com',
      password: 'Admin@123456',
      phone: '+880 1700-100200',
      role: 'admin',
      status: 'active',
      isMainAdmin: true,
      joinDate: '2014-01-01',
      permissions: ['*'],
    });

    // 2. Manager
    await User.create({
      name: 'Mahmudul Hasan',
      email: 'manager@savoria.com',
      password: 'Manager@123456',
      phone: '+880 1700-200300',
      role: 'manager',
      status: 'active',
      isMainAdmin: false,
      assignedManager: 'Owner Admin',
      joinDate: '2018-03-15',
      permissions: [
        'staff.view',
        'orders.view',
        'orders.update',
        'tables.view',
        'tables.manage',
        'inventory.view',
        'inventory.manage',
        'reservations.view',
        'reservations.manage',
        'reports.view',
      ],
    });

    // 3. Cashier
    await User.create({
      name: 'Nadia Islam',
      email: 'cashier@savoria.com',
      password: 'Cashier@123456',
      phone: '+880 1700-300400',
      role: 'cashier',
      status: 'active',
      isMainAdmin: false,
      assignedManager: 'Mahmudul Hasan',
      joinDate: '2020-06-01',
    });

    // 4. Kitchen / Cook
    await User.create({
      name: 'Chef Rakib',
      email: 'kitchen@savoria.com',
      password: 'Kitchen@123456',
      phone: '+880 1700-400500',
      role: 'kitchen',
      status: 'active',
      isMainAdmin: false,
      assignedManager: 'Mahmudul Hasan',
      joinDate: '2019-02-10',
    });

    // 5. Exactly 10 Waiters (T1-T25 management)
    const waitersList = [
      { name: 'Rahim Uddin', email: 'rahim@savoria.com', phone: '+880 1700-500600' },
      { name: 'Karim Ali', email: 'karim@savoria.com', phone: '+880 1700-600700' },
      { name: 'Tarek Mahmud', email: 'tarek@savoria.com', phone: '+880 1700-600701' },
      { name: 'John Doe', email: 'john@savoria.com', phone: '+880 1700-600702' },
      { name: 'Arif Khan', email: 'arif@savoria.com', phone: '+880 1700-600703' },
      { name: 'Sohel Rana', email: 'sohel@savoria.com', phone: '+880 1700-600704' },
      { name: 'Farhan Kabir', email: 'farhan@savoria.com', phone: '+880 1700-600705' },
      { name: 'Hasan Reza', email: 'hasan@savoria.com', phone: '+880 1700-600706' },
      { name: 'Rashed Iqbal', email: 'rashed@savoria.com', phone: '+880 1700-600707' },
      { name: 'Tanvir Hossain', email: 'tanvir@savoria.com', phone: '+880 1700-600708' },
    ];

    for (const w of waitersList) {
      await User.create({
        name: w.name,
        email: w.email,
        password: 'Waiter@123456',
        phone: w.phone,
        role: 'waiter',
        status: 'active',
        isMainAdmin: false,
        assignedManager: 'Mahmudul Hasan',
        joinDate: '2021-04-20',
      });
    }

    // 6. Delivery Staff
    await User.create({
      name: 'Jamal Ahmed',
      email: 'delivery@savoria.com',
      password: 'Delivery@123456',
      phone: '+880 1700-700800',
      role: 'delivery',
      status: 'active',
      isMainAdmin: false,
      assignedManager: 'Mahmudul Hasan',
      joinDate: '2022-01-05',
    });

    // 7. Customer
    await User.create({
      name: 'Ahmed Hassan',
      email: 'customer@savoria.com',
      password: 'Customer@123456',
      phone: '+880 1711-123456',
      role: 'customer',
      status: 'active',
      isMainAdmin: false,
    });

    console.log('[Seed] Seeding 25 Tables (T1–T25) with 4 Seats (S1–S4)...');
    const sections = ['Main', 'Window', 'Patio', 'VIP'];
    const tablesData = [];
    for (let i = 1; i <= 25; i++) {
      let sec = 'Main';
      if ([1, 2, 11, 12, 21, 22].includes(i)) sec = 'Window';
      else if ([5, 6, 15, 16, 25].includes(i)) sec = 'Patio';
      else if ([8, 9, 18, 19].includes(i)) sec = 'VIP';

      let status = 'available';
      let waiterName = undefined;
      if (i === 2) {
        status = 'occupied';
        waiterName = 'Rahim Uddin';
      } else if (i === 3) {
        status = 'reserved';
      } else if (i === 5) {
        status = 'occupied';
        waiterName = 'Karim Ali';
      } else if (i === 6) {
        status = 'cleaning';
      } else if (i === 8) {
        status = 'occupied';
        waiterName = 'Rahim Uddin';
      } else if (i === 10) {
        status = 'out_of_service';
      }

      tablesData.push({
        number: i,
        tableName: `T${i}`,
        capacity: 4,
        section: sec,
        status,
        waiterName,
        seats: [
          { seatNumber: 'S1', status: status === 'occupied' ? 'occupied' : status === 'reserved' ? 'reserved' : 'available' },
          { seatNumber: 'S2', status: status === 'occupied' ? 'occupied' : 'available' },
          { seatNumber: 'S3', status: 'available' },
          { seatNumber: 'S4', status: 'available' },
        ],
      });
    }
    await Table.insertMany(tablesData);

    console.log('[Seed] Seeding Menu Categories...');
    const categoriesData = [
      { name: 'Burgers', icon: '🍔', active: true, order: 1 },
      { name: 'Pizza', icon: '🍕', active: true, order: 2 },
      { name: 'Pasta', icon: '🍝', active: true, order: 3 },
      { name: 'Chicken', icon: '🍗', active: true, order: 4 },
      { name: 'Rice', icon: '🍚', active: true, order: 5 },
      { name: 'Seafood', icon: '🦐', active: true, order: 6 },
      { name: 'Drinks', icon: '🥤', active: true, order: 7 },
      { name: 'Desserts', icon: '🍰', active: true, order: 8 },
      { name: 'Snacks', icon: '🍟', active: true, order: 9 },
    ];
    const createdCategories = await MenuCategory.insertMany(categoriesData);
    const catMap = new Map(createdCategories.map((c) => [c.name, c._id.toString()]));

    console.log('[Seed] Seeding Menu Items...');
    const menuItemsData = [
      {
        name: 'Classic Beef Burger',
        description: 'Juicy beef patty with fresh lettuce, tomato, onion, and our signature sauce in a toasted brioche bun.',
        price: 350,
        image: 'https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg?auto=compress&cs=tinysrgb&w=600',
        categoryId: catMap.get('Burgers') || '',
        categoryName: 'Burgers',
        available: true,
        featured: true,
        popular: true,
        rating: 4.8,
        reviewCount: 245,
        prepTime: 15,
        ingredients: ['Beef Patty', 'Lettuce', 'Tomato', 'Onion', 'Brioche Bun', 'Special Sauce'],
        allergens: ['Gluten', 'Dairy'],
        modifiers: [
          {
            id: 'mod-1',
            name: 'Size',
            type: 'single',
            required: true,
            options: [
              { id: 'opt-1', name: 'Regular', price: 0 },
              { id: 'opt-2', name: 'Large', price: 80 },
            ],
          },
          {
            id: 'mod-2',
            name: 'Extras',
            type: 'multiple',
            required: false,
            options: [
              { id: 'opt-3', name: 'Extra Cheese', price: 50 },
              { id: 'opt-4', name: 'Extra Sauce', price: 20 },
              { id: 'opt-5', name: 'Bacon', price: 70 },
            ],
          },
        ],
        recipe: [
          { inventoryItemName: 'Burger Bun', amount: 1, unit: 'pcs' },
          { inventoryItemName: 'Cheese', amount: 0.05, unit: 'kg' },
          { inventoryItemName: 'Sauce', amount: 0.02, unit: 'L' },
        ],
      },
      {
        name: 'Pepperoni Pizza',
        description: 'Wood-fired pizza topped with mozzarella, pepperoni, and a rich tomato base.',
        price: 550,
        discountPrice: 440,
        image: 'https://images.pexels.com/photos/825661/pexels-photo-825661.jpeg?auto=compress&cs=tinysrgb&w=600',
        categoryId: catMap.get('Pizza') || '',
        categoryName: 'Pizza',
        available: true,
        featured: true,
        popular: true,
        rating: 4.9,
        reviewCount: 320,
        prepTime: 20,
        ingredients: ['Pizza Dough', 'Mozzarella', 'Pepperoni', 'Tomato Sauce', 'Oregano'],
        allergens: ['Gluten', 'Dairy'],
        modifiers: [
          {
            id: 'mod-3',
            name: 'Size',
            type: 'single',
            required: true,
            options: [
              { id: 'opt-6', name: 'Medium (10")', price: 0 },
              { id: 'opt-7', name: 'Large (14")', price: 150 },
            ],
          },
        ],
        recipe: [
          { inventoryItemName: 'Cheese', amount: 0.15, unit: 'kg' },
          { inventoryItemName: 'Tomato', amount: 0.1, unit: 'kg' },
          { inventoryItemName: 'Flour', amount: 0.2, unit: 'kg' },
        ],
      },
      {
        name: 'Creamy Alfredo Pasta',
        description: 'Penne pasta in a rich creamy alfredo sauce with grilled chicken and parmesan.',
        price: 420,
        image: 'https://images.pexels.com/photos/1438672/pexels-photo-1438672.jpeg?auto=compress&cs=tinysrgb&w=600',
        categoryId: catMap.get('Pasta') || '',
        categoryName: 'Pasta',
        available: true,
        featured: true,
        popular: true,
        rating: 4.7,
        reviewCount: 180,
        prepTime: 18,
        ingredients: ['Penne Pasta', 'Cream', 'Chicken', 'Parmesan', 'Garlic', 'Butter'],
        allergens: ['Gluten', 'Dairy'],
      },
      {
        name: 'Crispy Fried Chicken',
        description: 'Golden fried chicken with our secret blend of 11 herbs and spices.',
        price: 280,
        image: 'https://images.pexels.com/photos/60616/fried-chicken-chicken-fried-crunchy-60616.jpeg?auto=compress&cs=tinysrgb&w=600',
        categoryId: catMap.get('Chicken') || '',
        categoryName: 'Chicken',
        available: true,
        featured: false,
        popular: true,
        rating: 4.6,
        reviewCount: 156,
        prepTime: 12,
        ingredients: ['Chicken', 'Flour', 'Spices', 'Oil'],
        allergens: ['Gluten'],
        recipe: [
          { inventoryItemName: 'Chicken', amount: 0.3, unit: 'kg' },
          { inventoryItemName: 'Flour', amount: 0.05, unit: 'kg' },
          { inventoryItemName: 'Cooking Oil', amount: 0.05, unit: 'L' },
        ],
      },
      {
        name: 'Chicken Biryani',
        description: 'Aromatic basmati rice cooked with marinated chicken, saffron, and traditional spices.',
        price: 380,
        image: 'https://images.pexels.com/photos/12737656/pexels-photo-12737656.jpeg?auto=compress&cs=tinysrgb&w=600',
        categoryId: catMap.get('Rice') || '',
        categoryName: 'Rice',
        available: true,
        featured: true,
        popular: true,
        rating: 4.9,
        reviewCount: 410,
        prepTime: 15,
        ingredients: ['Basmati Rice', 'Chicken', 'Saffron', 'Ghee', 'Spices'],
        allergens: ['Dairy'],
        recipe: [
          { inventoryItemName: 'Chicken', amount: 0.25, unit: 'kg' },
          { inventoryItemName: 'Rice', amount: 0.2, unit: 'kg' },
          { inventoryItemName: 'Cooking Oil', amount: 0.03, unit: 'L' },
        ],
      },
      {
        name: 'Grilled Salmon',
        description: 'Fresh Atlantic salmon fillet grilled to perfection with lemon herb butter sauce and roasted vegetables.',
        price: 650,
        image: 'https://images.pexels.com/photos/3655916/pexels-photo-3655916.jpeg?auto=compress&cs=tinysrgb&w=600',
        categoryId: catMap.get('Seafood') || '',
        categoryName: 'Seafood',
        available: true,
        featured: true,
        popular: false,
        rating: 4.8,
        reviewCount: 95,
        prepTime: 22,
        ingredients: ['Salmon Fillet', 'Lemon', 'Butter', 'Herbs', 'Asparagus'],
        allergens: ['Fish', 'Dairy'],
      },
      {
        name: 'Fresh Lime Mojito',
        description: 'Refreshing blend of fresh lime, mint leaves, simple syrup, and sparkling soda.',
        price: 120,
        image: 'https://images.pexels.com/photos/4051403/pexels-photo-4051403.jpeg?auto=compress&cs=tinysrgb&w=600',
        categoryId: catMap.get('Drinks') || '',
        categoryName: 'Drinks',
        available: true,
        featured: false,
        popular: true,
        rating: 4.5,
        reviewCount: 130,
        prepTime: 5,
        ingredients: ['Lime', 'Mint', 'Sugar', 'Soda Water', 'Ice'],
        allergens: [],
      },
      {
        name: 'Chocolate Lava Cake',
        description: 'Warm chocolate cake with a molten chocolate center, served with vanilla bean ice cream.',
        price: 220,
        image: 'https://images.pexels.com/photos/2067396/pexels-photo-2067396.jpeg?auto=compress&cs=tinysrgb&w=600',
        categoryId: catMap.get('Desserts') || '',
        categoryName: 'Desserts',
        available: true,
        featured: true,
        popular: true,
        rating: 4.9,
        reviewCount: 290,
        prepTime: 12,
        ingredients: ['Dark Chocolate', 'Butter', 'Eggs', 'Sugar', 'Flour', 'Vanilla Ice Cream'],
        allergens: ['Gluten', 'Dairy', 'Eggs'],
      },
      {
        name: 'Loaded French Fries',
        description: 'Crispy golden fries topped with melted cheese sauce, bacon bits, jalapenos, and sour cream.',
        price: 150,
        image: 'https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress&cs=tinysrgb&w=600',
        categoryId: catMap.get('Snacks') || '',
        categoryName: 'Snacks',
        available: true,
        featured: false,
        popular: true,
        rating: 4.6,
        reviewCount: 175,
        prepTime: 8,
        ingredients: ['Potatoes', 'Cheese Sauce', 'Jalapenos', 'Seasoning'],
        allergens: ['Dairy'],
      },
    ];
    await MenuItem.insertMany(menuItemsData);

    console.log('[Seed] Seeding Suppliers & Purchases...');
    const suppliersData = [
      { name: 'Rakibul Islam', company: 'ABC Foods', phone: '+880 1800-111111', email: 'info@abcfoods.com', address: 'Gulshan, Dhaka', products: ['Chicken', 'Cooking Oil'], status: 'active' },
      { name: 'Tania Begum', company: 'Dairy Fresh', phone: '+880 1800-222222', email: 'sales@dairyfresh.com', address: 'Mohakhali, Dhaka', products: ['Cheese', 'Milk', 'Butter'], status: 'active' },
      { name: 'Karim Sheikh', company: 'Rice Co.', phone: '+880 1800-333333', email: 'contact@riceco.com', address: 'Mirpur, Dhaka', products: ['Rice', 'Flour'], status: 'active' },
      { name: 'Jahid Khan', company: 'Fresh Veg', phone: '+880 1800-444444', email: 'order@freshveg.com', address: 'Kawran Bazar, Dhaka', products: ['Tomato', 'Potato', 'Onion', 'Lettuce'], status: 'active' },
      { name: 'Rina Akter', company: 'Bakery Plus', phone: '+880 1800-555555', email: 'info@bakeryplus.com', address: 'Banani, Dhaka', products: ['Burger Bun', 'Pizza Dough'], status: 'active' },
    ];
    await Supplier.insertMany(suppliersData);

    const purchasesData = [
      { purchaseNumber: '#P102', supplierName: 'ABC Foods', items: [{ name: 'Chicken', quantity: 20, unit: 'kg', cost: 280 }, { name: 'Cooking Oil', quantity: 15, unit: 'L', cost: 180 }], total: 8300, date: '2026-10-07', status: 'completed' },
      { purchaseNumber: '#P103', supplierName: 'Dairy Fresh', items: [{ name: 'Cheese', quantity: 10, unit: 'kg', cost: 600 }, { name: 'Milk', quantity: 20, unit: 'L', cost: 80 }], total: 7600, date: '2026-10-06', status: 'completed' },
      { purchaseNumber: '#P104', supplierName: 'Fresh Veg', items: [{ name: 'Tomato', quantity: 30, unit: 'kg', cost: 40 }, { name: 'Potato', quantity: 50, unit: 'kg', cost: 30 }], total: 2700, date: '2026-10-08', status: 'pending' },
      { purchaseNumber: '#P105', supplierName: 'Bakery Plus', items: [{ name: 'Burger Bun', quantity: 200, unit: 'pcs', cost: 15 }], total: 3000, date: '2026-10-05', status: 'completed' },
    ];
    await Purchase.insertMany(purchasesData);

    console.log('[Seed] Seeding Inventory Items...');
    const inventoryData = [
      { name: 'Chicken', category: 'Meat', unit: 'kg', currentStock: 3, minStock: 5, maxStock: 30, cost: 280, supplier: 'ABC Foods', status: 'low_stock' },
      { name: 'Cheese', category: 'Dairy', unit: 'kg', currentStock: 12, minStock: 5, maxStock: 25, cost: 600, supplier: 'Dairy Fresh', status: 'in_stock' },
      { name: 'Rice', category: 'Grains', unit: 'kg', currentStock: 50, minStock: 10, maxStock: 100, cost: 65, supplier: 'Rice Co.', status: 'in_stock' },
      { name: 'Flour', category: 'Grains', unit: 'kg', currentStock: 8, minStock: 10, maxStock: 50, cost: 45, supplier: 'Rice Co.', status: 'low_stock' },
      { name: 'Cooking Oil', category: 'Oil', unit: 'L', currentStock: 15, minStock: 5, maxStock: 40, cost: 180, supplier: 'ABC Foods', status: 'in_stock' },
      { name: 'Tomato', category: 'Vegetable', unit: 'kg', currentStock: 0, minStock: 8, maxStock: 30, cost: 40, supplier: 'Fresh Veg', status: 'out_of_stock' },
      { name: 'Potato', category: 'Vegetable', unit: 'kg', currentStock: 25, minStock: 10, maxStock: 50, cost: 30, supplier: 'Fresh Veg', status: 'in_stock' },
      { name: 'Burger Bun', category: 'Bakery', unit: 'pcs', currentStock: 80, minStock: 30, maxStock: 200, cost: 15, supplier: 'Bakery Plus', status: 'in_stock' },
      { name: 'Sauce', category: 'Condiments', unit: 'L', currentStock: 4, minStock: 5, maxStock: 20, cost: 220, supplier: 'Condiment Co.', status: 'low_stock' },
      { name: 'Salmon', category: 'Seafood', unit: 'kg', currentStock: 6, minStock: 3, maxStock: 15, cost: 850, supplier: 'Sea Fresh', expirationDate: '2026-10-12', status: 'in_stock' },
    ];
    await InventoryItem.insertMany(inventoryData);

    console.log('[Seed] Seeding Expenses...');
    const expensesData = [
      { amount: 45000, category: 'Rent', date: '2026-10-01', description: 'Monthly restaurant rent', createdBy: 'Mahmudul Hasan' },
      { amount: 18000, category: 'Electricity', date: '2026-10-02', description: 'Electricity bill for September', createdBy: 'Mahmudul Hasan' },
      { amount: 12000, category: 'Gas', date: '2026-10-02', description: 'Gas bill for September', createdBy: 'Mahmudul Hasan' },
      { amount: 85000, category: 'Salary', date: '2026-10-03', description: 'Staff salaries for September', createdBy: 'Owner Admin' },
      { amount: 5000, category: 'Maintenance', date: '2026-10-05', description: 'Refrigerator repair', createdBy: 'Mahmudul Hasan' },
      { amount: 8000, category: 'Marketing', date: '2026-10-06', description: 'Social media ad campaign', createdBy: 'Mahmudul Hasan' },
    ];
    await Expense.insertMany(expensesData);

    console.log('[Seed] Seeding Coupons...');
    const couponsData = [
      { code: 'SAVE20', type: 'percentage', value: 20, minOrder: 500, maxDiscount: 300, expiry: '2026-10-30', usageLimit: 100, used: 34, active: true },
      { code: 'WEEKEND50', type: 'fixed', value: 50, minOrder: 300, maxDiscount: undefined, expiry: '2026-10-31', usageLimit: 50, used: 12, active: true },
      { code: 'FREEDEL', type: 'fixed', value: 50, minOrder: 1000, maxDiscount: undefined, expiry: '2026-11-15', usageLimit: 200, used: 67, active: true },
      { code: 'COMBO15', type: 'percentage', value: 15, minOrder: 800, maxDiscount: 200, expiry: '2026-10-20', usageLimit: 30, used: 30, active: false },
    ];
    await Coupon.insertMany(couponsData);

    console.log('[Seed] Seeding Reviews...');
    const reviewsData = [
      { customerName: 'Ahmed Hassan', rating: 5, comment: 'The best burger I have had in Dhaka! Juicy, flavorful, and perfectly cooked.', date: '2026-10-08', orderId: '#1020', approved: true },
      { customerName: 'Sarah Ahmed', rating: 5, comment: 'Amazing pasta and great ambiance. Will definitely come back!', date: '2026-10-07', orderId: '#1018', approved: true },
      { customerName: 'Tanvir Rahman', rating: 4, comment: 'Pizza was delicious but delivery took a bit longer than expected.', date: '2026-10-06', orderId: '#1015', approved: true },
      { customerName: 'Fatima Khan', rating: 5, comment: 'The biryani is authentic and the lava cake is to die for!', date: '2026-10-05', orderId: '#1010', approved: true },
      { customerName: 'Imran Hossain', rating: 4, comment: 'Great food quality and friendly staff. Highly recommended.', date: '2026-10-04', orderId: '#1008', approved: true },
    ];
    await Review.insertMany(reviewsData);

    console.log('[Seed] Seeding Notifications...');
    const notificationsData = [
      { title: 'New Order', message: 'Order #1029 has been placed', type: 'order', read: false, time: '2 min ago' },
      { title: 'Order Ready', message: 'Order #1026 is ready to serve', type: 'kitchen', read: false, time: '5 min ago' },
      { title: 'Low Stock Alert', message: 'Chicken stock is low (3kg remaining)', type: 'inventory', read: false, time: '15 min ago' },
      { title: 'Bill Request', message: 'Table 12 requested the bill', type: 'table', read: true, time: '30 min ago' },
      { title: 'Delivery Assigned', message: 'Order #1027 assigned to Jamal', type: 'delivery', read: true, time: '1 hr ago' },
      { title: 'Payment Received', message: 'Payment of ৳970 received for Order #1028', type: 'payment', read: true, time: '2 hrs ago' },
    ];
    await Notification.insertMany(notificationsData);

    console.log('[Seed] Seeding Reservations...');
    const reservationsData = [
      { customerName: 'David Chen', customerPhone: '+880 1900-111111', date: '2026-10-09', time: '7:00 PM', guests: 4, tableNumber: 3, seats: ['S1', 'S2', 'S3', 'S4'], specialRequest: 'Window seat preferred', status: 'confirmed' },
      { customerName: 'Maria Gomez', customerPhone: '+880 1900-222222', date: '2026-10-09', time: '8:30 PM', guests: 2, tableNumber: 9, seats: ['S1', 'S2'], status: 'pending' },
      { customerName: 'Arif Mahmud', customerPhone: '+880 1900-333333', date: '2026-10-10', time: '1:00 PM', guests: 4, tableNumber: 14, seats: ['S1', 'S2', 'S3', 'S4'], specialRequest: 'Birthday celebration', status: 'confirmed' },
    ];
    await Reservation.insertMany(reservationsData);

    console.log('[Seed] Seeding Initial Orders & Payments...');
    const ordersData = [
      {
        orderNumber: '#1025',
        customerName: 'Ahmed Hassan',
        customerPhone: '+880 1711-123456',
        orderType: 'dine-in',
        tableNumber: 2,
        seats: ['S1', 'S2'],
        items: [
          { name: 'Classic Beef Burger', quantity: 2, price: 350, modifiers: ['Large', 'Extra Cheese'] },
          { name: 'Chocolate Lava Cake', quantity: 1, price: 220 },
        ],
        subtotal: 920,
        discount: 0,
        tax: 92,
        deliveryFee: 0,
        total: 1012,
        paymentStatus: 'pending',
        status: 'preparing',
        waiterName: 'Rahim Uddin',
        kitchenStaffName: 'Chef Rakib',
        notes: 'No onions in the burger',
        timeline: [
          { time: '10:30', status: 'new', label: 'Order Created' },
          { time: '10:31', status: 'confirmed', label: 'Order Confirmed' },
          { time: '10:34', status: 'preparing', label: 'Kitchen Started Preparation (Chef Rakib)' },
        ],
      },
      {
        orderNumber: '#1026',
        customerName: 'Sarah Ahmed',
        customerPhone: '+880 1712-654321',
        orderType: 'dine-in',
        tableNumber: 5,
        seats: ['S1'],
        items: [
          { name: 'Creamy Alfredo Pasta', quantity: 1, price: 420 },
          { name: 'Fresh Lime Mojito', quantity: 2, price: 120 },
        ],
        subtotal: 660,
        discount: 66,
        tax: 59,
        deliveryFee: 0,
        total: 653,
        paymentStatus: 'pending',
        status: 'ready',
        waiterName: 'Karim Ali',
        timeline: [
          { time: '10:20', status: 'new', label: 'Order Created' },
          { time: '10:21', status: 'confirmed', label: 'Order Confirmed' },
          { time: '10:25', status: 'preparing', label: 'Kitchen Started Preparation' },
          { time: '10:40', status: 'ready', label: 'Order Ready' },
        ],
      },
      {
        orderNumber: '#1027',
        customerName: 'Tanvir Rahman',
        customerPhone: '+880 1713-987654',
        orderType: 'delivery',
        items: [
          { name: 'Pepperoni Pizza', quantity: 1, price: 440, modifiers: ['Large (14")'] },
          { name: 'Loaded French Fries', quantity: 1, price: 150 },
        ],
        subtotal: 590,
        discount: 0,
        tax: 59,
        deliveryFee: 50,
        total: 699,
        paymentStatus: 'paid',
        paymentMethod: 'mobile_banking',
        status: 'out_for_delivery',
        deliveryStaffName: 'Jamal Ahmed',
        address: 'House 42, Road 5, Dhanmondi, Dhaka',
        timeline: [
          { time: '09:50', status: 'new', label: 'Order Created' },
          { time: '09:52', status: 'confirmed', label: 'Order Confirmed' },
          { time: '09:55', status: 'preparing', label: 'Kitchen Started Preparation' },
          { time: '10:15', status: 'ready', label: 'Order Ready' },
          { time: '10:25', status: 'picked_up', label: 'Order Picked Up by Jamal Ahmed' },
          { time: '10:35', status: 'out_for_delivery', label: 'Out for Delivery' },
        ],
      },
      {
        orderNumber: '#1028',
        customerName: 'Fatima Khan',
        customerPhone: '+880 1714-555555',
        orderType: 'takeaway',
        items: [
          { name: 'Chicken Biryani', quantity: 2, price: 380 },
          { name: 'Chocolate Lava Cake', quantity: 1, price: 220 },
        ],
        subtotal: 980,
        discount: 98,
        tax: 88,
        deliveryFee: 0,
        total: 970,
        paymentStatus: 'paid',
        paymentMethod: 'cash',
        status: 'completed',
        cashierName: 'Nadia Islam',
        timeline: [
          { time: '09:00', status: 'new', label: 'Order Created' },
          { time: '09:02', status: 'confirmed', label: 'Order Confirmed' },
          { time: '09:05', status: 'preparing', label: 'Kitchen Started Preparation' },
          { time: '09:25', status: 'ready', label: 'Order Ready' },
          { time: '09:30', status: 'served', label: 'Order Served' },
          { time: '09:45', status: 'completed', label: 'Order Completed' },
        ],
      },
    ];
    const createdOrders = await Order.insertMany(ordersData);

    // Initial Payment
    await Payment.create({
      orderId: createdOrders[3]._id.toString(),
      orderNumber: '#1028',
      amount: 970,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      cashierName: 'Nadia Islam',
      receiptNumber: 'REC-1001',
    });

    console.log('====================================================');
    console.log('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('====================================================');
    console.log('Demo Accounts:');
    console.log('  👑 Main Admin: admin@savoria.com / Admin@123456');
    console.log('  👔 Manager:    manager@savoria.com / Manager@123456');
    console.log('  💵 Cashier:    cashier@savoria.com / Cashier@123456');
    console.log('  👨‍🍳 Kitchen:    kitchen@savoria.com / Kitchen@123456');
    console.log('  🍽️  Waiters:    rahim@savoria.com / Waiter@123456 (10 waiters)');
    console.log('  🛵 Delivery:   delivery@savoria.com / Delivery@123456');
    console.log('  👤 Customer:   customer@savoria.com / Customer@123456');
    console.log('  🪑 Tables:     25 tables (T1–T25), 4 seats each (S1–S4)');
    console.log('====================================================');

    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();
