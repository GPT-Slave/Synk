<div align="center">
  <img src="./apps/web/public/logo_nobg.png" alt="Synk logo" width="112" />

  # SYNK

  **Find time. Together.**

  A realtime, link-first meeting planner that turns scattered availability into one clear decision.

  ![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs)
  ![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=for-the-badge&logo=nestjs)
  ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
  ![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-010101?style=for-the-badge&logo=socketdotio)

  `15-minute precision` · `No participant accounts` · `Realtime heatmaps` · `PWA-ready`
</div>

---

## The idea

Most scheduling tools force everyone into an account, a calendar integration, or a long email thread. Synk keeps the flow lightweight:

1. An organizer creates a meeting window.
2. Synk generates a hard-to-guess invitation link.
3. Participants enter a unique display name and paint their availability—no account required.
4. The organizer sees overlap update live, compares the strongest time windows, and confirms the final slot.

## Experience

- **Quarter-hour scheduling** with independent 15-minute cells.
- **Realtime collaboration** through Socket.IO updates.
- **Availability heatmaps** with participant-level visibility.
- **Best-time suggestions** calculated across the full meeting duration.
- **Organizer controls** for locking, reopening, editing, finalizing, and deleting meetings.
- **Participant privacy** through scoped session tokens and invitation links.
- **Responsive interface** with light mode, dark mode, RTL support, and multiple languages.
- **Installable PWA** with cache-aware branding and mobile-friendly interactions.
- **Autosave protection** with throttling, retry backoff, and differential persistence.

## System architecture

```mermaid
flowchart LR
    U[Organizer / Participant] --> W[Next.js Web App]
    W <-->|REST + secure cookies| A[NestJS API]
    W <-->|Socket.IO| A
    A <-->|Prisma| D[(PostgreSQL)]

    subgraph Monorepo
      W
      A
      T[Shared TypeScript Types]
    end

    T --> W
    T --> A
```

## Technology constellation

| Layer | Technology |
| --- | --- |
| Web | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion |
| Data fetching | TanStack Query |
| API | NestJS 11, REST, Socket.IO |
| Database | PostgreSQL, Prisma ORM, Prisma PostgreSQL adapter |
| Authentication | JWT access and rotating refresh tokens in secure HTTP-only cookies |
| Request security | Signed double-submit CSRF tokens, strict CORS, Helmet, rate limiting |
| Workspace | pnpm monorepo with shared TypeScript contracts |

## Repository map

```text
Synk/
├─ apps/
│  ├─ web/                 Next.js frontend and PWA
│  └─ api/                 NestJS API, Prisma schema, migrations, WebSockets
├─ packages/
│  └─ shared-types/        Contracts shared by web and API
├─ scripts/                Local launcher, load tests, and security checks
├─ PERFORMANCE.md          Performance strategy and test notes
└─ package.json            Workspace commands
```

## Launch locally

### Requirements

- Node.js `22.22.x`
- pnpm `10.15.0`
- PostgreSQL 16+

### Fast path on Windows

```powershell
corepack enable
pnpm install

Copy-Item apps\api\.env.example apps\api\.env

pnpm synk
```

The launcher checks prerequisites, prepares PostgreSQL, applies migrations, and starts:

```text
Web  → http://localhost:3000
API  → http://localhost:4000
```

### Manual path

Create `apps/api/.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/meetplanner?schema=public"
DIRECT_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/meetplanner?schema=public"
PORT=4000

JWT_SECRET="replace-with-a-unique-secret-of-at-least-32-characters"
JWT_REFRESH_SECRET="replace-with-another-unique-secret-of-at-least-32-characters"
CSRF_SECRET="replace-with-a-third-unique-secret-of-at-least-32-characters"

JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL="7d"
CORS_ORIGIN="http://localhost:3000"
COOKIE_SECURE="false"
TRUST_PROXY="false"
BCRYPT_ROUNDS=12
```

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

Then run:

```powershell
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev:api
```

In another terminal:

```powershell
pnpm dev:web
```

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm synk` | Prepare and launch the local stack on Windows |
| `pnpm dev:web` | Start the Next.js app with Webpack |
| `pnpm dev:web:turbopack` | Start the optional Turbopack development mode |
| `pnpm dev:api` | Start the NestJS API in watch mode |
| `pnpm prisma:generate` | Generate the Prisma client |
| `pnpm prisma:migrate` | Create/apply development migrations |
| `pnpm prisma:studio` | Inspect data with Prisma Studio |
| `pnpm build` | Build the web and API applications |
| `pnpm lint` | Run workspace linting |
| `pnpm performance:load` | Run the meeting load scenario |
| `pnpm security:audit` | Run the project security audit script |

## Deployment matrix

Synk can run on free tiers for low-traffic personal use:

| Component | Suggested host | Required configuration |
| --- | --- | --- |
| Web | Vercel | Root directory: `apps/web` |
| API + Socket.IO | Render Web Service | Root directory empty; workspace build and start commands |
| PostgreSQL | Neon | Pooled runtime URL plus direct migration URL |

### Production API variables

```env
NODE_ENV=production
DATABASE_URL=<pooled-postgresql-url>
DIRECT_DATABASE_URL=<direct-postgresql-url>
CORS_ORIGIN=https://your-synk-site.vercel.app
COOKIE_SECURE=true
TRUST_PROXY=true
BCRYPT_ROUNDS=12
```

Use unique values of at least 32 characters for `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `CSRF_SECRET`.

### Render commands

```bash
# Build
corepack enable && pnpm install --frozen-lockfile && pnpm --filter api exec prisma generate --config prisma.config.ts && pnpm --filter api build

# Start
pnpm --filter api start:prod
```

The production start command applies pending Prisma migrations before launching NestJS.

## Security model

- Organizer sessions use short-lived access tokens and rotating refresh tokens.
- Production cookies are `Secure`, `SameSite=None`, and partitioned for cross-site hosting.
- Mutating requests require a signed CSRF cookie/header pair.
- CORS accepts explicit origins only and supports credentialed requests.
- Participant sessions are scoped to individual invitations and responses.
- Global read/write buckets and authentication-specific limits reduce abuse.
- Security headers are applied with Helmet and production HTTPS is enforced behind trusted proxies.

## Product principle

> Scheduling should feel like selecting time—not negotiating infrastructure.

Synk is designed to disappear behind the decision: share one link, collect the signal, confirm the moment.
