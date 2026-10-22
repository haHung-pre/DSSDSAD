# 📱 StudyMate — app source

Expo (React Native) + TypeScript app for the INT1449 project. Architecture, data flow and the offline strategy
are documented in [`../docs/architecture.md`](../docs/architecture.md); screens and tokens in
[`../docs/ui-design.md`](../docs/ui-design.md).

## Run it

```bash
cp .env.example .env      # optional: EXPO_PUBLIC_API_URL for a physical device
npm install
npm start                 # Expo dev server: press a / i / w, or scan the QR with Expo Go
```

The mock API must be running on port 3000 (`make api-up` from the repository root, or
`npx json-server@0.17.4 backend/db.json --port 3000`).

A device-free end-to-end run over the exported web build lives one level up:
`npm install` at the repository root, then `make e2e-web` (see `../docs/testing-guide.md` §2.2b).

| Command | What it does |
|---------|--------------|
| `npm start` | Expo dev server (Android / iOS / Expo Go) |
| `npm run web` | Dev server in the browser |
| `npm run web:export` | Static web build in `dist/` |
| `npm run web:preview` | Serves `dist/` on :8080 and proxies `/api` to the mock API |
| `npm test` | Jest unit tests (pinned to `TZ=Asia/Ho_Chi_Minh`) |
| `npm run typecheck` | `tsc --noEmit`, `strict: true` |
| `npm run lint` | ESLint (`eslint-config-expo`) |
| `npm run verify` | the pre-submission gate: lint + typecheck + test |

## Where things live

```text
src/
├── app/services.ts      composition root (interfaces → implementations)
├── config/env.ts        API base URL + timeout, read from app.config.ts / expo-constants
├── core/                AppError, FetchHttpClient (timeout), connectivity, clock
├── domain/              models, task rules, schedule rules, repository contracts
├── data/                mappers, StudyApi, JsonCache + Outbox + AsyncStorage, repositories
├── presentation/        controllers (MVVM), screens, components, theme, format helpers
│                        (`state/request-tracker.ts` drops stale responses)
└── navigation/          bottom tabs + native stack
```

**Rules of the codebase**

1. Screens never call `fetch` or `AsyncStorage`; they call a controller, the controller calls a repository.
2. Every async screen state is one of `idle | loading | ready | error`, with `Empty` rendered from `ready` + an
   empty list.
3. No URL, colour or spacing literal in a screen — base URL comes from `config/env.ts`, colours/spacing from
   `presentation/theme/tokens.ts`.
