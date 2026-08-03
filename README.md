# Meet Planner (Calendra)

Availability-polling / scheduling app. No account required for participants;
organizers authenticate to create and manage meetings.

## Stack

- **Web**: Next.js, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, TanStack Query
- **API**: NestJS, Prisma, PostgreSQL, Socket.IO
- **Auth**: JWT + refresh tokens (organizer only)

## Structure

```
apps/
  web/              Next.js frontend
  api/               NestJS backend (REST + WebSocket gateway)
packages/
  shared-types/      Types shared between web and api
```

## Getting started (Windows)

```powershell
pnpm install

# copy env files and fill in secrets
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\web\.env.example apps\web\.env.local

# start postgres locally (Docker Desktop example)
docker run --name meetplanner-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16

# run migrations
pnpm prisma:migrate

# run dev servers (two terminals)
pnpm dev:api
pnpm dev:web
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev:web` | Start Next.js dev server |
| `pnpm dev:api` | Start NestJS dev server (watch mode) |
| `pnpm prisma:generate` | Generate Prisma client |
| `pnpm prisma:migrate` | Run dev migrations |
| `pnpm prisma:studio` | Open Prisma Studio |
| `pnpm build` | Build both apps |
