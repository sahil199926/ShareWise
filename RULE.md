# Expense Tracker — Development Rules

This document captures everything built in this project and the standards to follow going forward.
Cursor AI reads `.cursor/rules/expense-tracker.mdc` automatically.

---

## Design Principles

| #   | Principle              | What it means                                                                                     |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | **Responsive**         | Works flawlessly from mobile (320px) to TV (1920px+). Use Tailwind breakpoints and fluid layouts. |
| 2   | **Beautiful UI**       | Modern, clean, polished. Consistent spacing, typography, shadows, and indigo/slate palette.       |
| 3   | **Pixel perfect**      | Precise alignment, consistent 4px spacing scale, intentional hierarchy, no sloppy margins.        |
| 4   | **DB = Google Sheets** | Google Sheets is the only database. All data flows through Apps Script.                           |
| 5   | **Fun**                | Delightful UX — smooth transitions, friendly copy, enjoyable interactions.                        |

---

## What We Built

### Frontend (Vite + React + TypeScript)

- **Vite 8** with **React 19** and **TypeScript 6**
- **Tailwind CSS v4** for styling
- **ESLint** + **Prettier** for code quality
- **Axios** for HTTP requests
- **React Router DOM v7** with lazy-loaded pages

### Project Structure

```
src/
├── components/
│   ├── login/index.tsx          # Login page (validates against Sheets)
│   ├── dashboard/index.tsx      # Protected dashboard
│   ├── protected-route/         # Auth guard
│   └── lazy-fallback/           # Loading spinner for lazy routes
├── routes/
│   ├── index.tsx                # Route definitions
│   ├── lazy-pages.ts            # React.lazy() imports
│   └── lazy-route.tsx           # Suspense wrapper
├── layout/index.tsx             # Imports routes, renders via useRoutes()
├── context/
│   ├── auth-context.ts          # Context type
│   └── auth-provider.tsx        # Auth state + localStorage sync
├── hooks/use-auth.ts            # useAuth() hook
├── services/auth.service.ts     # loginWithSheet() business logic
├── lib/
│   ├── sheets-api.ts            # Central API — all Sheets calls go here
│   ├── storage.ts               # localStorage helpers
│   └── axios.ts                 # Axios instance
├── types/auth.ts                # User type
└── App.tsx                      # AuthProvider + BrowserRouter + Layout
```

### Auth Flow

1. User submits login form
2. `auth.service.ts` → `callSheetApi('login', { email, password })`
3. Apps Script reads **MASTER** sheet, validates credentials
4. On success → user saved to Context API + `localStorage`
5. Redirect to `/dashboard` (protected route)
6. On refresh → session restored from `localStorage`

### Routes

| Path         | Access    | Notes                                       |
| ------------ | --------- | ------------------------------------------- |
| `/`          | Public    | Redirects to `/dashboard`                   |
| `/login`     | Public    | Redirects to dashboard if already logged in |
| `/dashboard` | Protected | Requires auth                               |

### Backend (Google Apps Script)

- File: `google-apps-script/Code.gs`
- Spreadsheet: **Expence Tracker Live**
- Sheet: **MASTER** (columns: `USERS | EMAIL | PASSWORD`)
- Deployed as **Web App** (Execute as Me, Anyone can access)
- Action-based API: `{ action: 'login', email, password }`
- Env var: `VITE_SHEETS_API_URL` in `.env`

### Sheet Management (Dashboard)

- Lists all sheets in the workbook **except MASTER**
- Each card shows **name** and **id** only
- **Create new sheet** button with validation:
  - Cannot name a sheet `MASTER` (reserved)
  - Cannot use a name that already exists
- **Pagination**: max 20 sheets per page (server-side)

### API Actions

| Action        | Purpose                             |
| ------------- | ----------------------------------- |
| `login`       | Validate user against MASTER sheet  |
| `listSheets`  | Paginated list of non-MASTER sheets |
| `createSheet` | Create a new sheet tab              |

### Extending the API

All future features follow the same pattern:

1. Add a new `case` in Apps Script `doPost` (e.g. `getSheetData`, `addRow`)
2. Add a service in `src/services/`
3. Call via `callSheetApi('actionName', payload)` from `src/lib/sheets-api.ts`
4. Paginate any list endpoint (max 20 per page)

---

## Scalability Rules

- **Pagination first** — never fetch all records at once; default/max page size is 20
- **Server-side filtering** — exclude reserved sheets (MASTER) in Apps Script, not in React
- **Action-based API** — one endpoint, many `action` handlers; easy to extend
- **Reusable components** — `SheetCard`, `Pagination`, `CreateSheetModal` pattern for new features
- **Responsive grids** — 1 col mobile → 5 cols on large/TV screens
- **States always** — loading skeletons, empty states, error messages on every data view

## Coding Standards

- Functional components only
- One component per folder with `index.tsx`
- Business logic in `services/`, never in components
- All Sheets API calls through `callSheetApi()` — single entry point
- Tailwind for all styling — no CSS modules
- Forms must have loading, error, and disabled states
- Lazy load all page-level components
- Run `npm run lint` and `npm run format` before committing

---

## Environment Setup

```env
# .env (not committed to git)
VITE_SHEETS_API_URL=https://script.google.com/macros/s/YOUR_ID/exec
```

## Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run format       # Prettier
```
