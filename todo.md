# Kiai Hub — Kendo Event Management Platform

> An all-in-one, free-to-use platform for organizing kendo events worldwide. Seminars, taikais, shinsa, and more — with built-in payments, brackets, match tracking, document generation, and dojo management.

---

## 1. Business Model

**Free to use. Revenue through payment processing only.**

| Fee Layer | Rate |
|-----------|------|
| Stripe base | 2.9% + $0.30 per transaction |
| Platform fee (Kiai Hub) | +2.0% |
| **Total to registrant** | **4.9% + $0.30** |
| International cards | +1.5% |
| Currency conversion | +1–2% |

### Payout Flow

```
Registrant pays $100
  → Stripe takes $3.20 (2.9% + $0.30)
  → Kiai Hub takes $2.00 (2%)
  → $94.80 available for payout
  → Platform initiates payout to dojo's configured Zelle/PayPal
```

**Implementation**: Since Stripe Connect doesn't natively support Zelle/PayPal disbursement, funds collect in the platform Stripe account and a scheduled job triggers payouts via:
- PayPal Payouts API (for dojos choosing PayPal)
- For Zelle: transfer to the dojo's linked bank (Zelle is bank-to-bank)

**Simpler v1**: Use Stripe Connect Express where each dojo connects their own Stripe account. Platform takes its 2% via `application_fee_amount`. Dojos withdraw from Stripe to their own bank. Add alternative payout methods in v2.

---

## 2. Architecture Overview

### Monorepo Structure

```
kiai-hub/
├── apps/
│   ├── web/                    # Next.js (Cloudflare Workers via @opennextjs/cloudflare)
│   └── api/                    # ElysiaJS (Cloudflare Workers)
├── packages/
│   ├── db/                     # Drizzle ORM schemas, migrations, seed
│   ├── storage/                # Abstract S3-compatible storage (R2 / GitForge-ready)
│   ├── auth/                   # Better Auth config, shared types
│   ├── shared/                 # Shared types, constants, validators (zod)
│   └── email/                  # Resend templates & service
├── workers/
│   └── cron/                   # Scheduled workers (payouts, reminders)
├── drizzle/
├── turbo.json
└── package.json
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) on Cloudflare Workers via `@opennextjs/cloudflare` |
| Backend API | ElysiaJS on Cloudflare Workers |
| Database | Neon Postgres (`@neondatabase/serverless`) |
| ORM | Drizzle ORM |
| Object Storage | Cloudflare R2 (via abstract S3-compatible layer) |
| Auth | Better Auth (email/password + OAuth) |
| Payments | Stripe Connect |
| Email | Resend |
| Document Signing | DocuSeal (self-hosted or cloud API) |
| PDF Generation | `pdf-lib` (Workers-compatible) |
| Monorepo | Turborepo |

### Abstract Storage Layer (GitForge-Ready)

```typescript
// packages/storage/src/interface.ts
export interface StorageProvider {
  put(key: string, data: Buffer | ReadableStream, metadata?: Record<string, string>): Promise<void>;
  get(key: string): Promise<{ data: ReadableStream; metadata: Record<string, string> } | null>;
  delete(key: string): Promise<void>;
  list(prefix: string, options?: ListOptions): Promise<ListResult>;
  getSignedUrl(key: string, expiresIn: number): Promise<string>;
}
```

---

## 3. Multi-Tenant Data Model

### Core Concept

```
Account (person)
  └── belongs to many → Dojos (tenant)
        └── has many → Events (taikai, seminar, shinsa)
              └── has many → Registrations, Brackets, Matches
```

### Role Hierarchy

| Role | Capabilities |
|------|-------------|
| **Owner** | Full control. Create/delete events. Manage billing/payout. Invite/remove members. Transfer ownership. One per dojo. |
| **Admin** | Create/manage events. View submissions, registrations, finances. Manage brackets. Cannot delete dojo or change payout. |
| **Volunteer** | Access bracket/match tracking only. Fill in scores, hansoku, winners. Cannot see financials or edit events. |

### Ownership Transfer

```
Owner clicks "Transfer Ownership" → selects Admin
  → Admin receives email
  → Accept → they become Owner, previous Owner → Admin
  → Decline → nothing changes
  → Pending transfer can be cancelled by current Owner
```

---

## 4. Database Schema (Drizzle ORM)

### Auth & Tenancy

- [ ] `users` — id, name, email, emailVerified, image, dateOfBirth, phone, emergencyContact, kendoRank, yearsExperience, federation, timestamps
- [ ] `dojos` — id, name, slug (unique), description, logoKey, federation, address/city/state/country, timezone, website, contactEmail, payoutMethod, payoutEmail, stripeConnectId, timestamps
- [ ] `dojoMembers` — id, dojoId, userId, role (owner/admin/volunteer), invitedBy, inviteStatus, timestamps; unique(dojoId, userId)
- [ ] `ownershipTransfers` — id, dojoId, fromUserId, toUserId, status, timestamps

### Events

- [ ] `events` — id, dojoId, name, slug, type (taikai/seminar/shinsa/gasshuku/practice/other), description, visibility, status (draft→published→registration_open→closed→in_progress→completed→cancelled), dates, venue fields, currency, registration flags (team/individual/minor/waiver), maxParticipants, bannerImageKey, rulesDocumentKey, rulesConfig (jsonb), customAssets (jsonb), timestamps; unique(dojoId, slug)
- [ ] `eventPricingTiers` — id, eventId, name, description, priceInCents, maxQuantity, applicableTo, earlyBirdPriceInCents, earlyBirdDeadline, sortOrder
- [ ] `customFormFields` — id, eventId, label, type (text/textarea/select/multiselect/checkbox/radio/date/file/number), options (jsonb), required, placeholder, helpText, validationRules (jsonb), sortOrder, section

### Registrations

- [ ] `teams` — id, eventId, name, captainUserId, dojoName, maxMembers, status (forming/confirmed/withdrawn), timestamps
- [ ] `registrations` — id, eventId, userId, registrationType (individual/team/minor), teamId, participant fields (name/email/dob/rank/federation/dojo), minor fields (guardian info), pricingTierId, payment fields (amountPaidInCents/stripePaymentIntentId/paymentStatus), waiver fields (waiverStatus/docusealSubmissionId), formResponses (jsonb), status (pending/confirmed/waitlisted/cancelled/checked_in), checkedInAt, timestamps

### Brackets & Matches

- [ ] `brackets` — id, eventId, name, type (individual/team), format (single_elimination/double_elimination/round_robin/kachinuki/pool_to_elimination), eligibility filters (age/rank/gender), match rules (duration/extensions/ipponToWin/hansokuLimit/encho/hantei), kachinuki config, status, seedMethod, bracketData (jsonb), timestamps
- [ ] `bracketEntries` — id, bracketId, registrationId, teamId, seedNumber, poolNumber, eliminated, finalPlacement
- [ ] `matches` — id, bracketId, roundNumber, matchNumber, courtNumber, player1/player2 entry+fighter ids, winnerEntryId, winMethod, status, scheduledTime, startedAt, completedAt, nextMatchId, nextMatchSlot, notes, timestamps
- [ ] `matchPoints` — id, matchId, scoringEntryId, scoringFighterId, pointType (men/kote/do/tsuki/hansoku), isHansoku, hansokuAgainstEntryId, timeRemainingSeconds, isEncho, pointOrder, recordedBy, timestamps

### Documents & Assets

- [ ] `documents` — id, dojoId, eventId, name, type (rules/waiver/certificate/roster/bracket_sheet/logo/custom), storageKey, mimeType, sizeBytes, uploadedBy, isTemplate, timestamps
- [ ] `platformAssets` — id, name, category (logo/header/border/icon/template), storageKey, thumbnailKey, mimeType, tags (jsonb)
- [ ] `waiverTemplates` — id, dojoId, eventId, name, docusealTemplateId, storageKey, isDefault, timestamps

---

## 5. API Routes (ElysiaJS)

- [ ] `POST/GET /api/auth/*` — Better Auth handlers
- [ ] `GET /api/users/me` — Get current user profile
- [ ] `PATCH /api/users/me` — Update current user profile
- [ ] **Dojos**
  - [ ] `POST /api/dojos` — Create dojo
  - [ ] `GET /api/dojos` — List user's dojos
  - [ ] `GET /api/dojos/:id` — Get dojo details
  - [ ] `PATCH /api/dojos/:id` — Update dojo
  - [ ] `DELETE /api/dojos/:id` — Delete dojo (owner only)
  - [ ] `POST /api/dojos/:id/invite` — Invite member
  - [ ] `GET /api/dojos/:id/members` — List members
  - [ ] `PATCH /api/dojos/:id/members/:memberId` — Update member role
  - [ ] `DELETE /api/dojos/:id/members/:memberId` — Remove member
  - [ ] `POST /api/dojos/:id/transfer-ownership` — Initiate ownership transfer
- [ ] **Events**
  - [ ] `POST /api/events` — Create event
  - [ ] `GET /api/events` — List events (public discovery + dojo-scoped)
  - [ ] `GET /api/events/:id` — Get event details
  - [ ] `PATCH /api/events/:id` — Update event
  - [ ] `DELETE /api/events/:id` — Delete event
  - [ ] `POST /api/events/:id/publish` — Publish event
  - [ ] `GET /api/events/:id/dashboard` — Event dashboard stats
  - [ ] `GET /api/events/:id/registrations` — List event registrations
  - [ ] **Custom Forms**: CRUD for `customFormFields`
  - [ ] **Pricing**: CRUD for `eventPricingTiers`
  - [ ] `POST /api/events/:id/assets/upload` — Upload event assets
- [ ] **Registrations**
  - [ ] `POST /api/registrations/individual` — Register individual
  - [ ] `POST /api/registrations/team` — Register team
  - [ ] `POST /api/registrations/minor` — Register minor
  - [ ] `POST /api/registrations/team/:teamId/join` — Join existing team
  - [ ] `GET /api/registrations/:id` — Get registration details
  - [ ] `PATCH /api/registrations/:id` — Update registration
  - [ ] `POST /api/registrations/:id/check-in` — Check in participant
- [ ] **Payments**
  - [ ] `POST /api/payments/create-intent` — Create Stripe PaymentIntent
  - [ ] `POST /api/payments/webhook` — Stripe webhook handler
  - [ ] `GET /api/payments/receipt/:id` — Get payment receipt
- [ ] **Waivers**
  - [ ] `POST /api/waivers/send` — Send waiver via DocuSeal
  - [ ] `POST /api/waivers/webhook` — DocuSeal webhook handler
  - [ ] `GET /api/waivers/:registrationId/status` — Check waiver status
- [ ] **Brackets**
  - [ ] `POST /api/brackets` — Create bracket
  - [ ] `GET /api/brackets/:id` — Get bracket details
  - [ ] `PATCH /api/brackets/:id` — Update bracket
  - [ ] `DELETE /api/brackets/:id` — Delete bracket
  - [ ] `POST /api/brackets/:id/seed` — Seed bracket
  - [ ] `POST /api/brackets/:id/generate` — Generate matches
  - [ ] `GET /api/brackets/:id/matches` — List bracket matches
  - [ ] `GET /api/brackets/:id/standings` — Get standings
- [ ] **Matches**
  - [ ] `GET /api/matches/:id` — Get match details
  - [ ] `POST /api/matches/:id/start` — Start match
  - [ ] `POST /api/matches/:id/score` — Record score point
  - [ ] `POST /api/matches/:id/undo-score` — Undo last score
  - [ ] `POST /api/matches/:id/complete` — Complete match
- [ ] **Documents**
  - [ ] `POST /api/documents/generate-rules-pdf` — Generate rules PDF
  - [ ] `POST /api/documents/generate-bracket-pdf` — Generate bracket PDF
  - [ ] `GET /api/documents/platform-assets` — List platform assets
- [ ] **Admin**
  - [ ] `GET /api/admin/analytics` — Platform analytics
  - [ ] `GET /api/admin/payouts` — Payout management

---

## 6. Key Features

### 6.1 Volunteer Scoring Interface

Mobile-first, one screen per court:
- Tap score → "Who scored?" → player 1 or 2
- Hansoku → "Who committed?" → opponent gets point
- Auto-detects win (2 ippon, or 2 hansoku = ippon for opponent)
- Auto-advances winner in bracket
- Undo support
- Timer display

### 6.2 Bracket Engine

- [ ] `generateSingleElimination(entries)` — Powers of 2, byes
- [ ] `generateKachinuki(teamEntries)` — Winner stays, next opponent enters
- [ ] `generateRoundRobin(entries)` — All pairings, standings by W > ippon diff > H2H
- [ ] `generatePoolToElimination(entries, poolCount, advanceCount)` — Pools → top N → SE

### 6.3 Payment (Stripe Connect)

- [ ] Dojo onboarding — Stripe Connect Express account creation
- [ ] Payment intent creation with 2% `application_fee_amount`
- [ ] Webhook handling for payment status updates
- [ ] Receipt generation

### 6.4 DocuSeal Waivers

- [ ] Template management
- [ ] Submission creation with pre-filled fields
- [ ] Webhook for signed status updates
- [ ] Minor/guardian waiver flow

### 6.5 PDF Generation

- [ ] Generate from structured rules config with dojo logo/branding
- [ ] Upload custom PDF (still must configure rules in platform for match enforcement)
- [ ] Bracket sheet generation

---

## 7. Frontend Pages

### Public

- [ ] `/` — Landing page + event discovery
- [ ] `/events/[slug]` — Event detail + register CTA
- [ ] `/events/[slug]/register/` — Individual, team, minor registration flows
- [ ] `/auth/` — Sign in / sign up

### Dashboard

- [ ] `/dashboard` — Overview
- [ ] `/dojos/[dojoId]/settings` — Dojo settings
- [ ] `/dojos/[dojoId]/members` — Member management
- [ ] `/dojos/[dojoId]/events/[eventId]` — Event dashboard
- [ ] `/dojos/[dojoId]/events/[eventId]/forms` — Custom form builder
- [ ] `/dojos/[dojoId]/events/[eventId]/pricing` — Pricing tiers
- [ ] `/dojos/[dojoId]/events/[eventId]/registrations` — Registration list
- [ ] `/dojos/[dojoId]/events/[eventId]/waivers` — Waiver tracking
- [ ] `/dojos/[dojoId]/events/[eventId]/brackets/[bracketId]` — Bracket view + seeding
- [ ] `/dojos/[dojoId]/events/[eventId]/matches` — Match schedule + live tracking
- [ ] `/dojos/[dojoId]/events/[eventId]/documents` — Rules PDF, assets
- [ ] `/dojos/[dojoId]/events/[eventId]/results` — Final standings

### Volunteer

- [ ] `/score/[matchId]` — Mobile scoring interface

### Spectator

- [ ] `/live/[eventId]` — Public live brackets

---

## 8. Real-Time Strategy

- [ ] **v1**: Polling every 3-5s (simple, reliable)
- [ ] **v2**: Cloudflare Durable Objects + WebSockets per event

---

## 9. Email Templates (Resend)

- [ ] Welcome
- [ ] Dojo invitation
- [ ] Ownership transfer request
- [ ] Registration confirmed
- [ ] Payment receipt
- [ ] Waiver sent
- [ ] Waiver completed
- [ ] Event reminder (1 week)
- [ ] Event reminder (1 day)
- [ ] Bracket assignment notification
- [ ] Event results + certificates

---

## 10. Implementation Phases

### Phase 1: Foundation (Weeks 1–4)
- [ ] Monorepo setup (Turborepo, shared configs)
- [ ] Database package (Drizzle schemas, migrations, Neon connection)
- [ ] Auth package (Better Auth — email/password + OAuth)
- [ ] Storage abstraction package
- [ ] API app (ElysiaJS on Workers)
- [ ] Web app (Next.js 15 on Workers via @opennextjs/cloudflare)
- [ ] Dojo CRUD
- [ ] RBAC middleware (owner/admin/volunteer)
- [ ] Member invite/management
- [ ] Ownership transfer flow

### Phase 2: Events & Registration (Weeks 5–8)
- [ ] Event CRUD + wizard UI
- [ ] Custom form builder
- [ ] Pricing tier management
- [ ] Individual registration flow
- [ ] Team registration flow
- [ ] Minor registration flow (guardian)
- [ ] Stripe Connect dojo onboarding
- [ ] Payment processing
- [ ] Registration confirmation emails
- [ ] Payment receipt emails

### Phase 3: Waivers & Documents (Weeks 9–10)
- [ ] DocuSeal integration
- [ ] Waiver template management
- [ ] Waiver sending + tracking
- [ ] PDF rules generation (pdf-lib)
- [ ] Asset uploads (R2)
- [ ] Platform asset library

### Phase 4: Brackets (Weeks 11–14)
- [ ] Bracket creation + eligibility filters
- [ ] Single elimination generation
- [ ] Round robin generation
- [ ] Kachinuki generation
- [ ] Pool-to-elimination generation
- [ ] Seeding (manual, random, by rank, by region)
- [ ] Bracket visualization UI
- [ ] Bracket PDF export

### Phase 5: Live Matches (Weeks 15–18)
- [ ] Volunteer scoring interface (mobile-first)
- [ ] Ippon/hansoku/encho/hantei scoring
- [ ] Undo support
- [ ] Auto-win detection
- [ ] Auto-advance in bracket
- [ ] Kachinuki match flow
- [ ] Live bracket view (spectator)
- [ ] Polling-based updates (v1)

### Phase 6: Polish & Launch (Weeks 19–22)
- [ ] Event discovery / search
- [ ] Analytics dashboard
- [ ] Payout management + cron worker
- [ ] Results & certificates
- [ ] Cron reminders (1wk, 1d)
- [ ] Mobile pass / QR check-in
- [ ] Landing page

### Phase 7: Post-Launch (Ongoing)
- [ ] Durable Objects real-time (v2)
- [ ] Shinsa module
- [ ] Seminar module
- [ ] GitForge storage provider
- [ ] i18n (Japanese, Korean, etc.)
- [ ] Public API
- [ ] SSO (federation-level auth)

---

## 11. Environment Variables

```env
DATABASE_URL=postgresql://...@neon.tech/kiai_hub?sslmode=require
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=https://api.kiaihub.com
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PLATFORM_FEE_PERCENT=2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=kiai-hub-assets
RESEND_API_KEY=
DOCUSEAL_API_URL=https://api.docuseal.co
DOCUSEAL_API_KEY=
NEXT_PUBLIC_APP_URL=https://kiaihub.com
API_URL=https://api.kiaihub.com
```

---

## 12. Architectural Decisions

- **Cloudflare Workers**: Zero cold starts, global edge (kendo is international), R2 without egress fees, Durable Objects for future real-time
- **ElysiaJS**: End-to-end type safety with Eden Treaty, excellent Workers support, pairs well with Drizzle's type inference
- **Abstract storage**: R2 default, GitForge can slot in as provider for regulated federations
- **Stripe Connect Express**: Handles KYC/1099s; Zelle/PayPal disbursement is v2
- **Free model**: Kendo is niche with small margins. Free removes adoption friction. 2% payment fee scales with usage ($50 x 200 person tournament = $200 platform revenue)
