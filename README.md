# Savoria — Restaurant Management System (RMS) Backend API

Production-ready Node.js, Express.js, TypeScript, MongoDB, and Socket.IO REST API backend for the Restaurant Management System.

---

## 📋 Table of Contents
1. [Overview & Role Workflows](#overview--role-workflows)
2. [Folder Structure](#folder-structure)
3. [Quick Start](#quick-start)
4. [How to Connect MongoDB](#how-to-connect-mongodb)
5. [How to Configure Google Console for "Continue with Google"](#how-to-configure-google-console-for-continue-with-google)
6. [How to Configure Stripe Payments](#how-to-configure-stripe-payments)
7. [Database Seeding & Demo Accounts](#database-seeding--demo-accounts)
8. [API Endpoints Reference](#api-endpoints-reference)
9. [Socket.IO Real-Time Events](#socketio-real-time-events)

---

## 🍽️ Overview & Role Workflows

- **Main Admin / Owner (Protected Account):** Full system control. Fixed email/password (`admin@savoria.com`), protected from deletion, role modification, or suspension. Prohibits creation of secondary admins.
- **Manager:** Supervises daily restaurant operations, table occupancy, kitchen queue, staff performance, and inventory alerts without administrative root destruction privileges.
- **Cashier (POS & Billing):** Takes orders, processes customer checkout bills, handles Stripe & split payments, issues receipts (`REC-XXXX`), and immediately triggers real-time order alerts to the kitchen.
- **Cook / Kitchen:** Real-time queue featuring 3 stages: `New` ➔ `Preparing` ➔ `Ready`. When marked ready, routes notifications to Waiters (for Dine-In) or Delivery panel (for Delivery). Displays locked claims when staff claim food.
- **Waiter:** Manages restaurant tables (25 tables: `T1`–`T25`, each with 4 seats `S1`–`S4`). Claims ready dine-in food (`assigned to waiter {name}`), locking out duplicate claims by other waiters.
- **Delivery Staff:** Claims ready delivery orders (`picked up by {name}`). Manages stages: `Picked Up` ➔ `Out for Delivery` ➔ `Delivered`.
- **Customer:** Browses menu, customizes cart with modifiers, places Dine-In / Takeaway / Delivery orders, pays with Stripe or Cashier, tracks live order timelines, books tables and seats without conflicts.

---

## 📂 Folder Structure

```text
rms_server_side/
├── src/
│   ├── config/
│   │   ├── db.ts               # MongoDB Mongoose connection
│   │   ├── env.ts              # Environment variables
│   │   ├── google.ts           # Google OAuth verification
│   │   └── stripe.ts           # Stripe client setup
│   ├── controllers/
│   │   ├── auth.controller.ts        # Register, login, google login, me
│   │   ├── user.controller.ts        # Staff management, 10 waiters constraint, Admin protection
│   │   ├── table.controller.ts       # 25 tables (T1-T25), 4 seats (S1-S4)
│   │   ├── menu.controller.ts        # Categories, items, modifiers, recipes
│   │   ├── order.controller.ts       # Order lifecycle, cook/waiter/delivery claiming
│   │   ├── payment.controller.ts     # Cashier billing, Stripe intents, split payments, receipts
│   │   ├── reservation.controller.ts # Seat reservation with overlap prevention
│   │   ├── inventory.controller.ts   # Ingredients, stock levels, low-stock alerts
│   │   ├── supplier.controller.ts    # Suppliers & purchases (auto stock increase)
│   │   ├── expense.controller.ts     # Operational expenses
│   │   ├── coupon.controller.ts      # Discount coupons & checkout validation
│   │   ├── review.controller.ts      # Customer ratings & reviews
│   │   ├── notification.controller.ts# Centralized real-time notifications
│   │   ├── report.controller.ts      # Dashboard KPIs, weekly trends, sales charts
│   │   ├── audit.controller.ts       # System audit logs
│   │   └── setting.controller.ts     # Restaurant settings & branding
│   ├── middleware/
│   │   ├── auth.middleware.ts        # JWT token verification
│   │   ├── rbac.middleware.ts        # RBAC and Main Admin protection
│   │   ├── error.middleware.ts       # Centralized error handler
│   │   └── validate.middleware.ts    # Zod schema validation
│   ├── models/                       # 14 Mongoose Schema models
│   ├── routes/                       # Express router modules
│   ├── scripts/
│   │   └── seed.ts                   # Comprehensive database seed script
│   ├── sockets/
│   │   └── socketHandler.ts          # Socket.IO real-time event router
│   ├── types/                        # Core TypeScript types
│   ├── app.ts                        # Express application configuration
│   └── server.ts                     # HTTP + Socket.IO server startup
├── .env.example
├── .env
├── package.json
└── tsconfig.json
```

---

## ⚡ Quick Start

```bash
# 1. Navigate to backend directory
cd rms_server_side

# 2. Install dependencies
npm install

# 3. Configure environment variables (.env)
cp .env.example .env

# 4. Seed database with demo accounts, 25 tables, 10 waiters, menu & inventory
npm run seed

# 5. Start development server (Port 5001)
npm run dev
```

---

## 🍃 How to Connect MongoDB

### Option A: Local MongoDB (Default)
If you have MongoDB installed locally or running via Docker:
1. Ensure the MongoDB service is running:
   ```bash
   # On macOS via brew
   brew services start mongodb-community
   ```
2. Your `.env` will use the default URI:
   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017/rms_db
   ```

---

### Option B: MongoDB Atlas (Free Cloud Database)
1. **Create an Account:** Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign in.
2. **Create a Cluster:**
   - Click **"Create Deployment"** or **"Build a Database"**.
   - Choose the free **M0 (Shared)** tier.
   - Select your preferred cloud provider (AWS/Google Cloud) and closest region (e.g., Singapore/Mumbai).
   - Click **Create**.
3. **Create Database User:**
   - Under **Security** ➔ **Database Access**, click **Add New Database User**.
   - Choose **Password** Authentication.
   - Enter a username (e.g., `rms_admin`) and a secure password (e.g., `Savoria123456`).
   - Role: **Built-in Role ➔ Read and write to any database**.
   - Click **Add User**.
4. **Configure Network Access (IP Whitelist):**
   - Under **Security** ➔ **Network Access**, click **Add IP Address**.
   - Click **"Allow Access from Anywhere"** (`0.0.0.0/0`) or add your current IP address.
   - Click **Confirm**.
5. **Get the Connection String:**
   - Under **Database** ➔ **Clusters**, click **Connect**.
   - Select **Drivers** (Node.js).
   - Copy the connection URI:
     ```text
     mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
     ```
6. **Update `.env`:**
   Replace `<username>` and `<password>` with your database user credentials and specify the database name (`rms_db`):
   ```env
   MONGODB_URI=mongodb+srv://rms_admin:Savoria123456@cluster0.abcde.mongodb.net/rms_db?retryWrites=true&w=majority
   ```

---

## 🔐 How to Configure Google Console for "Continue with Google"

To enable **"Continue with Google"** on the customer website:

1. **Go to Google Cloud Console:**
   - Open [Google Cloud Console](https://console.cloud.google.com/).
2. **Create a New Project:**
   - Click on the project dropdown at the top ➔ **New Project**.
   - Project Name: `Savoria RMS` ➔ Click **Create**.
3. **Configure OAuth Consent Screen:**
   - In the left sidebar, navigate to **APIs & Services ➔ OAuth consent screen**.
   - Select **External** ➔ Click **Create**.
   - Fill in the required fields:
     - **App name:** `Savoria Restaurant`
     - **User support email:** (Your email)
     - **Developer contact information:** (Your email)
   - Click **Save and Continue**.
   - On the **Scopes** page: Click **Add or Remove Scopes**, select:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
   - Click **Save and Continue**.
   - Under **Test users**, add your Google email address for testing ➔ Click **Save and Continue**.
4. **Create OAuth 2.0 Client ID Credentials:**
   - In the left sidebar, navigate to **APIs & Services ➔ Credentials**.
   - Click **+ Create Credentials ➔ OAuth client ID**.
   - Application type: **Web application**.
   - Name: `RMS Client Web`.
   - **Authorized JavaScript origins:**
     - Add `http://localhost:3000` (for Next.js client development)
     - Add your production domain when deployed
   - **Authorized redirect URIs:**
     - Add `http://localhost:3000`
     - Add `http://localhost:3000/api/auth/callback/google`
   - Click **Create**.
5. **Copy Your Credentials:**
   - Google will display:
     - **Client ID** (e.g. `123456789-abcdef.apps.googleusercontent.com`)
     - **Client Secret** (e.g. `GOCSPX-xxxxxxxxx`)
6. **Add to `.env`:**
   ```env
   GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   ```
7. **Frontend Integration:**
   The frontend Google Sign-In button receives the Google ID Token / credential and calls:
   ```http
   POST /api/auth/google
   Content-Type: application/json

   {
     "credential": "eyJhbGciOiJSUzI1NiIs..."
   }
   ```
   The backend verifies the token directly with Google's public keys via `google-auth-library` and returns a JWT token.

---

## 💳 How to Configure Stripe Payments

1. Sign in to your [Stripe Dashboard](https://dashboard.stripe.com/).
2. Toggle to **Test Mode** (at the top right).
3. Navigate to **Developers ➔ API Keys**.
4. Copy your **Publishable key** (`pk_test_...`) and **Secret key** (`sk_test_...`).
5. Update `rms_server_side/.env`:
   ```env
   STRIPE_SECRET_KEY=sk_test_your_secret_key_here
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
   ```
> *Note: If `STRIPE_SECRET_KEY` is not provided, the backend automatically provides simulated mock client secrets during local testing so checkout flows never crash!*

---

## 👥 Database Seeding & Demo Accounts

Run `npm run seed` in `rms_server_side` to initialize all demo accounts:

| Role | Email | Password | Assigned Area |
| :--- | :--- | :--- | :--- |
| **Main Admin** 👑 | `admin@savoria.com` | `Admin@123456` | Protected / Full System Access |
| **Manager** 👔 | `manager@savoria.com` | `Manager@123456` | Operations, Reports, Stock Supervision |
| **Cashier** 💵 | `cashier@savoria.com` | `Cashier@123456` | POS Billing, Stripe, Receipts |
| **Kitchen / Cook** 👨‍🍳 | `kitchen@savoria.com` | `Kitchen@123456` | Kitchen Display, Preparation, Ready Routing |
| **Waiters (10 Accounts)** 🍽️ | `rahim@savoria.com`<br>`karim@savoria.com`<br>`tarek@savoria.com`<br>`john@savoria.com` *(and 6 more)* | `Waiter@123456` | Tables T1–T25, Seats S1–S4, Dine-In Claiming |
| **Delivery Staff** 🛵 | `delivery@savoria.com` | `Delivery@123456` | Delivery Orders, Pickup, Out for Delivery |
| **Customer** 👤 | `customer@savoria.com` | `Customer@123456` | Website, Ordering, Table Reservation |

### Tables & Seats Setup:
- **25 Tables:** `T1` through `T25`
- **4 Seats Per Table:** `S1`, `S2`, `S3`, `S4`
- **Sections:** Window, Patio, VIP, Main
- **States:** Available, Occupied, Reserved, Cleaning, Out of Service

---

## 🌐 API Endpoints Reference

### 1. Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a customer account
- `POST /api/auth/login` — Login with email and password
- `POST /api/auth/google` — Google OAuth credential login
- `GET /api/auth/me` — Get current logged-in profile (Bearer token)

### 2. Staff & Users (`/api/users`)
- `GET /api/users/staff` — List all staff members
- `POST /api/users/staff` — Create staff member (Main Admin only; enforces max 10 waiters & blocks duplicate Admin)
- `PUT /api/users/staff/:id` — Update staff (Protected Admin rules apply)
- `DELETE /api/users/staff/:id` — Remove staff member (Main Admin cannot be deleted)

### 3. Tables & Seats (`/api/tables`)
- `GET /api/tables` — Get all 25 tables with their 4 seats
- `GET /api/tables/:id` — Get single table details
- `PUT /api/tables/:id/status` — Update table status (`available`, `occupied`, `reserved`, `cleaning`)
- `PUT /api/tables/:id/seats/:seatNumber` — Update specific seat (`S1`, `S2`, `S3`, `S4`)
- `PUT /api/tables/:id/assign-waiter` — Assign a waiter to a table

### 4. Menu & Categories (`/api/menu`)
- `GET /api/menu/categories` — Get all menu categories
- `POST /api/menu/categories` — Create category
- `PUT /api/menu/categories/:id` — Update category
- `DELETE /api/menu/categories/:id` — Delete category
- `GET /api/menu/items` — Get all items (filters: `search`, `categoryId`, `featured`, `popular`, `available`)
- `GET /api/menu/items/:id` — Get item details (recipes, modifiers, allergens)
- `POST /api/menu/items` — Create menu item
- `PUT /api/menu/items/:id` — Update menu item
- `PATCH /api/menu/items/:id/availability` — Toggle item availability
- `DELETE /api/menu/items/:id` — Delete menu item

### 5. Orders (`/api/orders`)
- `POST /api/orders` — Create new order (Dine-In, Takeaway, Delivery)
- `GET /api/orders` — List orders (filters: `status`, `orderType`, `paymentStatus`, `search`, `page`)
- `GET /api/orders/:id` — Get order by ID or order number
- `PUT /api/orders/:id/start-preparing` — Cook starts preparing (status ➔ `preparing`)
- `PUT /api/orders/:id/mark-ready` — Cook marks ready (routes alert to Waiter or Delivery)
- `PUT /api/orders/:id/waiter-claim` — Waiter claims food (sets `assigned to waiter {name}` & locks out others)
- `PUT /api/orders/:id/delivery-pickup` — Delivery claims food (sets `picked up by {name}`)
- `PUT /api/orders/:id/delivery-out` — Delivery marks `out_for_delivery`
- `PUT /api/orders/:id/delivery-delivered` — Delivery marks `delivered` (triggers auto recipe stock deduction)
- `PUT /api/orders/:id/status` — Generic status update

### 6. Payments & Billing (`/api/payments`)
- `POST /api/payments/stripe-intent` — Create Stripe PaymentIntent
- `POST /api/payments/process` — Cashier processes bill (cash, card, split payment, bKash) ➔ sends order to kitchen
- `GET /api/payments` — Payment records & transaction logs
- `GET /api/payments/receipt/:orderId` — Generate professional receipt (`REC-XXXX`)

### 7. Reservations (`/api/reservations`)
- `POST /api/reservations` — Book table & seats (enforces seat overlap conflict prevention!)
- `GET /api/reservations` — List reservations
- `PUT /api/reservations/:id/status` — Update reservation status

### 8. Inventory & Stock (`/api/inventory`)
- `GET /api/inventory` — List inventory items & status (`in_stock`, `low_stock`, `out_of_stock`)
- `POST /api/inventory` — Add ingredient
- `PUT /api/inventory/:id` — Update ingredient
- `PATCH /api/inventory/:id/adjust` — Adjust stock manually with audit log
- `DELETE /api/inventory/:id` — Delete ingredient

### 9. Suppliers & Purchases (`/api/suppliers`)
- `GET /api/suppliers` — List suppliers
- `POST /api/suppliers` — Create supplier
- `GET /api/suppliers/purchases` — List purchase orders
- `POST /api/suppliers/purchases` — Record purchase order (automatically updates ingredient stock)

### 10. Expenses (`/api/expenses`)
- `GET /api/expenses` — View expenses (Rent, Electricity, Gas, Salary, Marketing, etc.)
- `POST /api/expenses` — Record expense
- `DELETE /api/expenses/:id` — Delete expense

### 11. Coupons (`/api/coupons`)
- `GET /api/coupons` — List active coupons
- `POST /api/coupons/validate` — Validate coupon against cart total & check expiration/usage
- `POST /api/coupons` — Create coupon
- `DELETE /api/coupons/:id` — Delete coupon

### 12. Reviews & Notifications (`/api/reviews`, `/api/notifications`)
- `GET /api/reviews` — Get customer reviews
- `POST /api/reviews` — Submit review
- `GET /api/notifications` — Get role-based real-time notifications
- `PATCH /api/notifications/:id/read` — Mark notification read
- `PATCH /api/notifications/read-all` — Mark all notifications read

### 13. Reports & Analytics (`/api/reports`)
- `GET /api/reports/dashboard-stats` — Live KPI counters (Revenue, Profit, Occupancy, Orders)
- `GET /api/reports/charts` — Weekly sales, category breakdown, popular items, order type distribution

### 14. Audit Logs (`/api/audit-logs`)
- `GET /api/audit-logs` — Complete chronological audit trail of all staff and system actions

### 15. Settings (`/api/settings`)
- `GET /api/settings` — Get restaurant settings (Currency: BDT ৳, tax rate, opening hours, branding)
- `PUT /api/settings` — Update restaurant settings (Admin only)

---

## 📡 Socket.IO Real-Time Events

Connect your client Socket.IO instance to `http://localhost:5001`.

| Event | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `join_role_room` | Client ➔ Server | `string` (`kitchen`, `waiter`, `delivery`, `cashier`, `manager`, `admin`) | Joins role-specific room |
| `join_order_room` | Client ➔ Server | `orderId` | Customer joins specific order room for live tracking |
| `order:updated` | Server ➔ Client | `Order` object | Broadcasts order status changes across panels |
| `order:customer_update` | Server ➔ Client | `Order` object | Sent to customer tracking timeline |
| `kitchen:new_order` | Server ➔ Client | `Order` object | Triggered when cashier takes payment |
| `waiter:order_ready` | Server ➔ Client | `{ orderId, orderNumber, tableNumber, message }` | Cook routes ready dine-in food to waiters |
| `delivery:order_ready` | Server ➔ Client | `{ orderId, orderNumber, address, message }` | Cook routes ready delivery food to delivery panel |
| `order:waiter_claimed` | Server ➔ Client | `{ orderId, waiterName, message }` | Waiter claims food, displays on cook board & locks others |
| `order:delivery_claimed` | Server ➔ Client | `{ orderId, deliveryName, message }` | Delivery rider picks up food, displays on cook board |
| `table:updated` | Server ➔ Client | `Table` object | Table or seat state change broadcast |
| `inventory:low_stock` | Server ➔ Client | `InventoryItem` | Low stock alert sent to managers and admin |
