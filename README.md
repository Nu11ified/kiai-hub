# Kiai Hub

A free-to-use kendo tournament (taikai) management platform. Handles everything from event registration and waiver signing to bracket generation, live scoring, and shinpan rotation.

Built for the kendo community — dojos can create events, manage registrations, run brackets across multiple courts, and stream live results to spectators.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + pnpm workspaces |
| API | ElysiaJS on Cloudflare Workers |
| Web | Next.js 15 (App Router) on Cloudflare Pages via OpenNext |
| Database | Neon Postgres + Drizzle ORM |
| Auth | Better Auth |
| Payments | Stripe Connect |
| Waivers | DocuSeal |
| Storage | Cloudflare R2 (S3-compatible) |
| Email | Resend |
| PDF | pdf-lib (Workers-compatible, no native deps) |

## Project Structure

```
kiai-hub/
├── apps/
│   ├── api/          # ElysiaJS API (Cloudflare Workers)
│   └── web/          # Next.js 15 frontend
├── packages/
│   ├── auth/         # Better Auth configuration
│   ├── db/           # Drizzle ORM schema & migrations
│   ├── email/        # Email templates (Resend)
│   ├── shared/       # Validators, constants, bracket engine
│   └── storage/      # R2 storage provider
```

## Features

### Event Management
- Dojo creation with role-based access (owner, admin, member)
- Event setup with custom forms, pricing tiers, and public registration pages
- Registration tracking with payment status

### Waivers & Documents
- DocuSeal integration for digital waiver signing (adult + minor/guardian flows)
- Webhook-driven status updates when waivers are signed
- PDF generation for tournament rules and bracket sheets
- Document uploads to R2 with signed download URLs

### Tournament Engine
The bracket engine lives in `packages/shared` as pure functions — no database dependency, testable in isolation, reusable client-side.

**Bracket Formats:**
- **Single Elimination** — standard seeded bracket with configurable bye selection (random, by rank, or by age/seniority) and optional 3rd place match
- **Round Robin** — circle method scheduling with multi-pool support and FIK tiebreak standings (wins > ippon differential > head-to-head > hantei)
- **Kachinuki** — team format where the winner stays on. Lineup positions: senpo, jiho, chuken, fukusho, taisho. Only the first bout is predetermined; subsequent bouts are determined dynamically as winners advance
- **Pool to Elimination** — round robin pools followed by a seeded single elimination bracket from pool standings

**Court & Shinpan Management:**
- Courts are event-level (shared across brackets)
- Automatic match-to-court assignment with round-robin distribution
- Shinpan (judge) rotation to prevent fatigue bias — configurable rotation interval, shushin/fukushin roles

### Live Scoring
- Mobile-first scoring interface with large tap targets for men, kote, do, tsuki
- Hansoku tracking with automatic ippon award (2 hansoku = 1 ippon for opponent)
- Encho (overtime) toggle
- Hantei (judge decision) for tiebreaks
- Auto-win detection and bracket advancement
- Undo support

### Spectator View
- Dark-themed live bracket display at `/live/[eventId]`
- Auto-refreshing (5s polling)
- In-progress matches highlighted with LIVE badge
- Court assignments shown per match

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9.15+

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Fill in your Neon, Stripe, DocuSeal, R2, and Resend credentials

# Push database schema
pnpm db:push

# Start development servers
pnpm dev
```

The API runs on `http://localhost:3001` and the web app on `http://localhost:3000`.

### Environment Variables

See `.env.example` for the full list. Key services:

| Variable | Service | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | Neon | Postgres connection string |
| `BETTER_AUTH_SECRET` | Better Auth | Session signing key |
| `STRIPE_SECRET_KEY` | Stripe | Payment processing |
| `DOCUSEAL_API_KEY` | DocuSeal | Waiver signing |
| `R2_*` | Cloudflare R2 | Document storage |
| `RESEND_API_KEY` | Resend | Transactional email |

## Kendo-Specific Design Decisions

- **Bye selection respects kendo conventions**: higher-ranked competitors (by dan/kyu) or older competitors (senpai) can receive byes, not just random assignment
- **FIK tiebreak chain**: round robin standings follow the Federation Internationale de Kendo rules — wins first, then ippon differential, then head-to-head record, then hantei wins
- **Kachinuki is dynamic**: the "winner stays" mechanic means bouts after the first are generated on-the-fly based on match results, not pre-determined
- **Shinpan rotation**: judges rotate across courts at configurable intervals to prevent fatigue and bias — a real concern in multi-hour tournaments
- **Rank awareness**: the system understands kendo ranks (6-kyu through 8-dan) for seeding and bye selection

## License

MIT
