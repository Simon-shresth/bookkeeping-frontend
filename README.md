# Ledger — Frontend

React (Vite) + Material UI frontend for the bookkeeping system, calling the
Phase 1 backend API. This is **Phase 2** of the production build.

## What's here

- **Auth**: Supabase email/password sign-in (`src/pages/Login.jsx`,
  `src/context/AuthContext.jsx`). Every API call attaches the current
  Supabase session token (`src/lib/api.js`).
- **Pages**, one per module: Dashboard, Chart of Accounts (read-only),
  Journal Entries (with inline "+ New Account"), General Ledger, Customers,
  Suppliers, Products, Sales, Purchases, Expenses, Reports.
- **Role-aware UI**: write actions (Add/Edit/Delete buttons, "New Entry")
  only render for `manager` role or above; the same rule is enforced again
  server-side, so hiding a button here is a UX nicety, not the security
  boundary.
- Data fetching/caching via `@tanstack/react-query`; every mutation
  invalidates the relevant queries so lists refresh automatically.

## Local setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Configure environment**
   ```
   cp .env.example .env
   ```
   - `VITE_API_URL` — your backend's URL + `/api` (e.g. `http://localhost:4000/api` locally,
     or `https://your-backend.onrender.com/api` once deployed).
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — from the **same** Supabase project
     the backend uses (Project Settings → API). Use the **anon/public** key here, never the
     service role key — this runs in the browser.

3. **Make sure the backend is running** (see the backend's own README —
   migrated, with at least one company bootstrapped).

4. **Run it**
   ```
   npm run dev
   ```
   Visit `http://localhost:5173`, sign in with the account you bootstrapped
   as admin.

## Deploying (Vercel)

1. Push this folder to a GitHub repo (can be the same repo as the backend, in
   a `frontend/` subfolder, or its own repo).
2. Vercel Dashboard → Add New → Project → import the repo.
3. Framework preset: Vite (auto-detected). Add the three environment
   variables from your `.env` in Vercel's project settings.
4. Deploy. You'll get a `https://your-app.vercel.app` URL.
5. Go back to the **backend's** `CORS_ORIGIN` environment variable on Render
   and set it to this exact Vercel URL, then redeploy the backend — otherwise
   the browser will block requests to the API.

## Authentication (Phase 3)

- **Create a company** (`/signup`): someone signs up with a company name,
  email, and password and becomes that company's admin. If your Supabase
  project requires email confirmation (the default), they confirm via email
  and then sign in — the company is created automatically on that first
  login. (The company name is held in `localStorage` in the meantime.)
- **Invite teammates** (`/users`, admins only): enter an email and a role;
  they get an email with a link to choose a password, and their access is
  ready as soon as they do. Admins can change anyone's role or deactivate
  them at any time (but not their own — there must always be an active admin).
- **Forgot password** (`/forgot-password` → `/reset-password`): standard
  Supabase email-link flow. The same `/reset-password` page is where invited
  teammates set their first password.

**Supabase dashboard settings to check** (Authentication → URL Configuration):
set **Site URL** to your deployed frontend URL, and add
`http://localhost:5173/reset-password` and your production
`/reset-password` URL to **Redirect URLs** — otherwise reset and invite
links will be rejected.

## What's new in this round of changes

- **Nepali number formatting** throughout — `src/components/Money.jsx` now
  groups digits lakh/crore style (e.g. Rs. 12,34,567.89).
- **Sales and Purchases support multiple products per invoice** — add/remove
  product rows in the invoice dialog; each shows its unit of measurement.
- **Products have a unit of measurement** (pcs, kg, ltr, box, or custom).
- **Sales gained Cash Sale and Discount** — a cash sale skips the credit
  workflow entirely; discount reduces the total and is shown as its own line.
- **Search in Sales/Purchases** now only runs when you press Enter or click
  Search, not on every keystroke.
- **The app no longer refetches everything when you switch back to the tab**
  — data now only reloads when something you did actually changed it.
- **General Ledger** has From/Till date filters and a "Download PDF" button.

## What's new in Phase 4

- **Payments** page — record and edit money received/paid outside of
  invoicing, filterable by direction.
- **Sales** — a PDF icon on each row downloads a printable invoice
  (authenticated download via a Blob, since a plain link can't send the auth header).
- **Bank Reconciliation** page — pick a bank account and statement date, tick
  off what's on the statement, and finish once the difference reads exactly
  0.00. History shows past reconciliations; only the most recent one per
  account can be undone.
- **Audit Log** page (admin only) — filterable, paginated history of who
  changed what, with before/after values on edits.
- **Reports** — AR/AP aging now shows age buckets (Current, 1-30, 31-60, 61+)
  and reflects payments recorded separately from invoices.

## What's next (Phase 5)

Production polish: PDF invoice generation, bank reconciliation, an audit-log
viewer, standalone customer/supplier payments (collecting on credit sales
later), and backups/monitoring.
