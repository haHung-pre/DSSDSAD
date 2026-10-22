# Demo & Oral-Defense Script

> Not a graded document by itself — it exists because `INSTRUCTION.md` §9 grades a **5-minute demo** and a
> **live change** on your own code, and 40 % of the mark is individual. Rehearse this until it takes 4 minutes and
> you can point at the file being described without searching.

---

## 0. Before the session (5 minutes, do it once)

```bash
make init                                    # .env
make api-dev                                 # mock API on :3000 (or `make api-up` with Docker)
cd app && npm ci && npm start                # Expo: press "a" (Android) / "i" (iOS) / "w" (web)
```

Have a second terminal ready:

```bash
cd app && npm run verify                     # the numbers you will quote
curl -s localhost:3000/tasks | head -40      # the server's truth, to prove a write landed
```

Check once that the device/simulator is in **light theme, Vietnamese locale**, and the seed data is unmodified
(`git checkout backend/db.json`).

---

## 1. The 4-minute demo (say this out loud)

| # | Do | Say |
|:-:|----|-----|
| 1 | Open the app on **Today** | "The hero card is the class you are in right now, or the next one — `nextSessionInfo()` decides and also says which weekday it falls on. It paints from the cache first, then revalidates — that is `loadTasks()` in `TaskRepositoryImpl`. The card you see first is today's next class; under it the exam countdown, the counters and the deadline list. All of these numbers are pure functions in `domain/task-rules.ts`." |
| 2 | Tap **Công việc** | "Same list, but filtered and searched locally, so search works in airplane mode — that is `searchTasks()` and the `normalize()` fold." |
| 3 | Type `bai tap` in search | "No request per keystroke, and diacritics are folded, so `bai tap` finds `Bài tập`." |
| 4 | Tick a checkbox | "Optimistic: the row flips immediately, the repository writes in the background. If the network dies the operation goes to the **outbox** instead of being lost." |
| 5 | Settings → **Máy bay bật** / DevTools offline → back to Tasks | "The cached list is still there, with the amber banner and the pending counter — turning a usable screen into an error page would be a regression." |
| 6 | While offline, add a task | "The task exists locally with a ⏳ badge; it is a queued `create`, not a failed save." |
| 7 | Network back → Settings → **Đồng bộ ngay** | "FIFO replay. Then `curl /tasks/1` shows the value on the server — the queue is not a lie." |
| 8 | Kill the API (`Ctrl-C`) → pull to refresh on a cold screen | "Now there is no cache to fall back on, so you get the Error state with **Thử lại**; pressing it re-runs the same `load()`." |
| 9 | Open the create form, type half a title, rotate the device | "The form state is persisted on every keystroke in `TaskDraftStore`, so rotation, backgrounding and a process kill all restore it — that is requirement §6 (B1)." |

If time is short, steps 1–7 carry the marks; 8–9 answer the two questions examiners ask most.

---

## 2. Live-change exercises (C3, 1.0 point)

Each one is a single-file edit and takes 2–3 minutes. Practise two of them.

| Change | File | What you touch |
|--------|------|----------------|
| Change how an error is displayed | `presentation/components/state-views.tsx` → `ErrorState` | Title/description props; every screen picks it up because it is a shared component |
| Add a filter chip (e.g. "Tuần này") | `domain/task-rules.ts` (`TASK_FILTERS`, `filterTasks`) + nothing else | The chip appears on the Tasks screen automatically — the screen maps over `TASK_FILTERS` |
| Change the countdown threshold | `domain/task-rules.ts` → `examCountdown()` `urgent` | 3 → 7 days; the card turns amber earlier |
| Make the due label stricter | `domain/task-rules.ts` → `dueLabel()` | "Còn N ngày" only up to 3 days, then a date |
| Show one more task on Today | `presentation/screens/home-screen.tsx` → `upcomingDeadlines(state.tasks, now, 3)` | 3 → 5 |
| Add a field to the form end-to-end | `domain/models.ts` (`TaskInput`) → `TaskFormController.validate/save` → `task-form-screen.tsx` | The honest answer: model → controller → screen → API payload → `db.json` |
| Break something on purpose, then fix it | `presentation/controllers/tasks-controller.ts` | Remove the `isLatest(token)` check → `npm test` goes red on *ignores a slow earlier load…* |

---

## 3. Questions mapped to code

| Question | Answer with |
|----------|-------------|
| "Walk through pull-to-refresh to the list updating" | `Screen.refreshing/onRefresh` → `TasksController.refresh()` → `revalidate('user')` → `TaskRepositoryImpl.refreshTasks()` → `FetchHttpClient` → `applyPendingOperations()` → `setState` → `useSyncExternalStore` re-render |
| "Where does this screen's state live? What survives rotation?" | One controller instance per screen (`useMemo`), subscribed with `useStore`. Controller state is in memory and dies with the process; the *form draft*, the *cache* and the *theme* are on the device |
| "What does the user see on timeout / 404 / 500 / no network?" | `core/errors.ts` maps every failure to an `AppError` with a Vietnamese `userMessage` and `canRetry`; `ErrorState` renders the Retry button **only when `canRetry` is true** (offline / timeout / 408 / 429 / 5xx) and otherwise explains the situation and offers *Quay lại*. `errors.test.ts` + `http-client.test.ts` pin each branch |
| "What if the record is gone?" | `ScreenStatus` has a fifth value, `empty`: the read succeeded and returned nothing (deleted elsewhere). `task-detail-controller.ts` sets it and the screen shows **Công việc không còn tồn tại** + *Quay lại danh sách* — deliberately **no Retry**, because retrying reloads the same nothing |
| "Offline strategy, and what if cache and server disagree?" | Cache-first + FIFO outbox + `applyPendingOperations` superimposes queued writes on the server list; last-write-wins per task is stated as a known limit in `architecture.md` §4 |
| "Why this state management instead of Redux/Zustand?" | `architecture.md` §2 + §6: five screens, no cross-screen shared state; a 40-line `ObservableStore` is testable without React and defensible line by line |
| "Two requests at once — what happens?" | `presentation/state/request-tracker.ts`: stale responses dropped, optimistic writes protected |
| "Which AI suggestions did you reject or fix?" | README §8.3 + `docs/ai-log.md` N1–N6 |

---

## 4. Numbers to quote (re-run `npm run verify` the same day)

- `eslint` → 0 problems · `tsc --noEmit` → 0 errors · Jest → **161 tests / 16 suites**
- `make e2e-web` → **30/30** asserted checks on the exported web build
- `docs/asset/` → 20 screenshots, all reproducible with `node scripts/capture-screenshots.mjs`

Never quote a number you did not run that day.
