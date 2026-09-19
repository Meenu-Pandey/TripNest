# ✈️ TripNest

<div align="center">

### Plan together. Travel smarter. Remember everything.

A collaborative travel-planning platform that brings **itineraries, places, expenses, budgets, maps, weather, recommendations, notifications, memories, and AI assistance** into one trip-centered workspace.

<br>

[![Live Demo](https://img.shields.io/badge/🌍%20Live%20Demo-TripNest-e76f51?style=for-the-badge)](https://trip-nest-eight-pied.vercel.app/)
[![Backend API](https://img.shields.io/badge/⚡%20Backend-Render-46a758?style=for-the-badge)](https://tripnest-zytu.onrender.com/)
[![GitHub](https://img.shields.io/badge/💻%20Source-GitHub-181717?style=for-the-badge&logo=github)](https://github.com/Meenu-Pandey/TripNest)

<br>

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-4-000000?style=flat-square&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=flat-square&logo=prisma&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![MapLibre](https://img.shields.io/badge/MapLibre-GL-396CB2?style=flat-square)

</div>

---

## 🌍 What is TripNest?

Planning a group trip usually means jumping between multiple applications:

**WhatsApp → Google Maps → Notes → Spreadsheets → Expense Apps → Weather Apps**

TripNest brings these workflows together in a single collaborative workspace.

With TripNest, a group can:

- Create and manage trips
- Invite travel companions
- Build shared itineraries
- Save and discover places
- Track group expenses
- Split expenses in multiple ways
- See who owes whom
- Manage settlements
- Plan budgets
- Explore destinations on an interactive map
- Check weather
- Receive recommendations
- Get AI-assisted planning suggestions
- Share trip memories
- Receive activity notifications

---

# ✨ Core Features

<table>
<tr>
<td width="50%">

## 🧭 Trip Planning

- Create trips
- Edit trip details
- Manage trip members
- Role-based permissions
- Invitation system
- Trip activity history
- Trip completion workflow

</td>

<td width="50%">

## 🗓️ Itinerary

- Create itinerary items
- Assign dates and times
- Attach saved places
- Reorder activities
- Chronological organization
- Mobile-friendly timeline
- Persistent backend state

</td>
</tr>

<tr>
<td width="50%">

## 📍 Places & Discovery

- Save places
- Edit and delete places
- Geocoding
- Coordinates
- Place categories
- Nearby discovery
- Recommendation engine
- Map integration

</td>

<td width="50%">

## 🗺️ Interactive Maps

- MapLibre GL JS
- OpenFreeMap
- OpenStreetMap data
- Saved-place markers
- Marker selection
- Distance calculations
- Fit-to-places
- Responsive map workspace

</td>
</tr>

<tr>
<td width="50%">

## 💰 Group Expenses

Supports:

- Equal splitting
- Exact amounts
- Percentage splitting
- Share-based splitting
- Expense editing
- Expense deletion
- Payment tracking
- Idempotent creation

</td>

<td width="50%">

## 💳 Balances & Settlements

- Automatic balance calculation
- Who owes whom
- Settlement suggestions
- Payment state tracking
- Repayment recording
- Cash confirmation
- Payment workflow
- Financial audit trail

</td>
</tr>

<tr>
<td width="50%">

## 💵 Budget Planning

- Trip budget target
- Budget categories
- Planned spending
- Actual spending
- Remaining budget
- Per-person estimates
- Progress tracking
- Over-budget indicators

</td>

<td width="50%">

## 🌤️ Weather

- Destination weather
- Saved-place weather
- Current conditions
- Multi-day forecast
- Weather icons
- Graceful external API failures
- Backend-proxied requests

</td>
</tr>

<tr>
<td width="50%">

## 🤖 AI Trip Copilot

- Trip summaries
- Itinerary suggestions
- Place suggestions
- Budget guidance
- Context-aware assistance
- Markdown responses
- Verified-data context
- Offline/unavailable handling

</td>

<td width="50%">

## 📸 Memories

- Trip completion
- Photo uploads
- Captions
- Favorite photos
- Gallery
- Lightbox viewing
- Permission-aware deletion
- Photo limits

</td>
</tr>

<tr>
<td width="50%">

## 🔔 Notifications

- Member joined
- Expense added
- Activity notifications
- Read/unread state
- Notification center
- Email invitation support

</td>

<td width="50%">

## 🔐 Security

- Argon2id password hashing
- JWT authentication
- Rate limiting
- Helmet
- Zod validation
- RBAC
- IDOR protection
- Secure invitation tokens
- Upload validation
- Path traversal protection

</td>
</tr>
</table>

---

# 🧠 Engineering Highlights

TripNest was built as a full-stack engineering project rather than a frontend-only prototype.

## 💰 Financially Safe Money Handling

Money is represented using **integer minor units** instead of floating-point values.

```text
₹1,250.50
     ↓
125050 minor units
     ↓
BigInt arithmetic
     ↓
Deterministic financial calculations
```

This approach is used across expenses, splits, balances, settlements, and budget calculations.

---

## 🏛️ Backend-Authoritative Architecture

Financial and security-sensitive decisions remain on the backend.

The frontend does not independently determine:

- User permissions
- Expense ownership
- Balances
- Settlement state
- Financial calculations
- Trip membership
- Access control

Instead:

```text
React Frontend
      │
      ▼
Express API
      │
      ▼
Business Logic
      │
      ▼
Prisma
      │
      ▼
PostgreSQL
```

---

## 🤖 AI With Guardrails

TripNest's AI is designed as an assistant rather than an autonomous database actor.

```text
User
 │
 ▼
Trip Context
 │
 ▼
AI Request
 │
 ▼
AI Proposal
 │
 ▼
User Review
 │
 ▼
Backend Validation
 │
 ▼
Database
```

AI suggestions are not intended to silently modify trip data.

The AI context distinguishes between:

- Verified application data
- Unavailable external data
- Model-generated suggestions

---

## 🔐 Security-Oriented Design

TripNest includes multiple layers of protection:

- Argon2id password hashing
- JWT authentication
- Password reset tokens
- Rate limiting
- Helmet security headers
- CORS configuration
- Zod request validation
- Role-based access control
- IDOR protection
- Secure invitation tokens
- Upload MIME/type validation
- File-size restrictions
- Path traversal protection
- Idempotency for critical operations

---

# 🏗️ Architecture

```text
                         ┌──────────────────────┐
                         │      TripNest UI     │
                         │   React + TypeScript │
                         └──────────┬───────────┘
                                    │
                                  HTTPS
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │     Express API      │
                         │    Node + TypeScript │
                         └──────────┬───────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                  │                  │
                 ▼                  ▼                  ▼
          ┌─────────────┐    ┌─────────────┐    ┌──────────────┐
          │ PostgreSQL  │    │  Socket.IO  │    │ External APIs│
          │   Prisma    │    │   Realtime  │    │ Maps/Weather │
          └─────────────┘    └─────────────┘    └───────┬──────┘
                                                        │
                                                        ▼
                                                 ┌─────────────┐
                                                 │   Ollama    │
                                                 │  Local AI   │
                                                 └─────────────┘
```

---

# 🛠️ Technology Stack

## Frontend

| Technology | Purpose |
|---|---|
| React | UI |
| TypeScript | Type safety |
| Vite | Development & build |
| React Router | Routing |
| TanStack Query | Server state |
| React Hook Form | Forms |
| Zod | Validation |
| Tailwind CSS | Styling |
| Radix UI | Accessible components |
| Lucide | Icons |
| MapLibre GL JS | Maps |
| Socket.IO Client | Realtime |
| React Markdown | AI responses |

## Backend

| Technology | Purpose |
|---|---|
| Node.js 22 | Runtime |
| Express | API |
| TypeScript | Type safety |
| Prisma | ORM |
| PostgreSQL | Database |
| JWT | Authentication |
| Argon2id | Password hashing |
| Zod | Validation |
| Socket.IO | Realtime |
| Multer | Upload handling |
| Pino | Logging |
| Helmet | Security |
| Nodemailer | Email |

## Infrastructure

| Service | Purpose |
|---|---|
| Vercel | Frontend deployment |
| Render | Backend deployment |
| Supabase | PostgreSQL |
| Docker | Local infrastructure |

## External Services

| Service | Purpose |
|---|---|
| OpenStreetMap | Geographic data |
| OpenFreeMap | Map tiles |
| Nominatim | Geocoding |
| Overpass API | Place discovery |
| Open-Meteo | Weather |
| OSRM | Routing |
| Ollama | Local AI |

---

# 📦 Project Structure

```text
TripNest/
│
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   │
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── server.ts
│   │
│   ├── tests/
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/
│   │   └── types/
│   │
│   ├── public/
│   └── package.json
│
├── puppeteer_qa/
│   ├── scripts/
│   └── tests/
│
├── DEPLOYMENT.md
├── .gitignore
└── README.md
```

---

# 🧩 Core Domain

```text
Trip
 │
 ├── Members
 │    └── Invitations
 │
 ├── Places
 │
 ├── Itinerary
 │
 ├── Expenses
 │    ├── Equal
 │    ├── Exact
 │    ├── Percentage
 │    └── Shares
 │
 ├── Balances
 │
 ├── Settlements
 │
 ├── Budget
 │
 ├── Weather
 │
 ├── Recommendations
 │
 ├── Notifications
 │
 ├── Memories
 │
 └── AI Assistance
```

---

# 🚀 Getting Started

## Prerequisites

Make sure you have:

- Node.js 22+
- npm
- Docker
- Git
- PostgreSQL
- Ollama *(optional for AI features)*

---

## 1. Clone the Repository

```bash
git clone https://github.com/Meenu-Pandey/TripNest.git
cd TripNest
```

---

## 2. Start PostgreSQL

```bash
docker compose up -d postgres
```

Verify:

```bash
docker compose ps
```

---

## 3. Configure Backend

```bash
cd backend
```

Create your environment file:

```text
.env
```

Use:

```text
.env.example
```

as the template.

---

## 4. Install Backend Dependencies

```bash
npm ci
```

Generate Prisma Client:

```bash
npx prisma generate
```

Run migrations:

```bash
npx prisma migrate dev
```

Start the backend:

```bash
npm run dev
```

Backend:

```text
http://localhost:4000
```

Health check:

```text
http://localhost:4000/health
```

Readiness:

```text
http://localhost:4000/ready
```

---

## 5. Start Frontend

Open another terminal:

```bash
cd frontend
```

Install dependencies:

```bash
npm ci
```

Start Vite:

```bash
npm run dev
```

Frontend:

```text
http://localhost:3000
```

---

## 6. Optional: Local AI

Install Ollama and pull the configured model:

```bash
ollama pull llama3.2
```

Run:

```bash
ollama run llama3.2
```

TripNest can gracefully handle the AI service being unavailable.

---

# 🔐 Environment Variables

## Backend

Copy:

```text
backend/.env.example
```

to:

```text
backend/.env
```

Typical configuration includes:

```env
DATABASE_URL=
JWT_SECRET=
JWT_EXPIRES_IN=
NODE_ENV=
PORT=
CORS_ORIGIN=
APP_URL=

EMAIL_PROVIDER=
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=

UPLOADS_DIR=
OLLAMA_BASE_URL=
OLLAMA_MODEL=
```

## Frontend

```env
VITE_API_URL=http://localhost:4000
```

> ⚠️ Never commit `.env` files, passwords, JWT secrets, API keys, or SMTP credentials.

---

# 🧪 Testing

TripNest includes backend, frontend, integration, and browser-level testing.

## Backend

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

## Frontend

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

## Browser QA

Puppeteer-based QA covers important user workflows including:

- Authentication
- Trip creation
- Places
- Itinerary
- Maps
- Expenses
- Balances
- Settlements
- Budget
- Invitations
- Notifications
- Memories
- AI states
- Responsive layouts
- RBAC
- IDOR scenarios

---

# 🌍 Production Deployment

TripNest is deployed using:

```text
Frontend  → Vercel
Backend   → Render
Database  → Supabase PostgreSQL
Maps      → MapLibre + OpenFreeMap
Weather   → Open-Meteo
Geocoding → Nominatim
Routing   → OSRM
AI        → Ollama
```

## Live Application

### 🌐 Frontend

https://trip-nest-eight-pied.vercel.app/

### ⚡ Backend API

https://tripnest-zytu.onrender.com/

### ❤️ Health Check

https://tripnest-zytu.onrender.com/health

### 🟢 Readiness Check

https://tripnest-zytu.onrender.com/ready

---

# 📡 API Design

TripNest exposes a versioned REST API:

```text
/api/v1
```

Major resource groups include:

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
/discover
/notifications
/memories
```

The frontend communicates with the backend through a centralized API layer rather than making direct requests to third-party services.

---

# 💡 Product Principles

### 1. One Trip, One Workspace

The trip is the central product entity.

### 2. Backend Is the Source of Truth

Sensitive business logic stays on the server.

### 3. Money Must Be Deterministic

Financial calculations use integer minor units and BigInt arithmetic.

### 4. AI Should Assist, Not Silently Act

AI-generated suggestions remain reviewable.

### 5. External Services Can Fail

Weather, maps, geocoding, routing, and AI integrations are designed to degrade gracefully.

### 6. Collaboration Comes First

TripNest is designed around groups rather than individual travel planning.

---

# 🗺️ Roadmap

## Completed

- [x] Authentication
- [x] User profiles
- [x] Trip management
- [x] Invitations
- [x] Role-based access
- [x] Places
- [x] Geocoding
- [x] Itinerary
- [x] Expense splitting
- [x] Balances
- [x] Settlements
- [x] Budget planning
- [x] Weather
- [x] Recommendations
- [x] Map integration
- [x] Notifications
- [x] Memories
- [x] AI assistance
- [x] Production deployment

## Future Improvements

- [ ] Production object storage
- [ ] Expanded realtime coverage
- [ ] Richer recommendation models
- [ ] Advanced trip analytics
- [ ] Additional notification channels
- [ ] Custom domain
- [ ] Expanded observability
- [ ] More travel integrations

---

# 👩‍💻 About

Built by **Meenu Pandey**.

Computer Science & Engineering graduate focused on:

- Backend Development
- Full-Stack Development
- REST APIs
- Database Design
- AI-integrated Applications
- Secure Software Engineering

### Connect

[![GitHub](https://img.shields.io/badge/GitHub-Meenu--Pandey-181717?style=flat-square&logo=github)](https://github.com/Meenu-Pandey)

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Meenu%20Pandey-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://linkedin.com/in/mpandey4/)

---

<div align="center">

## ✈️ TripNest

### Plan together. Travel smarter. Remember everything.

[🌍 Live Demo](https://trip-nest-eight-pied.vercel.app/) •
[💻 GitHub](https://github.com/Meenu-Pandey/TripNest)

</div>
