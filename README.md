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

## Daily open-payment reminders

Karja Tracker includes a Supabase Edge Function that emails one daily digest to
each person who has at least one debt with `status = 'open'`. It uses Resend and
runs at 9:00 AM India time through Supabase Cron.

1. Run `supabase/schema.sql` in the Supabase SQL editor.
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
