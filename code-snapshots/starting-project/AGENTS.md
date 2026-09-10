# Repository Guidelines

## Project Structure & Module Organization

This course fork is the starting point for TinyNotes, a Bun, TypeScript, and Next.js application. App Router pages and layouts live in `app/`; global styles and route assets also live there. Product behavior, routes, data models, and security constraints are documented in `SPEC.MD`. Root configuration includes `next.config.ts`, `tsconfig.json`, and lint and PostCSS configuration.

## Build, Test, and Development Commands

Use Bun; `bun.lock` is the authoritative lockfile.

- `bun install` installs dependencies.
- `bun dev` starts the local development server at `http://localhost:3000`.
- `bun run build` creates a production build and checks integration.
- `bun start` serves the completed production build.
- `bun run lint` runs Oxlint.
- `bun run test:unit` runs the Vitest unit suite once.
- `bun run test:unit:watch` runs Vitest in watch mode.
- `bun run test:e2e` runs the Playwright browser suite with an isolated test database.
- `bun run test:e2e:ui` opens Playwright's interactive test runner.
- `bun run test:auth` and `bun run test:notes` run the existing Bun integration suites.
- `bun run format` formats supported files with Oxfmt.

## Coding Style & Naming Conventions

Write TypeScript with two-space indentation and let Oxfmt format it. Follow Next.js conventions such as `page.tsx`, `layout.tsx`, and `not-found.tsx`. Use PascalCase for components, camelCase for functions and variables, and descriptive names such as `updateNoteAction`. Prefer Server Components for reads and Server Actions for mutations, as required by `SPEC.MD`.

## Course Workflow & Agent Guidance

Treat this repository as a learner-owned exercise. Preserve existing work and inspect `git status` before editing. Explain causes and concepts, then offer progressive hints by default. Make code changes only when the request clearly asks for implementation or a fix. Use `SPEC.MD` as the target without expanding scope beyond the current lesson. Keep changes small and understandable.

## Testing Guidelines

Vitest and React Testing Library are configured for unit tests under `tests/unit/`; use
`*.test.ts` or `*.test.tsx`. Playwright tests live under `tests/e2e/` and use `*.spec.ts`.
The existing database integration tests in `lib/` use Bun's test runner and must remain
separate from Vitest. Playwright starts Next.js automatically and uses an ignored SQLite
database under `.test-data/`; install its Chromium runtime with
`bunx playwright install chromium` when needed. No coverage threshold is configured.
Changes should pass `bun run lint`, the relevant unit and integration suites,
`bun run build`, and focused Playwright or browser verification. Prioritize authentication,
ownership, validation, sanitization, sharing, migrations, and generic user-facing errors.

## Commit & Pull Request Guidelines

The current history is too small to establish a convention. Use short, imperative subjects, such as `Add note sharing actions`, and keep commits focused. Pull requests should explain the change, identify relevant `SPEC.MD` criteria, and list verification. Include screenshots for UI changes and call out migrations, environment variables, or security decisions.

## Security & Configuration

Never commit secrets or local SQLite data. Keep values such as `AUTH_SECRET`, `DB_PATH`, and `APP_URL` in local environment files. Preserve generic user-facing errors, validate note ownership on the server, and sanitize rendered TipTap HTML before serving it.
