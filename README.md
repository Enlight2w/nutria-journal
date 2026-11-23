# Nutria Journal

Nutria Journal is a wellness planning and journaling app with nutrition targets, meal suggestions, progress tracking, an AI encouragement coach, and user-managed schedules.

## Health and service limits

The app provides general wellness education, not diagnosis, treatment, or individualized medical care. Consult a qualified professional for medical concerns. Subscription checkout is intentionally inactive until payment-provider credentials are configured; external commerce and AI features also depend on their respective server integrations.

## Development

Use Node.js and the pnpm version declared in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm check
pnpm build
```

To start the development server on macOS or Linux, run `pnpm dev`. In Windows PowerShell, set the environment variable explicitly:

```powershell
$env:NODE_ENV = "development"
pnpm exec tsx watch server/_core/index.ts
```

Configure required server variables locally before using authentication, database persistence, the AI coach, or commerce integrations. Do not commit credentials or private health information.
