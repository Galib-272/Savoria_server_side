<div align="center">

# 🍽️ Savoria API Server

### *Real-time backend engine for the Savoria Restaurant Management System*

[![Live API](https://img.shields.io/badge/🚀_Live_API-Health_Check-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://savoria-server-side.onrender.com/api/health)
[![Live Site](https://img.shields.io/badge/🌐_Live_Site-Visit_Savoria-E0442A?style=for-the-badge&logo=vercel&logoColor=white)](https://savoria-client-side.vercel.app)
[![Frontend Repo](https://img.shields.io/badge/💻_Frontend_Repo-View_on_GitHub-181717?style=for-the-badge&logo=github)](https://github.com/Galib-272/Savoria_client_side)

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=flat-square&logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=flat-square&logo=socketdotio&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=flat-square&logo=jsonwebtokens&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-635BFF?style=flat-square&logo=stripe&logoColor=white)

---

### ⚙️ REST API + live event hub for seven role-based panels

> *Orders · Kitchen flow · Tables & seats · Reservations · Payments · Inventory · Analytics · Notifications*

</div>

---

## ⚡ Architecture Highlights

| Feature | Description |
|---------|-------------|
| 🔐 **JWT + role guards** | Every private route checks the token and the user's role (`admin`, `manager`, `cashier`, `kitchen`, `waiter`, `delivery`, `customer`). Public sign-ups are always created as customers — staff accounts can't be self-registered. |
| 📡 **Server-assigned Socket.IO rooms** | Sockets are authenticated on connect and placed in `role:<role>` and `user:<id>` rooms by the server (clients can't pick rooms). Each event is emitted **once** to the union of rooms, so no panel gets duplicates or another panel's notifications. |
| 🔔 **One notification service** | A single `notify()` stores one document per audience with per-user read/clear state, and pushes it live — including to the person who made the change, flagged `self` so their bell updates instantly without a second popup. |
| 💰 **Server-side pricing** | Order totals are recalculated from the database (menu prices, add-ons, coupons, tax and delivery fee from Settings). The client's numbers are never trusted. |
| 🔄 **Validated order lifecycle** | `new → preparing → ready → served / completed / delivered`, with per-role transition rules, atomic order / receipt / purchase numbers, and stock deducted exactly once. |
| 📅 **Clash-free reservations** | 2-hour overlap window per seat, a public availability endpoint, and today-only seat syncing in the restaurant's time zone (`Asia/Dhaka`). |
| 💳 **Demo payment pipeline** | Card, cash, mobile banking and bank transfer. The Stripe screen is a simulation that accepts any amount, records a payment and receipt, and never charges real money. |
| 🍔 **Self-healing menu catalog** | On startup the server adds any missing categories and dishes from the built-in catalog (14 categories, 96 dishes) and repairs known broken photo links — without ever deleting or overwriting your own edits. |
| 🛡️ **Hardened Express app** | Helmet, strict CORS allow-list in production, request logging, and consistent JSON errors. |

---

## 🆕 Latest Updates (October 2026)

### 🔔 Instant notifications for your own actions
- The person who changes something (e.g. an admin cancelling an order) now gets the notification in their bell immediately — previously it only appeared after a refresh.
- New helper `emitToActorInRooms()` only delivers to the actor's tabs that belong to the event's audience.

### 🍔 Menu catalog & category photos
- New categories: **Biryani, Kebab & Grill, Soups & Salads, Coffee & Tea, Juices & Shakes** — 96 dishes in total, each with a verified photo.
- `MenuCategory` now has an `image` field; `GET /api/menu/categories` returns it.
- `ensureMenuCatalog()` runs once per catalog version at startup; `npm run seed:menu` does the same on demand. Neither deletes anything.
- Broken photo links (Chicken, Fresh Lime Mojito) are swapped automatically on startup.

### 🌐 Sign-in "failed to connect" fix
- CORS no longer returns a 500 for unknown origins. In development every origin is allowed (localhost, 127.0.0.1, LAN IP); in production only `CLIENT_URL` and `CLIENT_URLS`.

### 🔒 Access control & data safety
- Registration always creates customers; staff can't use Google sign-in.
- Forgot-password flow, manager limits on staff management, ownership checks on orders and reservations.
- Coupons validated and counted on the server; totals computed from the database.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js (LTS) |
| **Framework** | Express.js 4 (TypeScript, ES modules) |
| **Database** | MongoDB Atlas + Mongoose 8 |
| **Real-time** | Socket.IO 4 |
| **Auth** | JSON Web Tokens + bcrypt, Google Identity (google-auth-library) |
| **Payments** | Stripe SDK (demo / simulation mode) |
| **Security** | Helmet, CORS allow-list, role middleware |
| **Deployment** | Render (always-on web service) |

---

## 📋 API Reference

All routes are prefixed with `/api`. 🔒 = JWT required.

### 🔓 Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/auth/register` | Create a customer account |
| `POST` | `/auth/login` | Email + password login |
| `POST` | `/auth/google` | Continue with Google (customers only) |
| `POST` | `/auth/forgot-password` | Password reset request |
| `GET` | `/menu/categories` | All categories (with photo) |
| `GET` | `/menu/items` | Dishes — filter by `categoryId`, `search`, `featured`, `popular`, `available` |
| `GET` | `/menu/items/:id` | Dish details |
| `GET` | `/tables` · `/tables/:id` | Floor map (public view) |
| `GET` | `/reservations/availability` | Free seats for a date & time |
| `GET` | `/reviews` | Approved reviews |
| `GET` | `/settings` | Restaurant info, tax, delivery fee |
| `POST` | `/coupons/validate` · `GET /coupons` | Check a coupon / list offers |
| `POST` | `/contact` | Contact form |

### 👤 Account 🔒

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/auth/me` | Current user |
| `PUT` | `/auth/profile` | Update profile & avatar |
| `GET` | `/notifications` | Your notifications |
| `PATCH` | `/notifications/:id/read` · `/notifications/read-all` | Mark read |
| `DELETE` | `/notifications/clear-all` | Clear your list |

### 🧾 Orders 🔒

| Method | Endpoint | Roles |
|--------|----------|-------|
| `POST` | `/orders` | customer, cashier, waiter, admin, manager |
| `GET` | `/orders` · `/orders/:id` | everyone (customers see only their own) |
| `PUT` | `/orders/:id/start-preparing` · `/mark-ready` | kitchen, admin, manager |
| `PUT` | `/orders/:id/waiter-claim` | waiter, admin, manager |
| `PUT` | `/orders/:id/delivery-pickup` · `/delivery-out` · `/delivery-delivered` | delivery, admin, manager |
| `PUT` | `/orders/:id/status` | served / completed / cancelled — rules checked per role |

### 💳 Payments 🔒

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/payments/stripe-intent` | Demo card payment intent |
| `POST` | `/payments/process` | Record a payment (cashier, admin, manager) |
| `GET` | `/payments` | Transaction history |
| `GET` | `/payments/receipt/:orderId` | Receipt |

### 📅 Tables & Reservations 🔒

| Method | Endpoint | Roles |
|--------|----------|-------|
| `PUT` | `/tables/:id/status` · `/tables/:id/seats/:seatNumber` | waiter, cashier, admin, manager |
| `PUT` | `/tables/:id/assign-waiter` | waiter, admin, manager |
| `POST` | `/reservations` | customer, waiter, admin, manager |
| `GET` | `/reservations` | customer (own), staff |
| `PUT` | `/reservations/:id/status` | waiter, admin, manager |
| `PUT` | `/reservations/:id/cancel` | customer (own) |
| `POST` | `/reviews` | customer |

### 🛠️ Management 🔒

| Method | Endpoint | Roles |
|--------|----------|-------|
| `POST/PUT/DELETE` | `/menu/categories(/:id)` · `/menu/items(/:id)` | admin, manager (delete: admin) |
| `PATCH` | `/menu/items/:id/availability` | admin, manager |
| `GET/POST/PUT/DELETE` | `/inventory` · `PATCH /inventory/:id/adjust` | admin, manager, kitchen (adjust) |
| `GET/POST/PUT/DELETE` | `/suppliers` · `/suppliers/purchases` | admin, manager |
| `GET/POST/DELETE` | `/expenses` | admin, manager |
| `POST/DELETE` | `/coupons` | admin, manager |
| `GET/POST/PUT/DELETE` | `/users/staff` | admin (managers: view & limited edits) |
| `GET` | `/reports/dashboard-stats` · `/reports/charts` | admin, manager |
| `GET` | `/audit-logs` | admin, manager |
| `PUT` | `/settings` | admin |

---

## 📡 Socket.IO Events

Connect with `auth: { token }`. The server places each socket in its rooms automatically.

| Event | Sent to | Purpose |
|-------|---------|---------|
| `notification` | the event's audience (+ the actor, with `self: true`) | Bell & popup |
| `notification:read_one` · `read_all` · `cleared_all` | your own tabs | Keep tabs in sync |
| `order:updated` | staff, the order's customer, tracking room | Order status changes |
| `kitchen:new_order` | kitchen, admin, manager | New ticket on the cooking board |
| `waiter:order_ready` · `delivery:order_ready` | waiters · riders | Food ready to pick up |
| `order:waiter_claimed` · `order:delivery_claimed` | staff | Someone took the order |
| `table:updated` | everyone (guests get a privacy-safe version) | Floor map & seats |
| `reservation:new_request` · `reservation:status_update` | waiters & management · the customer | Bookings |
| `payment:created` | cashier, admin, manager | New payment |
| `inventory:low_stock` | admin, manager, kitchen | Stock alert |

---

## 🚀 Run It Locally

```bash
git clone https://github.com/Galib-272/Savoria_server_side.git
cd Savoria_server_side
npm install
cp .env.example .env     # then fill in the values
npm run dev              # http://localhost:5001
```

| Variable | Description |
|----------|-------------|
| `PORT` | Local port (default `5001`; Render sets its own) |
| `NODE_ENV` | `development` locally, `production` when deployed |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` · `JWT_EXPIRES_IN` | Token signing secret and lifetime (e.g. `7d`) |
| `CLIENT_URL` · `CLIENT_URLS` | Allowed front-end address(es) in production (comma-separated) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID for "Continue with Google" |
| `RESTAURANT_TIMEZONE` | Time zone for "today", reservations and reports (`Asia/Dhaka`) |
| `MAIN_ADMIN_*` · `MANAGER_*` | Fixed admin & manager accounts |
| `STRIPE_SECRET_KEY` | Optional — the demo checkout works without it |

| Script | What it does |
|--------|--------------|
| `npm run dev` | Start with auto-reload (nodemon + tsx) |
| `npm run build` · `npm start` | Compile TypeScript to `dist/` and run it |
| `npm run seed:menu` | Add any missing categories & dishes — **never deletes** |
| `npm run seed` | ⚠️ Rebuild the demo database from scratch — **wipes all data** |

---

## ☁️ Deployment

Deployed on **Render** as an always-on web service — Socket.IO needs a long-running server, which serverless platforms can't keep open.

| Setting | Value |
|---------|-------|
| Build command | `npm install --include=dev && npm run build` |
| Start command | `npm start` |
| Health check | `/api/health` |

The free plan sleeps after 15 minutes without traffic, so the first request afterwards can take up to a minute. Every push to `main` redeploys automatically.

---

## 📂 Source Code Control

| Metric | Status |
|--------|--------|
| **Commits** | ✅ 70+ backend commits — API routes, role guards, Socket.IO rooms, order & payment flow, reservations, menu catalog |
| **Reliability** | ✅ 118 automated API checks passing — orders, payments, reservations, roles and notifications per panel |

---

## 📄 License

Copyright © 2026 **Savoria API**.
Developed by *Syed Ahmad Galib*

All schemas and architecture remain under educational distribution guidelines.

---

<div align="center">

**⚡ Built with Node.js, Express, MongoDB & Socket.IO — real-time by design.**

⭐ *Star this repo if you like the backend!*

</div>
