# CaterHub — Product & Technical Context

## 1. Project Overview

**Working name:** CaterHub

**Category:** Web Developer Competition

**Competition theme:**
- Sub-theme: Accelerating Digital Transformation for Business and SMEs
- Industry focus: UMKM & Digital Economy
- Challenge: How can a web system help businesses/SMEs manage operational processes, improve productivity, and provide better customer service?

### Product concept

CaterHub is a marketplace and operational management platform specifically for catering SMEs.

It is NOT intended to be a generic food marketplace. The core concept is:

> Customers create an event and find catering vendors that match the event requirements. They can customize menus, request quotations, book a vendor, and pay via QRIS. Vendors can manage menus, quotations, orders, schedules, capacity, and basic operational information from one dashboard.

The product therefore has two connected value propositions:

1. **Customer side:** easier catering discovery and event-based ordering.
2. **SME/vendor side:** digitalize quotation, booking, capacity, scheduling, and order management.

The competition story should emphasize that the platform does not merely sell food; it digitizes a real catering business workflow.

---

## 2. Core Problem

Catering businesses often handle orders through fragmented channels such as WhatsApp, Instagram, phone calls, spreadsheets, and handwritten notes.

Typical problems:
- Customers have difficulty comparing catering packages.
- Catering requirements depend on event date, location, guest count, and budget.
- Large orders often require custom quotations.
- Vendors need to know whether they have enough production capacity on a particular date.
- Vendor schedules can become difficult to track.
- Order information can be scattered across conversations.
- Customer booking and payment status can be unclear.
- Vendors lack a centralized view of upcoming events and business performance.

CaterHub addresses these problems through one web platform.

---

## 3. Target Users

### Customer

A person or organization looking for catering for:
- Wedding
- Birthday
- Corporate event
- Meeting
- Seminar
- Gathering
- Graduation
- Community event
- Other private/public events

Customer goals:
- Find suitable vendors.
- Compare packages.
- Check availability.
- Customize menus.
- Request a quotation.
- Book catering.
- Pay a deposit/full amount via QRIS.
- Track booking status.

### Catering Vendor / UMKM

A small or medium catering business.

Vendor goals:
- Showcase catering packages.
- Receive potential customers.
- Manage menu/package information.
- Receive quotation requests.
- Create/send quotations.
- Manage confirmed orders.
- Manage event schedules.
- Manage daily/date-based catering capacity.
- Monitor business performance.

### Admin

Platform administrator.

Responsibilities:
- Manage users.
- Verify vendors.
- Manage categories.
- Monitor orders/transactions.
- Handle reports/disputes in a basic form.
- Monitor platform statistics.

---

## 4. Product Positioning

Do NOT position the product as:

> "Tokopedia for catering."

Position it as:

> "A digital catering marketplace and operations platform for catering SMEs."

The key differentiator is **event-based catering procurement + vendor operational management**.

---

## 5. Recommended MVP Scope

The MVP must be realistic for a competition and should prioritize a polished end-to-end demo over excessive features.

### Must-have features

1. Authentication
2. Role-based access:
   - Customer
   - Vendor
   - Admin
3. Customer event creation
4. Catering marketplace
5. Vendor profile
6. Menu/package management
7. Search and filtering
8. Date/event availability checking
9. Custom package/menu selection
10. Quotation request
11. Vendor quotation creation
12. Customer quotation approval/rejection/request revision
13. Booking
14. QRIS payment flow
15. Payment status
16. Customer booking/event dashboard
17. Vendor dashboard
18. Vendor order management
19. Vendor capacity management
20. Vendor calendar/schedule
21. Basic business analytics
22. Admin dashboard

### Differentiating features

Prioritize these:
- Event-based ordering
- Capacity management
- Smart catering recommendation
- Vendor operational dashboard
- Quotation workflow

### Features that may be added only if time allows

- Production planning
- Inventory integration
- AI-generated vendor business insights
- Customer reviews
- Notifications
- Promo/voucher system
- Advanced analytics

Do not sacrifice core workflow quality to implement all optional features.

---

## 6. End-to-End Customer Flow

### Flow A — Discovery

1. Customer opens landing page.
2. Customer enters event requirements:
   - Event type
   - Date
   - Location
   - Guest count
   - Budget
3. System shows matching catering vendors.
4. Customer filters/sorts results.
5. Customer opens vendor profile.

### Flow B — Package Selection

1. Customer selects a package.
2. Customer sees included menus/services.
3. Customer optionally customizes menu.
4. System calculates estimated total.

### Flow C — Quotation

If the package is fixed-price, customer can proceed toward booking.

If customization/special requirements are involved:
1. Customer submits quotation request.
2. Vendor receives request.
3. Vendor reviews requirements.
4. Vendor creates quotation.
5. Customer receives quotation.
6. Customer can:
   - Accept
   - Reject
   - Request revision

### Flow D — Booking

After quotation acceptance:
1. Booking is created.
2. System locks/rechecks vendor capacity.
3. Customer sees booking summary.
4. Customer chooses payment amount:
   - Full payment
   - Deposit (recommended default: 50%)
5. Customer proceeds to QRIS payment.

### Flow E — Payment

For competition MVP:
- Use a real QRIS-compatible payment gateway integration if practical.
- Avoid bank/e-wallet-specific integrations.
- Payment should be represented by a QRIS payment page/QR.
- Payment status must be stored and updated via the payment provider webhook when supported.
- Never store raw card/bank credentials.
- Keep payment abstraction isolated so the provider can be changed.

Recommended implementation direction:
- Use a single Indonesian payment provider that supports QRIS and has a developer/test/sandbox environment.
- Midtrans Snap/QRIS is a reasonable implementation candidate if its current API/product supports the desired QRIS flow and account access is available.
- Do not hard-code a provider into business logic. Create a payment service abstraction.

If a real QRIS API is unavailable during local development, include a clearly isolated mock/sandbox payment adapter for development/demo fallback. The production-oriented architecture must still be provider-agnostic.

### Flow F — After Booking

Customer can view:
- Event details
- Vendor
- Package/menu
- Quotation
- Payment status
- Booking status
- Event date
- Delivery information

Suggested booking statuses:

`QUOTATION_PENDING`
`QUOTATION_SENT`
`REVISION_REQUESTED`
`CONFIRMED`
`PAYMENT_PENDING`
`PAID`
`PREPARING`
`READY`
`DELIVERED`
`COMPLETED`
`CANCELLED`

---

## 7. Vendor Flow

### Vendor onboarding

1. Register vendor account.
2. Complete business profile.
3. Submit basic verification information.
4. Admin verifies vendor.
5. Vendor can publish packages.

### Vendor menu management

Vendor can:
- Create menu
- Edit menu
- Delete/archive menu
- Set price
- Set description
- Add image
- Set availability
- Group menus into packages
- Set add-ons

### Vendor package structure

Example:

**Nusantara Premium**
- Nasi putih
- Ayam bakar
- Beef teriyaki
- Capcay
- Pudding
- Iced tea
- Rp35,000/pax

Package can define:
- Minimum pax
- Maximum pax
- Base price
- Included menus
- Add-ons
- Service options
- Delivery options

### Vendor quotation management

Vendor receives:
- Customer
- Event
- Date
- Location
- Pax
- Budget
- Selected package
- Custom menu
- Special requests

Vendor can produce:
- Itemized quotation
- Subtotal
- Delivery fee
- Service fee
- Discount
- Total
- Notes
- Expiration date

### Vendor capacity management

This is one of the product's main differentiators.

Each vendor should define capacity by date or configurable period.

Example:

Maximum daily capacity: 500 pax

Confirmed bookings on Oct 15:
450 pax

Remaining capacity:
50 pax

The system must prevent or flag bookings that exceed available capacity.

Capacity should be revalidated during booking confirmation to reduce race-condition/overbooking risk.

### Vendor calendar

Display:
- Event date
- Event name
- Customer
- Guest count
- Location
- Booking status
- Estimated revenue

### Vendor dashboard

Suggested KPIs:
- Today's orders
- Upcoming events
- Revenue
- Confirmed pax
- Capacity utilization
- Pending quotations
- Popular package

---

## 8. Smart Recommendation

AI should NOT be a generic chatbot.

Recommended AI use:

Customer writes:

> "Saya butuh catering untuk acara kantor 120 orang, budget sekitar 5 juta, makanan Indonesia, tanggal 20 Oktober."

The system extracts structured requirements:

```text
eventType: CORPORATE
guestCount: 120
budgetMax: 5000000
cuisine: INDONESIAN
date: 2026-10-20
```

Then the normal application search engine finds matching vendors.

This keeps AI useful while avoiding unnecessary complexity.

If implementing external AI is too much for the MVP, use deterministic scoring first:

- Date availability
- Capacity fit
- Budget fit
- Location/delivery
- Cuisine/category
- Rating

The UI can still present it as "Recommended for your event" without pretending an LLM was used.

---

## 9. Business Insight (Optional)

If time allows, vendor dashboard can show simple insights:

> "Nusantara Premium generated 38% of your revenue this month."

> "Saturday capacity utilization increased 23% this month."

These can initially be calculated with normal SQL/TypeScript logic. AI-generated explanations are optional.

---

## 10. QRIS Payment

The product requires a real integration rather than a fake checkout.

Requirements:
- QRIS
- Sandbox/test environment where possible
- Payment order creation
- QR/checkout display
- Payment status
- Webhook handling
- Idempotent webhook processing
- Payment record linked to booking
- No storage of sensitive payment credentials

Use environment variables for provider credentials.

Example conceptual interface:

```ts
interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  handleWebhook(input: unknown): Promise<WebhookResult>;
}
```

Business logic should depend on `PaymentProvider`, not directly on a specific provider SDK.

---

## 11. Recommended Technical Stack

### Frontend + Backend

**Next.js + TypeScript**

Use Next.js App Router.

Why:
- One repository for frontend and backend.
- Easy deployment.
- TypeScript.
- Server-side rendering where useful.
- API routes/server actions.
- Fast competition development.

### Styling

**Tailwind CSS**

Use a component system where appropriate, but do not make the UI look like a generic template.

### Database

**PostgreSQL**

### ORM

**Prisma**

### Authentication

Use a robust Next.js-compatible authentication solution.

Preferred:
**Auth.js**

Use role-based authorization.

### Validation

**Zod**

### Forms

**React Hook Form + Zod**

### Charts

Use a lightweight chart library such as Recharts if needed.

### Maps

For MVP, use a lightweight map solution only if location visualization materially improves the product. Do not make maps a core dependency.

### Storage

For vendor/menu images, use an object storage/image service if available. Otherwise implement an abstraction and local development fallback.

### Deployment

Target:
- Vercel for Next.js
- Managed PostgreSQL such as Neon/Supabase/other compatible provider

The app should also work locally with PostgreSQL.

---

## 12. Architecture Principles

Keep the architecture simple.

Conceptual layers:

```text
UI
 ↓
Server Actions / API
 ↓
Application Services
 ↓
Prisma
 ↓
PostgreSQL
```

External services:

```text
Payment Provider (QRIS)
AI Provider (optional)
Image Storage (optional)
```

Important:
- Keep business logic out of UI components.
- Validate all user input server-side.
- Never trust client-side role checks.
- Enforce authorization on server.
- Use database transactions for critical booking/payment operations.
- Use idempotency for payment webhooks.
- Prevent vendor/customer cross-access.
- Never expose secret API keys to client-side code.

---

## 13. Core Data Model

Suggested entities:

### User
- id
- name
- email
- password/auth provider fields
- role
- createdAt
- updatedAt

Roles:
- CUSTOMER
- VENDOR
- ADMIN

### VendorProfile
- id
- userId
- businessName
- description
- phone
- address
- city
- latitude
- longitude
- verificationStatus
- rating
- createdAt
- updatedAt

### Event
- id
- customerId
- name
- eventType
- eventDate
- eventTime
- location
- guestCount
- budgetMin
- budgetMax
- notes
- status

### MenuItem
- id
- vendorId
- name
- description
- category
- price
- imageUrl
- isAvailable

### Package
- id
- vendorId
- name
- description
- pricePerPax
- minPax
- maxPax
- isActive

### PackageItem
- packageId
- menuItemId

### Availability
- id
- vendorId
- date
- maxPax
- reservedPax

### Quotation
- id
- eventId
- vendorId
- customerId
- status
- subtotal
- deliveryFee
- serviceFee
- discount
- total
- notes
- expiresAt

### QuotationItem
- quotationId
- name
- description
- quantity
- unitPrice
- subtotal

### Booking
- id
- eventId
- quotationId
- vendorId
- customerId
- status
- totalAmount
- depositAmount
- remainingAmount
- confirmedAt

### Payment
- id
- bookingId
- provider
- providerReference
- amount
- method
- status
- paidAt
- rawProviderStatus if needed for debugging, with care not to store secrets

### Review
- id
- bookingId
- customerId
- vendorId
- rating
- comment

### Notification
- id
- userId
- type
- title
- message
- readAt

Admin verification/report entities can be added if required.

---

## 14. Important Business Rules

1. Only verified vendors can publish/receive bookings.
2. A vendor cannot book itself.
3. Customer can only access its own events, quotations, bookings, and payments.
4. Vendor can only access its own menus, packages, availability, quotations, bookings, and analytics.
5. Admin can access platform management functions.
6. Booking must re-check availability before confirmation.
7. `reservedPax + requestedPax <= maxPax`.
8. Payment webhooks must be idempotent.
9. A successful payment must not create duplicate bookings.
10. Quotation totals must be calculated server-side.
11. Client-provided prices must never be trusted.
12. Archived menu/package items should not break historical quotations/bookings.
13. Historical booking prices must remain immutable after confirmation.
14. Currency is Indonesian Rupiah (IDR).
15. Default timezone is `Asia/Jakarta`.
16. UI language is Indonesian.

---

## 15. Main Pages

### Public
- `/`
- `/catering`
- `/catering/[vendorId]`
- `/login`
- `/register`

### Customer
- `/dashboard`
- `/events`
- `/events/new`
- `/events/[id]`
- `/quotations/[id]`
- `/bookings/[id]`
- `/payments/[id]`
- `/profile`

### Vendor
- `/vendor/dashboard`
- `/vendor/menu`
- `/vendor/packages`
- `/vendor/orders`
- `/vendor/quotations`
- `/vendor/calendar`
- `/vendor/capacity`
- `/vendor/analytics`
- `/vendor/profile`

### Admin
- `/admin/dashboard`
- `/admin/vendors`
- `/admin/users`
- `/admin/orders`
- `/admin/reports`

Routes may be reorganized if a better Next.js structure is used.

---

## 16. UI/UX Direction

Language:
**Bahasa Indonesia**

Visual direction:
- Modern
- Clean
- Professional
- Warm enough for food/catering
- Strong visual hierarchy
- Responsive
- Mobile-first for customer flow
- Desktop-optimized vendor dashboard

Avoid:
- Generic Bootstrap-looking UI
- Excessive gradients
- Excessive animations
- Overuse of glassmorphism
- Cluttered dashboards
- Too many cards
- Fake-looking AI features

Suggested design system:
- Neutral base
- One strong brand accent
- Clear success/warning/error states
- Rounded but not excessively rounded
- Good whitespace
- Strong typography

The landing page should feel like a real startup product, not a student CRUD project.

---

## 17. Competition Demo Scenario

Use one complete story.

### Customer

A customer needs:

> Wedding catering  
> 250 guests  
> Surabaya  
> 15 October 2026  
> Budget Rp7–10 million

Steps:
1. Create event.
2. See recommended vendors.
3. Filter by availability/budget.
4. Open vendor.
5. Customize package.
6. Request quotation.
7. Vendor receives request.
8. Vendor creates quotation.
9. Customer accepts.
10. System rechecks capacity.
11. Booking created.
12. Customer pays deposit through QRIS.
13. Customer sees confirmed booking.
14. Vendor dashboard updates:
    - Revenue
    - Event
    - Reserved capacity
    - Calendar

This should be the primary judging/demo path.

---

## 18. What Makes the Product Competitive

The strongest competition points are:

### 1. Event-first marketplace
The customer is not just buying a meal; they are solving an event catering requirement.

### 2. Real quotation workflow
Catering frequently requires custom pricing.

### 3. Capacity-aware marketplace
Availability is based on vendor production capacity, not simply "product in stock."

### 4. Marketplace + SME operations
The same system helps acquire customers and manage the vendor's operations.

### 5. Real payment integration
QRIS makes the booking flow more realistic.

### 6. Data-driven recommendations
Recommendations use event requirements, availability, capacity, budget, and vendor quality.

---

## 19. Non-Goals

Do NOT attempt these unless the core product is already stable:
- Full ERP
- Full accounting system
- Full payroll
- Full warehouse management
- Multi-country currency
- Complex logistics fleet management
- Multiple payment providers
- Multiple AI providers
- Social media integrations
- WhatsApp automation
- Complex microservices architecture

The competition MVP should remain focused.

---

## 20. Development Priorities

Priority 1:
- Authentication
- Roles
- Database
- Vendor profiles
- Menus/packages

Priority 2:
- Event creation
- Marketplace
- Search/filter
- Availability

Priority 3:
- Quotation workflow
- Booking
- Capacity management

Priority 4:
- QRIS
- Payment status/webhook

Priority 5:
- Dashboards
- Analytics
- Recommendation

Priority 6:
- UI polish
- Demo data
- Error/loading/empty states
- Responsive design
- Security review

---

## 21. Seed/Demo Data

The application should include realistic Indonesian demo data.

Example vendors:
- Dapur Nusantara
- Rasa Prima Catering
- Sajian Kita
- Pawon Ibu
- Kitchen 88

Example cities/areas:
- Surabaya
- Sidoarjo
- Gresik

Example event types:
- Wedding
- Birthday
- Corporate
- Meeting
- Seminar
- Gathering

Use realistic IDR prices.

Do not use fake statistics that are obviously exaggerated.

---

## 22. Quality Requirements

The application must:
- Build without TypeScript errors.
- Pass linting.
- Have no broken core routes.
- Have responsive layouts.
- Handle loading states.
- Handle empty states.
- Handle error states.
- Validate forms.
- Protect role-based routes.
- Protect server-side operations.
- Use transactions for critical operations.
- Avoid duplicate payment processing.
- Avoid overbooking.
- Use accessible form controls.
- Use semantic HTML where appropriate.

---

## 23. Development Philosophy

Build the smallest coherent product that tells a strong story.

Do not blindly implement every feature in this document.

When a feature conflicts with time or complexity:
1. Preserve the core customer-to-booking flow.
2. Preserve vendor capacity/quotation management.
3. Preserve payment.
4. Remove optional features before compromising core quality.

The application should feel like a coherent real product rather than a collection of disconnected demos.
