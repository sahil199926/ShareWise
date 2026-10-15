# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

# ShareWise

## Public rollout and tenant isolation

Karja Tracker uses Firebase Authentication for Google sign-in, session
persistence, and logout. Supabase Auth is not used. Supabase verifies the
Firebase ID token as a third-party JWT and uses its signed `sub` and verified
email claims for database authorization. The browser never supplies a trusted
email.

Deploy in this order so the frontend never reaches an old permissive schema:

1. Apply `supabase/schema.sql` for a new database, then apply
   `supabase/migrations/20261015110000_multitenant_security.sql`. For an
   existing database that already has the tenant migration, additionally apply
   `supabase/migrations/20261015210000_firebase_direct_auth.sql`.
2. In Firebase Authentication, enable Google and add the local and production
   domains as authorized domains. Add the `VITE_FIREBASE_*` web-app values to
   the frontend environment.
3. In Supabase Auth → Third-Party Auth, add the Firebase project `karja-app`.
   The same setting is declared in `supabase/config.toml` for CLI deployments.
4. Verify a legacy member, a new group owner, an invited member, and a user who
   belongs to two groups before deploying the frontend.

Every tenant RPC accepts a `group_id`, but that value is only a selector. The
database resolves the caller from the verified Firebase JWT `sub` and verifies
an active `group_members` row before reading or changing anything. A caller
cannot gain access by supplying another group's UUID. Financial writes are
available only through guarded database functions; direct debt inserts,
updates, and deletes are revoked.

New groups allow 10 members (including the owner) and three group creations per
account per rolling 24 hours. Higher limits should be handled through
`contact@eonlint.com`.

## Daily open-payment reminders

Karja Tracker includes a Supabase Edge Function that emails one daily digest to
each person who has at least one debt with `status = 'open'`. It uses Resend and
runs at 9:00 AM India time through Supabase Cron.

1. Apply the schema and tenant migration described above.
2. Link the local project and deploy the function:

   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy daily-debt-reminder
   ```

3. Add these Edge Function secrets in Supabase Dashboard → Edge Functions →
   Secrets:

   ```text
   RESEND_API_KEY=re_...
   MAIL_FROM=reminders@your-verified-domain.com
   APP_URL=https://your-karja-tracker.example
   REMINDER_TIME_ZONE=Asia/Kolkata
   ```

   `REMINDER_TIME_ZONE` is optional and defaults to `Asia/Kolkata`. The Resend
   sender domain used by `MAIL_FROM` must be verified.

4. In `supabase/daily-reminder-cron.sql`, replace the project URL and Supabase
   secret key placeholders, then run that file once in the SQL editor. Use a
   named secret key dedicated to this cron job when possible.

   The included schedule is `30 3 * * *`, which is 9:00 AM in India. Supabase
   Cron evaluates this expression in UTC.

The function records each attempt in `daily_reminder_deliveries` and uses a
Resend idempotency key, so retries do not send the same user's digest twice on
the same day. Debts in `close_requested` or `closed` are intentionally excluded.

## Google Sheet debt import

The Debts page includes a legacy-group-admin-only **Sync with sheet** flow. It reads a
selected tab, validates the `TOTAL`, `GIVEN`, and `pending` rows, matches sheet
names to people, previews the resulting debts, and creates them only after
approval. Each tab can be imported once.

1. Apply the schema and tenant migration described above.
2. Paste `google-apps-script/Code.gs` into the Apps Script project attached to
   the expense workbook.
3. In Apps Script project settings, add a Script Property named
   `SHEET_SYNC_SECRET` with a long random value.
4. Deploy the script as a Web App that executes as the owner and copy its `/exec`
   URL.
5. Add the server-only variables from `.env.example` to `.env` locally and to
   the Vercel project environment. `SHEET_SYNC_SECRET` must match the Script
   Property. Do not prefix these variables with `VITE_`.

The Apps Script endpoint is read-only. It lists tab metadata and reads only the
selected tab, with a limit of 500 rows and 100 columns per tab.
