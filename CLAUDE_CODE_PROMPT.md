# CLAUDE CODE MASTER PROMPT — CATERHUB

You are the lead full-stack engineer responsible for building **CaterHub**, a competition-ready web application described in `CATERHUB_CONTEXT.md`.

## Your role

Act as:
- Senior full-stack engineer
- Product engineer
- UI/UX-minded frontend engineer
- Database architect
- Security-conscious backend engineer

Your objective is to build a **working, polished MVP**, not just generate mock screens.

---

# 1. FIRST: READ THE SOURCE OF TRUTH

Before writing code:

1. Read `CATERHUB_CONTEXT.md` completely.
2. Treat it as the primary product specification.
3. Inspect the existing repository structure before making assumptions.
4. Determine whether a project already exists.
5. Reuse existing working configuration when sensible.
6. Do not overwrite working code blindly.

If the repository is empty, initialize the project according to the technical stack below.

---

# 2. TECH STACK

Use:

- Next.js
- TypeScript
- App Router
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- Auth.js or an appropriate robust Next.js authentication implementation
- Zod
- React Hook Form
- Recharts where analytics are needed

Prefer a monolithic Next.js application for this competition.

Do NOT create microservices.

The application must run locally with a straightforward setup.

---

# 3. LANGUAGE AND REGION

Application language:
**Bahasa Indonesia**

Currency:
**IDR / Rupiah**

Timezone:
**Asia/Jakarta**

Use Indonesian terminology consistently in UI.

Examples:
- Pesanan
- Acara
- Vendor
- Paket
- Penawaran
- Kapasitas
- Pembayaran
- Status
- Profil
- Dashboard

---

# 4. PRODUCT SUMMARY

CaterHub is a marketplace and operational platform for catering SMEs.

Customer:
- creates an event
- searches catering
- checks availability
- customizes menus
- requests quotation
- accepts quotation
- books vendor
- pays through QRIS
- tracks booking

Vendor:
- manages business profile
- manages menus/packages
- receives quotation requests
- creates quotations
- manages bookings
- manages capacity
- manages calendar
- sees analytics

Admin:
- verifies vendors
- manages users
- monitors transactions/orders
- sees platform metrics

The key differentiator is:

> **Event-based catering marketplace + vendor operational management.**

Do not turn the application into a generic food delivery app.

---

# 5. CORE USER FLOW

The primary demo must work end-to-end:

Customer:
1. Register/login.
2. Create event.
3. Enter:
   - event type
   - date
   - time
   - location
   - guest count
   - budget
4. See matching vendors.
5. Filter/search.
6. Open vendor profile.
7. Select/customize package.
8. Submit quotation request.
9. Vendor receives request.
10. Vendor creates quotation.
11. Customer accepts quotation.
12. System re-checks capacity.
13. Booking is created.
14. Customer pays deposit/full amount through QRIS.
15. Payment status updates.
16. Customer sees booking status.
17. Vendor dashboard updates.

This flow is more important than optional features.

---

# 6. DEVELOPMENT STRATEGY

Implement in phases.

## Phase 1 — Foundation

Set up:
- Next.js
- TypeScript
- Tailwind
- Prisma
- PostgreSQL
- Environment configuration
- Database schema
- Seed data
- Authentication
- Role-based authorization

Do not proceed with a broken foundation.

## Phase 2 — Vendor

Build:
- vendor onboarding/profile
- menu CRUD
- package CRUD
- availability/capacity management
- vendor dashboard

## Phase 3 — Customer marketplace

Build:
- landing page
- event creation
- catering search
- filters
- vendor profile
- package selection
- menu customization

## Phase 4 — Quotation and booking

Build:
- quotation request
- vendor quotation creation
- quotation revision
- accept/reject
- booking
- capacity revalidation
- status management

## Phase 5 — Payment

Implement QRIS payment integration.

Use a payment abstraction:

```ts
interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  handleWebhook(input: unknown): Promise<WebhookResult>;
}
```

Keep provider-specific implementation isolated.

A reasonable candidate is Midtrans if its current QRIS API and sandbox are available.

Do not hard-code provider assumptions into booking/business logic.

Use environment variables for credentials.

Never expose secrets in client-side code.

Implement webhook idempotency.

If live/sandbox provider access cannot be used locally, keep a clearly isolated mock adapter so development can continue.

## Phase 6 — Analytics/recommendation

Build:
- vendor KPIs
- capacity utilization
- popular packages
- revenue summaries
- recommendation scoring

Do not add complex AI unless the core product is stable.

## Phase 7 — Polish

Improve:
- responsive behavior
- loading states
- empty states
- error states
- form validation
- accessibility
- visual hierarchy
- animations only where useful
- demo data

---

# 7. DATABASE

Use Prisma with PostgreSQL.

Implement the entities described in `CATERHUB_CONTEXT.md`, including:

- User
- VendorProfile
- Event
- MenuItem
- Package
- PackageItem
- Availability
- Quotation
- QuotationItem
- Booking
- Payment
- Review
- Notification

You may add supporting entities when necessary.

Use proper:
- relations
- indexes
- unique constraints
- enums
- timestamps
- cascading behavior where appropriate

Think carefully about historical data.

For example, a confirmed quotation must retain the prices that existed at confirmation time.

Do not calculate historical booking totals from mutable current menu prices.

---

# 8. BUSINESS RULES

Implement server-side enforcement for:

- Customer can only access own resources.
- Vendor can only access own resources.
- Admin has elevated access.
- Only verified vendors can receive bookings.
- Vendor cannot book itself.
- Capacity cannot be exceeded.
- Capacity must be rechecked at booking confirmation.
- Quotation total must be calculated server-side.
- Client-provided prices must never be trusted.
- Payment webhook must be idempotent.
- Duplicate payment notifications must not duplicate business state.
- Historical quotation/booking pricing must remain stable.
- Booking/payment status transitions must be validated.

Do not rely on hiding buttons in the UI as authorization.

---

# 9. CAPACITY MODEL

This is a core feature.

Example:

Vendor daily capacity:
500 pax

Existing confirmed bookings:
450 pax

Remaining:
50 pax

If a customer requests 100 pax:
- show insufficient capacity
- do not allow confirmation
- optionally recommend another vendor

Capacity should be calculated reliably.

Consider concurrent bookings and use a database transaction/locking strategy appropriate for PostgreSQL/Prisma.

Do not implement a naive client-side check only.

---

# 10. QUOTATION SYSTEM

Quotation supports:

- subtotal
- delivery fee
- service fee
- discount
- total
- notes
- expiration date
- itemized quotation lines

Customer can:
- accept
- reject
- request revision

Vendor can:
- create
- edit before acceptance
- resend/revise

Once accepted, preserve the accepted quotation values.

---

# 11. PAYMENT

QRIS is required.

Do not integrate multiple banks/e-wallets individually.

Use one payment provider with QRIS support.

Architecture:

```text
Booking
  ↓
Payment Service
  ↓
Payment Provider
  ↓
QRIS
  ↓
Webhook
  ↓
Payment record
  ↓
Booking status
```

Requirements:
- payment creation
- payment reference
- QR/checkout presentation
- payment status
- webhook
- idempotency
- error handling

Use sandbox/test mode for development when available.

Do not fake a successful payment in the normal flow.

A mock adapter may exist only as a development fallback.

---

# 12. RECOMMENDATION

Build recommendation using normal application logic first.

Input:
- event date
- event type
- guest count
- budget
- location
- cuisine
- availability

Score candidates based on:
- date availability
- capacity fit
- budget fit
- location/delivery
- cuisine match
- rating

Then show:

> Rekomendasi untuk acara Anda

If an LLM is added, keep it optional and isolated.

Do not make the application dependent on an LLM for core functionality.

---

# 13. UI/UX

Create a polished startup-style UI.

Design principles:
- modern
- clean
- professional
- warm food/catering feel
- responsive
- strong typography
- good whitespace
- clear CTA
- subtle animations
- excellent empty/loading/error states

Do NOT:
- use generic Bootstrap styling
- overuse gradients
- overuse glassmorphism
- overuse rounded cards
- create dashboard-card soup
- make every section animated

Customer experience should feel like a modern marketplace.

Vendor experience should feel like a modern SaaS dashboard.

---

# 14. REQUIRED PAGES

Public:
- `/`
- `/catering`
- `/catering/[vendorId]`
- `/login`
- `/register`

Customer:
- `/dashboard`
- `/events`
- `/events/new`
- `/events/[id]`
- `/quotations/[id]`
- `/bookings/[id]`
- `/payments/[id]`
- `/profile`

Vendor:
- `/vendor/dashboard`
- `/vendor/menu`
- `/vendor/packages`
- `/vendor/orders`
- `/vendor/quotations`
- `/vendor/calendar`
- `/vendor/capacity`
- `/vendor/analytics`
- `/vendor/profile`

Admin:
- `/admin/dashboard`
- `/admin/vendors`
- `/admin/users`
- `/admin/orders`

You may restructure routes if it produces a cleaner architecture.

---

# 15. LANDING PAGE

The landing page should communicate the product immediately.

Hero concept:

> **Temukan Catering yang Tepat untuk Acara Anda**

Supporting copy:

> Cari, bandingkan, sesuaikan, dan pesan catering dalam satu platform.

Primary CTA:
> Buat Acara

Secondary CTA:
> Jelajahi Catering

Show:
- event search
- popular categories
- selected vendors
- how it works
- vendor/SME value proposition

Do not make unsupported claims.

---

# 16. CUSTOMER MARKETPLACE

Provide:
- search
- filters
- sorting
- vendor cards
- rating
- starting price
- availability indicator
- cuisine/category
- service options

Important:
Availability should reflect the selected event date and guest count when possible.

---

# 17. VENDOR PROFILE

Show:
- business name
- description
- rating
- location
- packages
- menu
- services
- minimum pax
- maximum pax
- availability

CTA:
> Pilih Paket

or:

> Minta Penawaran

---

# 18. VENDOR DASHBOARD

Show useful KPIs:

- Pendapatan
- Pesanan
- Acara Mendatang
- Penawaran Menunggu
- Pax Terpesan
- Utilisasi Kapasitas

Also show:
- upcoming events
- pending quotations
- recent orders

Avoid meaningless vanity metrics.

---

# 19. ADMIN

Keep admin simple.

Implement:
- dashboard
- vendor verification
- user list
- order monitoring

Do not spend most development time on admin.

---

# 20. SEED DATA

Create realistic Indonesian demo data.

Vendors:
- Dapur Nusantara
- Rasa Prima Catering
- Sajian Kita
- Pawon Ibu
- Kitchen 88

Cities:
- Surabaya
- Sidoarjo
- Gresik

Event types:
- Wedding
- Birthday
- Corporate
- Meeting
- Seminar
- Gathering

Use realistic IDR pricing.

Create enough bookings/events/quotations to make dashboards look meaningful.

Provide clearly documented demo accounts if appropriate.

Never put real secrets in seed files.

---

# 21. ERROR HANDLING

Every important operation needs:
- validation
- loading state
- error state
- success feedback

Use clear Indonesian messages.

Examples:

> Data acara berhasil disimpan.

> Kapasitas vendor tidak mencukupi untuk jumlah pax yang dipilih.

> Penawaran berhasil dikirim.

> Pembayaran sedang menunggu konfirmasi.

Do not expose stack traces to users.

---

# 22. SECURITY

At minimum:
- server-side authorization
- input validation
- Zod
- safe database queries through Prisma
- secret environment variables
- webhook verification
- idempotency
- no sensitive payment credentials
- no secret API keys in client bundle
- secure authentication/session handling

Review all server actions/API routes for authorization.

---

# 23. CODE QUALITY

Prefer:
- small reusable components
- clear naming
- typed data
- service modules
- reusable UI components
- server-side business logic
- minimal duplication

Do not create unnecessary abstractions.

Do not use `any` unless there is a compelling reason.

Keep the project understandable for a student competition team.

---

# 24. TESTING

At minimum test critical business logic:

- authentication/authorization
- quotation total calculation
- capacity calculation
- overbooking prevention
- booking creation
- payment webhook idempotency
- role access

If test infrastructure is practical, use appropriate unit/integration testing.

Do not spend excessive time on low-value test coverage before the core product works.

---

# 25. DEVELOPMENT RULES

Before implementing:
1. Inspect repository.
2. Check package manager.
3. Check existing environment.
4. Check existing dependencies.
5. Preserve useful existing work.

When making changes:
- Prefer incremental implementation.
- Keep the app runnable.
- Run type checking/lint/build after meaningful milestones.
- Fix errors rather than ignoring them.
- Do not leave obvious TODOs in core flows.

When a requirement is ambiguous:
- Prefer the simplest implementation consistent with the product context.
- Do not introduce another external service unless necessary.
- Do not ask the user unnecessary questions if a reasonable engineering decision can be made.

---

# 26. PRIORITY ORDER

If time is limited, prioritize:

### P0
- App runs
- Auth
- Roles
- Database
- Vendor
- Marketplace
- Event
- Quotation
- Booking
- Capacity

### P1
- QRIS payment
- Vendor dashboard
- Customer dashboard
- Calendar

### P2
- Recommendation
- Analytics
- Reviews
- Notifications

### P3
- Inventory
- Production planning
- AI insights
- Advanced admin

Never sacrifice P0 to implement P3.

---

# 27. FINAL DEMO REQUIREMENT

The final app must support this story:

> "Saya punya acara pernikahan 250 orang di Surabaya pada 15 Oktober. Budget saya Rp7–10 juta."

Then demonstrate:

1. Create event.
2. Find matching catering.
3. Filter by availability.
4. Open vendor.
5. Customize package.
6. Request quotation.
7. Switch to vendor account.
8. Vendor sees request.
9. Vendor creates quotation.
10. Switch back to customer.
11. Accept quotation.
12. Capacity is rechecked.
13. Booking is created.
14. Customer pays via QRIS.
15. Payment status updates.
16. Vendor dashboard reflects the booking.
17. Vendor capacity/calendar changes.
18. Show analytics.

This is the core competition narrative.

---

# 28. BEFORE CODING

First inspect the repository and report briefly:

- current project state
- existing stack
- what can be reused
- what needs to be created
- any blocking issue

Then begin implementation.

Do not spend the entire session only planning. Once the repository is understood, start building.

---

# 29. DEFINITION OF DONE

The project is considered competition-ready when:

- Core flow works end-to-end.
- Customer and vendor roles work correctly.
- Database persists real data.
- Capacity prevents overbooking.
- Quotation workflow works.
- Booking workflow works.
- QRIS payment flow is integrated or the provider sandbox is demonstrably wired.
- Dashboards show real database-derived data.
- Responsive UI works.
- No obvious TypeScript/build errors.
- Demo seed data exists.
- Environment setup is documented.
- No secrets are committed.
- README contains setup/run instructions.

Build the product with the mindset:

> **A coherent, polished competition MVP is better than a huge unfinished system.**
