# ✈️ TripNest

<div align="center">

### Plan together. Travel smarter. Remember everything.

A collaborative travel-planning platform that brings trip planning, places,
itineraries, expenses, budgets, maps, weather, notifications, memories,
and AI assistance into one workspace.

[![Live Demo](https://img.shields.io/badge/🌍%20Live%20Demo-TripNest-e76f51?style=for-the-badge)](https://trip-nest-eight-pied.vercel.app/)
[![Backend](https://img.shields.io/badge/⚡%20Backend-Render-46a758?style=for-the-badge)](https://tripnest-zytu.onrender.com/)
[![GitHub](https://img.shields.io/badge/💻%20Source-GitHub-181717?style=for-the-badge&logo=github)](https://github.com/Meenu-Pandey/TripNest)

</div>

---

## 🌍 What is TripNest?

Planning a group trip often means switching between maps, notes,
messaging apps, spreadsheets, weather apps, and expense trackers.

**TripNest brings these workflows together into one trip-centered
workspace.**

With TripNest, groups can:

- Create and manage trips
- Invite members and manage roles
- Build collaborative itineraries
- Discover and save places
- Track and split group expenses
- See who owes whom
- Record settlements
- Manage trip budgets
- Explore destinations on an interactive map
- Check weather
- Receive recommendations
- Get AI-assisted planning suggestions
- Store trip memories
- Receive activity notifications

---

## ✨ Features

### 🧭 Trip Management

- Trip creation and editing
- Member invitations
- Role-based permissions
- Ownership management
- Trip activity history
- Trip cancellation/completion

### 🗓️ Itinerary

- Date and time-based activities
- Saved-place integration
- Reordering
- Chronological timeline
- Responsive mobile experience

### 📍 Places & Explore

- Save and manage places
- Geocoding
- Nearby POI discovery
- Category-based exploration
- Distance calculations
- Interactive map integration
- Geoapify-powered destination discovery

### 💰 Expenses

Supports four splitting strategies:

- Equal
- Exact
- Percentage
- Shares

Additional features:

- Expense editing/deletion
- Multiple participants
- Automatic balance calculation
- Idempotent expense creation

### 💳 Balances & Settlements

- See who owes whom
- Automatic balance calculation
- Settlement suggestions
- Payment recording
- Settlement confirmation
- Financial history

### 💵 Budget

- Trip budget
- Budget categories
- Planned spending
- Actual spending
- Remaining budget
- Spending progress
- Over-budget indicators

### 🌤️ Travel Utilities

- Destination weather
- Saved-place weather
- Multi-day forecasts
- Maps and routing
- Nearby destination discovery

### 🤖 AI Trip Copilot

- Trip summaries
- Itinerary suggestions
- Place suggestions
- Budget guidance
- Context-aware assistance
- Markdown responses
- Verified-data context
- Graceful unavailable-state handling

### 📸 Memories

- Photo uploads
- Captions
- Favorites
- Gallery
- Lightbox viewing
- Permission-aware deletion

### 🔔 Notifications

- Trip activity notifications
- Expense notifications
- Member activity
- Read/unread state
- Notification center
- Email invitations

---

## 🏗️ Architecture

```text
                    ┌───────────────────────┐
                    │      TripNest UI      │
                    │   React + TypeScript  │
                    └───────────┬───────────┘
                                │
                              HTTPS
                                │
                                ▼
                    ┌───────────────────────┐
                    │     Express API       │
                    │   Node + TypeScript   │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
       ┌────────────┐    ┌────────────┐    ┌──────────────┐
       │ PostgreSQL │    │  Socket.IO │    │ External APIs│
       │   Prisma   │    │  Realtime  │    │              │
       └────────────┘    └────────────┘    └──────┬───────┘
                                                   │
                         ┌─────────────────────────┼──────────────┐
                         │                         │              │
                         ▼                         ▼              ▼
                    Geoapify                 Open-Meteo      Maps/Routing
```

---

## 🧠 Engineering Highlights

### Deterministic Money Handling

Financial values are stored using **integer minor units** rather than
floating-point numbers.

```text
₹1,250.50
    ↓
125050 minor units
    ↓
BigInt arithmetic
    ↓
Deterministic calculations
```

This is used across expenses, splits, balances, settlements, and budgets.

### Backend as the Source of Truth

Security-sensitive and financial decisions are handled on the backend.

```text
React
  ↓
Express API
  ↓
Validation
  ↓
Business Logic
  ↓
Prisma
  ↓
PostgreSQL
```

The frontend does not independently determine permissions, balances,
settlement state, or financial calculations.

### Provider-Based External Integrations

External services are isolated behind backend provider abstractions.

```text
Explore
   ↓
DiscoveryService
   ↓
PoiDiscoveryProvider
   ↓
Geoapify
```

This keeps external API failures from leaking directly into the
frontend architecture.

### AI With Guardrails

AI acts as an assistant rather than an autonomous database actor.

```text
Trip Context
     ↓
AI Request
     ↓
AI Proposal
     ↓
User Review
     ↓
Backend Validation
     ↓
Database
```

### Security

TripNest includes:

- Argon2id password hashing
- JWT authentication
- Rate limiting
- Helmet security headers
- CORS configuration
- Zod validation
- RBAC
- IDOR protection
- Secure invitation tokens
- Upload validation
- Path traversal protection
- Idempotency for critical operations

---

## 🛠️ Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| React | UI |
| TypeScript | Type safety |
| Vite | Build tooling |
| React Router | Routing |
| TanStack Query | Server state |
| React Hook Form | Forms |
| Zod | Validation |
| Tailwind CSS | Styling |
| MapLibre GL JS | Maps |
| Socket.IO Client | Realtime |

### Backend

| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| Express | REST API |
| TypeScript | Type safety |
| Prisma | ORM |
| PostgreSQL | Database |
| JWT | Authentication |
| Argon2id | Password hashing |
| Zod | Validation |
| Socket.IO | Realtime |
| Multer | File uploads |
| Pino | Logging |
| Helmet | Security |

### Infrastructure

| Service | Purpose |
|---|---|
| Vercel | Frontend deployment |
| Render | Backend deployment |
| Supabase | PostgreSQL |
| Docker | Local infrastructure |

### External Services

| Service | Purpose |
|---|---|
| Geoapify | POI discovery |
| OpenStreetMap | Geographic data |
| OpenFreeMap | Map tiles |
| Nominatim | Geocoding |
| OSRM | Routing |
| Open-Meteo | Weather |
| Ollama / configured AI provider | AI assistance |

---

## 📁 Project Structure

```text
TripNest/
│
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── providers/
│   ├── tests/
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   └── pages/
│   └── package.json
│
├── puppeteer_qa/
├── DEPLOYMENT.md
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 22+
- npm
- Docker
- Git
- PostgreSQL

### Clone

```bash
git clone https://github.com/Meenu-Pandey/TripNest.git
cd TripNest
```

### Start PostgreSQL

```bash
docker compose up -d postgres
```

### Backend

```bash
cd backend
npm ci
npx prisma generate
npx prisma migrate dev
npm run dev
```

Backend:

```text
http://localhost:4000
```

Health:

```text
http://localhost:4000/health
```

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

Frontend:

```text
http://localhost:3000
```

### Environment

Create `backend/.env` from:

```text
backend/.env.example
```

Required secrets and provider keys should remain server-side.

**Never commit `.env` files or API keys.**

---

## 🧪 Testing

TripNest has unit, integration, component, and E2E coverage.

### Backend

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

### Frontend

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

### Final Verification

Latest full audit:

- Backend unit: **383/383 passed**
- Backend integration: **217/217 passed**
- Frontend tests: **188/188 passed**
- Backend typecheck: **PASS**
- Frontend typecheck: **PASS**
- Backend lint: **PASS**
- Frontend lint: **PASS**
- Backend build: **PASS**
- Frontend build: **PASS**
- Local E2E journey: **PASS**
- Production E2E: **PASS**
- Security/IDOR audit: **PASS**
- Production Geoapify discovery: **PASS**
- Production financial verification: **PASS**

---

## 🌍 Production

```text
Frontend → Vercel
Backend  → Render
Database → Supabase PostgreSQL
```

### Live Application

🌐 **Frontend**

https://trip-nest-eight-pied.vercel.app/

⚡ **Backend**

https://tripnest-zytu.onrender.com/

❤️ **Health**

https://tripnest-zytu.onrender.com/health

---

## 🔌 API

TripNest exposes a versioned REST API:

```text
/api/v1
```

Main resources include:

```text
/auth
/users
/trips
/invites
/places
/itinerary
/expenses
/balances
/settlements
/budget
/weather
/geocoding
/recommendations
/notifications
/memories
```

The frontend communicates with the TripNest backend through a centralized
API layer rather than directly calling third-party services.

---

## 👩‍💻 Author

### Meenu Pandey
[LinkedIn](https://linkedin.com/in/mpandey4/)

<div align="center">

### ✈️ TripNest

**Plan together. Travel smarter. Remember everything.**

[🌍 Live Demo](https://trip-nest-eight-pied.vercel.app/) ·
[💻 GitHub](https://github.com/Meenu-Pandey/TripNest)

</div>
