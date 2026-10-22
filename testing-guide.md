# Testing Guide & Test Evidence

> Part 1 explains **how** we test. Part 2 is **our evidence**, produced by actually running the app
> (`INSTRUCTION.md` §7.4 — no fabricated results). Screenshots are in `docs/asset/` and `docs/asset/states/`.

Environment used for every result below:

| | |
|---|---|
| App | StudyMate 1.0.0 — Expo SDK 58 / React Native 0.88 / TypeScript (strict) |
| Build used for the screenshots | `npx expo export --platform web` served by `scripts/preview.mjs` (390×844 phone, 820×1180 tablet, `Asia/Ho_Chi_Minh`) — the same React code path as the device build |
| API | `backend/db.json` served by json-server 0.17.4 |
| Date during the tests | 22/10/2026 (seed data has deadlines on 22–31/10/2026) |

---

## Part 1 — How to Test

### 1.1 Automated tests

| Level | What we test | Tool | Where |
|-------|--------------|------|-------|
| Unit — domain rules | due-date maths, urgency labels, filtering, sorting, summary, completion rate, **accent-insensitive search** | Jest | `src/domain/__tests__/task-rules.test.ts` |
| Unit — schedule rules | ISO weekday (incl. Sunday), sessions of a day ordered by time, "next class" (running now / later today / tomorrow / Sunday → Monday), Monday-based week across a month boundary | Jest | `src/domain/__tests__/schedule.test.ts` |
| Unit — mappers | untrusted JSON → domain object: id coercion, unknown enum fallback, ISO date normalisation, missing/blank/broken fields rejected as one `parse` `AppError`, non-array payload rejected | Jest | `src/data/__tests__/mappers.test.ts` |
| Unit — design tokens | WCAG AA 4.5:1 for **every** colour pair used as text, in both themes (34 pairs) | Jest (pure maths) | `src/presentation/__tests__/theme-contrast.test.ts` |
| Unit — HTTP client | timeout/abort, 404 vs 500, malformed JSON, network failure, URL joining, JSON body | Jest + fake `fetch` | `src/core/__tests__/http-client.test.ts` |
| Unit — error policy | `canRetry` for transient failures (offline, timeout, 408, 429, 5xx) vs permanent ones (400/403/404/422, unparsable body); user messages never leak the technical text; what `fetch` really throws in RN and on the web | Jest | `src/core/__tests__/errors.test.ts` |
| Unit — repository | cache-first read, cache fallback offline, offline create queued, replay of the outbox, merge of queued writes over a stale server response, no queueing of 4xx, **single-flight replay** | Jest + in-memory store/fake API | `src/data/__tests__/task-repository.test.ts` |
| Unit — outbox | FIFO append, **concurrent writes do not lose operations**, update against a concurrent enqueue, remove, clear | Jest + in-memory store | `src/data/__tests__/outbox.test.ts` |
| Unit — form draft store | round-trip, per-task namespacing, clear on save, corrupted JSON ignored | Jest | `src/data/__tests__/task-draft-store.test.ts` |
| Unit — view-models | list: `loading → ready`, `error` + retryable message, cached-offline flag, optimistic toggle + rollback, delete, filter. Home: dashboard data, **which failure is reported when both requests reject**, cache kept on a failed refresh. Form: defaults, validation, create, edit, draft restore, offline-save flag, discard | Jest (no React rendering) | `src/presentation/__tests__/tasks-controller.test.ts`, `home-controller.test.ts`, `task-form-controller.test.ts` |
| End-to-end (web build) | 30 asserted checks over the exported bundle: REST load, filter counts, search with/without diacritics, detail, rotation, draft after reload, empty state, 500 + retry, malformed payload **without** a useless retry, a record deleted elsewhere → not-found state, offline queue → manual sync, accessibility | Playwright (`playwright-core`, dev-only) | `scripts/e2e-web.mjs` (`make e2e-web`) |
| Unit — detail view-model | task + course resolution, record gone → `empty` (not a fake error), a failed load still retryable, optimistic status change, **single-flight delete / status change** | Jest | `src/presentation/__tests__/task-detail-controller.test.ts` |
| Unit — settings view-model | diagnostics (connection, queue, cache keys), sync when offline explains itself, success message + refresh, nothing-to-sync message, **cache wipe refused while work is still queued**, storage failure surfaced | Jest | `src/presentation/__tests__/settings-controller.test.ts` |
| Unit — formatting | due-date parsing/validation (impossible dates), round-trip, relative time | Jest | `src/presentation/__tests__/format.test.ts` |
| Static analysis | types across app + tests (`strict: true`), lint rules (no unused imports/vars, no duplicate imports, hooks rules), and one code style for everyone (the `.prettierrc` that was in the repo but never actually applied) | `tsc --noEmit`, ESLint (`eslint-config-expo`), Prettier | `npm run typecheck`, `npm run lint`, `npm run format` |

One command for all of it (also the pre-submission self-check, since this course has no CI):

```bash
cd app && npm install
npm run verify   # = lint && format-check && typecheck && test   (or: make verify from the repo root)
```

> The timezone is pinned in the `test` script on purpose: the due-date rules work on **local calendar days**, so
> running the suite in UTC shifts `2026-10-22T01:00+07:00` to the previous day and the expectation fails. That
> is a real failure we hit and fixed by pinning `TZ` (see README §8.3).

### 1.2 Reproducing the evidence screenshots

All 20 screenshots in `docs/asset/` and `docs/asset/states/` are produced by one command — `scripts/capture-screenshots.mjs` —
(headless Chromium via `playwright-core`). It is a developer tool, not part of the app: it is declared in the
root `package.json` (`npm install` at the repo root), not in `app/package.json`, so it is never bundled.

```bash
make api-dev && make web-export && make web-preview   # API :3000, preview :8080
make e2e-install                                      # playwright-core + chromium (dev-only)
node scripts/capture-screenshots.mjs                  # writes docs/asset/**/*.png
git checkout backend/db.json                          # the sync scenario mutates the seed data
#   (with Docker: `make api-reset`; without Docker the `--watch` server reloads the file itself)
```

It covers every claim in this document, not only the happy path: the four UI states (route interception for the
500 and `[]` responses), the offline queue and the sync result, search, the course drill-down, the tablet viewport,
and the rotation/draft pair. For the last one it rotates the viewport and then reloads the page while the create
form is half-filled and prints the field value each time — the two lines in the output are:

```text
input after rotation: Nháp sống sót sau khi xoay máy
input after reload:   Nháp sống sót sau khi xoay máy
```

### 1.3 Manual scenarios

| Scenario | How |
|----------|-----|
| Offline read | Load the app once (cache warms up) → block `/api/**` (airplane mode / DevTools offline / `make api-down`) → reopen every data screen |
| Offline write + queue | While offline, toggle a task and create a task → expect ⏳ / "N thay đổi chờ đồng bộ" → restore the network → Settings → **Đồng bộ ngay** |
| Slow network / timeout | Throttle to 3G in DevTools or start the API with a delay; with `EXPO_PUBLIC_API_TIMEOUT_MS=1000` the request aborts and shows the timeout message |
| Server error / down | `make api-down`, then pull to refresh (500 vs connection refused) |
| Empty data | Return `[]` for the collection (or empty it in `db.json` + `make api-reset`) |
| Search | Type a keyword with and without diacritics ("bai tap", "BÀI TẬP"), a course code, and a string that matches nothing |
| Rotation & process death | Rotate the device on every screen; with the create form open, force-stop the app ("Don't keep activities") and reopen it |
| Screen sizes & dark mode | 360×640, 390×844, tablet width (820×1180), landscape (844×390); light/dark/system theme from Settings |

---

## Part 2 — Our Test Evidence

### 2.1 Automated tests — result

```text
$ npm run verify          # lint + typecheck + test
> eslint .                        → no errors, no warnings
> prettier --check "src/**/*.{ts,tsx}"  → All matched files use Prettier code style!
> tsc --noEmit                    → 0 errors
> cross-env TZ=Asia/Ho_Chi_Minh jest
PASS src/domain/__tests__/task-rules.test.ts
PASS src/domain/__tests__/schedule.test.ts
PASS src/data/__tests__/task-repository.test.ts
PASS src/data/__tests__/outbox.test.ts
PASS src/data/__tests__/task-draft-store.test.ts
PASS src/core/__tests__/http-client.test.ts
PASS src/core/__tests__/errors.test.ts
PASS src/presentation/__tests__/request-tracker.test.ts
PASS src/presentation/__tests__/home-controller.test.ts
PASS src/presentation/__tests__/tasks-controller.test.ts
PASS src/presentation/__tests__/task-detail-controller.test.ts
PASS src/presentation/__tests__/task-form-controller.test.ts
PASS src/presentation/__tests__/settings-controller.test.ts
PASS src/presentation/__tests__/theme-contrast.test.ts
PASS src/presentation/__tests__/format.test.ts

Test Suites: 16 passed, 16 total
Tests:       161 passed, 161 total
Time:        2.643 s
```

Notable cases that guard the graded requirements:

| Requirement | Test that proves it |
|---|---|
| Loading / Error / Empty states | `tasks-controller.test.ts` → *goes loading → ready*, *exposes an error state with a retryable message when nothing is cached* |
| "Empty" is not "error" | `task-detail-controller.test.ts` → *shows the not-found (empty) state when the task no longer exists — not a retryable error*; `task-form-controller.test.ts` → *shows the not-found (empty) state when editing a task that was deleted elsewhere* |
| Retry appears only when it can work | `errors.test.ts` → *offers a retry for transient failures*, *refuses a retry when the same request would fail the same way*, *refuses a retry for a payload that does not parse* |
| Offline read | `task-repository.test.ts` → *falls back to the cache when the refresh fails (airplane mode)* |
| Offline write + sync | `task-repository.test.ts` → *queues a create while offline…*, *replays the queued create when connectivity returns* |
| No data loss on refresh | `task-repository.test.ts` → *does not lose a queued change when a refresh returns the old server list* |
| Robust API handling | `http-client.test.ts` → timeout, 404, 500, malformed JSON, network failure; `mappers.test.ts` → a payload with a missing title / impossible date is refused instead of rendering |
| "What is my next class?" | `schedule.test.ts` → *returns the class that is still running rather than skipping to tomorrow*, *rolls over to the next day*, *wraps from Sunday back to Monday*, *starts on Monday and ends on Sunday*, *crosses a month boundary correctly* |
| Correct urgency wording | `task-rules.test.ts` → *formats the due label for today, tomorrow, this week and overdue tasks* |
| Search works offline, without accents | `task-rules.test.ts` → *strips Vietnamese diacritics…*, *finds by title, description and course code* |
| Form survives rotation / process death | `task-draft-store.test.ts` + `task-form-controller.test.ts` → *restores unsaved input after the app was killed mid-typing* |
| Form validation | `task-form-controller.test.ts` → *reports validation errors instead of saving* (title < 3 chars, impossible date) |
| Exam countdown (topic feature) | `task-rules.test.ts` → *picks the earliest exam that is still ahead*, *ignores finished and overdue exams*, *counts whole calendar days and marks the last three as urgent*, *says "today" / "tomorrow"* |
| A slow older response cannot win | `tasks-controller.test.ts` → *ignores a slow earlier load that resolves after a newer one*; `request-tracker.test.ts` (4 cases) |
| A refresh cannot revert an optimistic write | `tasks-controller.test.ts` → *does not let a background refresh revert an optimistic toggle* |
| Colours stay readable | `theme-contrast.test.ts` → *every pair reaches WCAG AA*, in both themes |
| A double tap cannot write twice | `task-form-controller.test.ts` → *a double tap on save creates the task only once*; `task-detail-controller.test.ts` → *a double tap on delete sends only one request*, *ignores a second status change while one is in flight* |
| Two writes at once do not lose data | `outbox.test.ts` → *keeps every operation when several writes are queued in the same tick*, *serialises an update against a concurrent enqueue* |
| Syncing twice still sends one request | `task-repository.test.ts` → *replays the queue only once when two syncs start at the same time* |
| The error screen names the real failure | `home-controller.test.ts` → *shows the tasks error when both the timetable and the tasks fail* (and *still shows the dashboard when only the timetable fails*) |
| Search survives a JS engine without `String.normalize` | `task-rules.test.ts` → *still works on engines without String.prototype.normalize (Hermes without Intl)*, *falls back when normalize throws at runtime* |

### 2.2 Manual scenarios — result

| # | Scenario | Screen(s) | Result (evidence) | Pass? |
|:-:|----------|-----------|-------------------|:-----:|
| 1 | Offline read (cache) | Tasks, Today, Timetable, Courses | List renders from the cache with the amber banner "Đang dùng dữ liệu lưu ngoại tuyến · Cập nhật vừa xong" — `docs/asset/states/tasks-offline.png` | ✅ |
| 2 | Offline write + queue | Tasks → checkbox | Task flips instantly, counter shows "1 thay đổi đang chờ đồng bộ" — `docs/asset/states/offline-queue.png` | ✅ |
| 3 | Sync after reconnect | Settings → **Đồng bộ ngay** | "Đã đồng bộ 1 thay đổi.", pending counter back to 0 — `docs/asset/states/sync-success.png`; `GET /tasks/1` on the server afterwards: `"status": "done"` | ✅ |
| 4 | Server error (500) with no cache | Tasks | Friendly message "Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút." + **Thử lại** — `docs/asset/states/tasks-error.png` | ✅ |
| 5 | Empty data | Tasks | "Chưa có công việc nào" + **Thêm công việc** CTA, counters read 0 — `docs/asset/states/tasks-empty.png` | ✅ |
| 5b | A record deleted on another device | Task detail | The API stops returning task 1 and the local cache is dropped: the screen shows "Công việc không còn tồn tại" + **Quay lại danh sách** — **no Retry button**, because reloading would find nothing again. `docs/asset/states/task-missing.png`, asserted twice in `make e2e-web` | ✅ |
| 5c | Payload the app cannot read | Tasks | A task object with no title and no date → "Không đọc được dữ liệu" + "Dữ liệu nhận được không hợp lệ." and **no Thử lại** (a repeated request returns the same body) — asserted in `make e2e-web`; `errors.test.ts` pins `canRetry = false` for `parse` | ✅ |
| 6 | Timeout | Tasks | `AbortController` path covered by `http-client.test.ts` (fake `fetch` that never resolves → `kind: 'timeout'`, "Máy chủ phản hồi quá chậm…"); manually reproduced by stopping the API mid-request | ✅ (unit-level) |
| 1b | Next class on the hero card | Today | While a class is running the label reads "TIẾT HỌC ĐANG DIỄN RA"; otherwise "TIẾT HỌC TIẾP THEO", and a class that is not today is prefixed with its weekday ("Thứ 3 · 09:45 – 11:45") — `docs/asset/home.png`, asserted in `make e2e-web` (the check accepts both labels on purpose) | ✅ |
| 6b | Exam countdown | Today | The card reads "ĐẾM NGƯỢC KỲ THI · Kiểm tra giữa kỳ Lập trình mạng · INT1433 · 08:00 · 05/11/2026 · **14 ngày**" and turns amber in the last three days (`docs/asset/home.png`, asserted in `make e2e-web`) | ✅ |
| 7 | Search | Tasks | "socket" → header reads `1/9 kết quả cho "socket"` and only the socket assignment remains (`tasks-search.png`); "bai tap" matches "Bài tập" (unit test) | ✅ |
| 8 | Course drill-down | Courses → Tasks | Tapping the INT1449 card opens the task list scoped to it: chip "Đang lọc theo môn · INT1449 ✕", counts `2`, chips re-counted — `docs/asset/states/tasks-course-filter.png`; the ✕ clears the scope | ✅ |
| 9 | Form draft after rotation **and** app kill | Create task | Field value `Nháp sống sót sau khi xoay máy` survived a viewport rotation **and** a full page reload; the form shows "Đã khôi phục bản nháp bạn đang nhập dở." — `docs/asset/states/rotation-landscape.png`, `docs/asset/states/draft-restored.png` | ✅ |
| 9b | Wireframes match the implementation | All 7 screens | `docs/asset/wireframes/*.svg` opened next to `docs/asset/*.png`: same blocks in the same order; the only additions are the exam-countdown card on Today (added in a later pass, and the wireframe was updated — commit *docs(wireframe): show the exam countdown block on SCR-01*) and the not-found state on detail | ✅ |
| 10 | Tablet / landscape layout | Today, Tasks | Content capped at 720 pt and centred; no stretched rows — `docs/asset/tablet-home.png`, `docs/asset/tablet-tasks.png`, `docs/asset/states/rotation-landscape.png` | ✅ |
| 11 | Dark mode | Today | Full dark token set, same hierarchy — `docs/asset/home-dark.png` | ✅ |
| 12 | Create / edit validation | Task form | Empty title → "Tên công việc cần ít nhất 3 ký tự."; `2026-02-31` → "Hạn chót không hợp lệ…" (also asserted in `format.test.ts` / `task-form-controller.test.ts`); quick chips fill the field | ✅ |
| 13 | Accessibility | All screens | Every control has an accessible name (asserted in `make e2e-web`); checkboxes expose `role=checkbox` **and** `aria-checked` (12 of them found in the DOM — the attribute was genuinely missing before this pass); the tab bar exposes exactly one `aria-selected`; text contrast ≥ 4.5:1 is unit-tested | ✅ |

### 2.2b End-to-end checks (asserted, not just screenshots)

`scripts/e2e-web.mjs` drives the exported web build with a headless browser and **fails with exit code 1**
when an expectation breaks, so it is a repeatable gate rather than a photo album. It ran green:

```text
$ make api-dev            # terminal 1: json-server on :3000
$ make web-export         # once: build app/dist
$ PORT=3000 make web-preview   # terminal 2
$ make e2e-web
PASS  Today shows the next class
PASS  Today shows upcoming deadlines
PASS  Today shows the semester progress
PASS  Today counts down to the next exam
PASS  Tasks lists tasks loaded over HTTP — 9 rows
PASS  The filter chips count the same list
PASS  Search filters the list
PASS  Search ignores Vietnamese diacritics ("bai tap" → "Bài tập")
PASS  Search miss shows its own empty state
PASS  Task detail opens
PASS  Layout survives a rotation
PASS  No runtime errors on the happy path
PASS  Course card opens the task list scoped to that course
PASS  Unsaved form input survives a reload (draft) — Nháp kiểm thử E2E
PASS  The form tells the user the draft was restored
PASS  Empty data shows the empty state
PASS  HTTP 500 shows the error state with a retry button
PASS  A malformed payload shows the error state instead of crashing — Chào bạn / Thứ 6, 23/10/2026 / Không đọc được dữ liệu
PASS  A payload error does not offer a retry that cannot work
PASS  A task that disappeared shows the not-found state — Chi tiết / Chi tiết công việc / Công việc không còn tồn tại
PASS  The not-found state offers a way back, not a retry
PASS  Every control has an accessible name
PASS  The bottom tab bar exposes which tab is active — 1 selected
PASS  The search field is reachable by its label
PASS  Task checkboxes expose their checked state — 12 checkboxes
PASS  Every control on the task list has an accessible name — 0 unnamed
PASS  Offline write is queued and explained
PASS  Settings reports the pending change
PASS  Clearing the cache is refused while a change is still queued
PASS  Manual sync reports what it did

30/30 checks passed
```

The offline and error cases are produced with Playwright route interception (`route.abort('internetdisconnected')`,
`route.fulfill({status: 500})`, `route.fulfill({body: '[]'})`) — no need to unplug anything, and the run is
deterministic. The offline check is the only one that writes to `backend/db.json`, so restore it afterwards:
`git checkout backend/db.json && make api-reset`.

### 2.3 Bugs and traps found while testing (and fixes)

Every row below is something we actually hit. Rows marked **(design review)** were caught by reading the code
path against a scenario *before* it shipped, and are now locked by a test — we list them because they are the
most likely oral-defense questions about the offline layer.

| Finding | How it was found | Fix |
|---|---|---|
| A pull-to-refresh while a write was queued **reverted the local change**, because the server still had the old value | **(design review)** of the refresh path, then locked by the test *does not lose a queued change when a refresh returns the old server list* | `applyPendingOperations()` merges the outbox over every server response |
| Queueing **every** failed write duplicated operations that had actually reached the server before the connection dropped | **(design review)** of the `catch` blocks | Only `AppError.kind === 'offline'` is queued; timeouts and HTTP errors surface as errors the user can retry. Locked by *does not queue writes that failed for a non-connectivity reason* |
| Editing a task that was **created offline** sent `PATCH /tasks/local-…` → 404 → the edit was lost | **(design review)** of scenario 2 with a task created while offline | `updateTask` rewrites the queued `create` payload instead of enqueueing an update for an id the server has never seen (`rewritePendingCreate`) |
| The due-date suite passed on our machines but failed in UTC: `2026-10-22T01:00+07:00` counted as *today* | **Real failure** — `npm test` with `TZ=UTC`: `Expected: 1, Received: 0` (1 of 37 tests failed) | The rules are correct (they work on the user's local calendar days); the `test` script pins `TZ=Asia/Ho_Chi_Minh` |
| Emoji icons rendered as empty boxes (`□`) instead of home/check/calendar/tab glyphs | **Real failure** — visible in the first screenshots of the web build | Replaced every emoji with inline SVG icons (`src/presentation/components/icons.tsx`) |
| The timetable day strip stretched to the full screen height | **Real failure** — visible in the timetable screenshot | `alignItems: 'flex-start'` on the chip row + `flexGrow: 0` on the horizontal `ScrollView` |
| Status labels wrapped into two lines (07:00 → "07:0\\n0") on a 390 pt screen | **Real failure** — visible in the Today screenshot | Time column widened to 56 pt in `SessionRow` |
| The search field showed a heavy black focus ring on web, and the task detail printed "Bài tập" through the *session* label map | **Real failure** — visible in `tasks-search.png`, then in the detail screenshot | `outlineWidth: 0` + a `primary` border on focus; the detail screen uses `TASK_TYPE_LABELS` |
| Lint found three real dead ends: an unused import, a duplicated import of the draft store, and a test that destructured an `outbox` it never used | **Real failure** — first `npm run lint` run (7 warnings) | Cleaned up; `npm run verify` is now clean (0 errors, 0 warnings) |
| Two offline edits made in the same tick both called `enqueue()`, and one **silently disappeared**: each call read the queue, appended and wrote it back | **Design review** of `outbox.enqueue` (read-modify-write on the same storage key) + new test *keeps every operation when several writes are queued in the same tick*, which reproduced `1 of 5` operations surviving | Every mutation now runs through a serial promise chain (`mutationChain` / `serialize()`), so the operations queue up instead of overwriting each other |
| The connection listener, the **Đồng bộ ngay** button and app-resume could run `syncPending()` at the same time → the same queued create was POSTed twice | **Design review** of the three entry points that call `syncPending()` | Single-flight guard (`syncInFlight`) around `runSync()`; the second caller awaits the same promise. Locked by *replays the queue only once when two syncs start at the same time* |
| "Hôm nay" reported **"Bạn đang ngoại tuyến"** even when the server had returned 500 | **Design review** of `home-controller`: the error state read `sessions.reason` instead of `tasks.reason` when both requests failed | Pick the failure that actually happened (tasks first) and added `home-controller.test.ts` for both the "both failed" and "only the timetable failed" cases |
| Search would crash on a JS engine where `String.prototype.normalize` is missing (Hermes builds without full Intl) or throws | **Design review** of `normalize()` — the app has no other Unicode dependency, so this was the only single point of failure | `normalize()` checks `typeof text.normalize === 'function'`, wraps the call in `try/catch`, and otherwise folds with an explicit Vietnamese table (`foldChar`). Covered by two tests that temporarily remove/break the method |
| The offline queue only replayed when connectivity **changed** — a phone that was already online when the app returned to the foreground kept its ⏳ rows until the user opened Settings | **Design review** of `use-auto-sync` | Added an `AppState` listener: `'active'` also triggers `syncPending()` (guarded by the single-flight above) |
| Scrolling back to a screen fired a second `load()`; when the **older** request answered last it overwrote the fresher list, so the screen visibly jumped back to stale rows | **Design review** of `useFocusEffect(load)` + pull-to-refresh, then reproduced with two overlapping requests in `tasks-controller.test.ts` (fails without the guard) | Every view-model owns a `RequestTracker`: a response is applied only if it is still the latest request |
| Ticking a checkbox while the background refresh was open flipped the row back a second later, because the snapshot had been built **before** the write | **Design review** of `revalidate()`/`TaskDetailController.load()` | `RequestTracker.markLocalWrite()` bumps a version; a response whose version is stale keeps the local state. Locked by *does not let a background refresh revert an optimistic toggle* |
| The topic promises an **exam countdown** (`INSTRUCTION.md` §5.4) and the first version only listed exams as ordinary deadlines | **Gap against the brief** — reading §5 again and comparing it with the screen inventory | Added `nextExam()` / `examCountdown()` in the domain layer + a Today card (days left, course, date, amber in the last 3 days), with 4 tests and an E2E assertion |
| Pressing **Lưu** twice created two tasks, and **Xoá** twice sent a second `DELETE` for an id the server had already removed (the second one surfaced as an error after a successful delete) | **Design review** of the press handlers: `isSaving`/`busy` were only used to *render* a spinner, the handlers never checked them, and a second tap can land before React re-renders the disabled button | Guards at the view-model boundary (`if (isSaving) return false`, `if (busy) return`), which also covers the web Enter key and any other caller. Locked by three tests |
| Every screen computed `new Date()` **at render time only**, so an app left open overnight (or taken out of a pocket the next morning) kept saying "Hôm nay" for yesterday and showed a stale exam countdown | **Design review** of the day-granularity labels while auditing the countdown card | `useNow()` hook: re-renders once a minute and immediately on `AppState === 'active'`; used by Today, Tasks, Detail, Timetable, Courses and Settings |
| `app/README.md` still advertised "37 Jest unit tests" long after the suite had grown | **Doc drift** found while re-reading the repository top to bottom | Counts removed from the sub-README; it now points at `npm run verify` and the root E2E script |
| The `domain/schedule.ts` module — which decides what the Today card shows and how the week strip is built — had **no tests at all**, although its answers change every hour and every weekday | **Coverage review**: it was the only domain module without a suite | 16 tests (weekday mapping incl. Sunday, ordering, roll-over to tomorrow, Sunday → Monday, the Monday-based week across a month boundary). Writing them was also the cheapest way to *prove* the rules were right before changing the card |
| The hero card said **"TIẾT HỌC TIẾP THEO" for the class the student was sitting in** ("next" while it is happening), and showed tomorrow's class without saying it was tomorrow | **Design review** while writing the schedule tests: `nextSession()` returns the in-progress class by design, but the label did not distinguish the two | `nextSessionInfo()` returns `{ session, ongoing, weekday }`; the card switches to "ĐANG DIỄN RA" and prefixes the weekday when the class is not today. `nextSession()` stays as a thin wrapper, so no caller broke |
| `make init` printed starter instructions ("create your app in `app/`") although the app already exists, and the root `.env.example` offered `APP_NAME`/`APP_BASE_URL` variables **nothing reads** | **Fresh-clone walkthrough**: following our own Quick Start from a clean copy | `init.sh` now prints the real next steps; the root `.env.example` only contains `API_PORT` (the one variable docker compose reads) and points at `app/.env.example`; the devcontainer also installs the app dependencies |
| "Xoá dữ liệu lưu offline" wiped the cache **even with unsynced changes waiting in the outbox**, so the user's not-yet-uploaded task disappeared from every screen until a sync succeeded — a destructive button with an unchecked precondition | **Reading the destructive path** while adding tests for the settings view-model (the only view-model with no suite) | `clearCache()` now counts the outbox first and refuses with "Còn 1 thay đổi chưa đồng bộ. Hãy đồng bộ trước khi xoá dữ liệu ngoại tuyến."; 7 unit tests and an end-to-end check cover both the refusal and the normal clear |
| `StudyApi` carried a `fetchTask(id)` endpoint that **no caller used** (the detail screen reads the task from the loaded list, on purpose — that is what makes it work offline), and `docs/api-integration.md` listed `/profile` as used by Settings when it is used by Today | **Endpoint-by-endpoint check of the API doc against `study-api.ts`** | The dead method is gone, the doc matches the client, and the "no per-id GET" decision is written down where the next reader will ask about it |
| The repository shipped a `.prettierrc` **and** an `npm run format` script, but the command failed on **30 files** — the style was declared and never applied, so every editor reformatted differently | **Running every script in `package.json` once**, instead of only the ones we used | `prettier --write` over `src/`, and the format check moved *into* `npm run verify`, so "the code is formatted" is now enforced by the same command as lint/types/tests |
| The detail and edit screens showed a **fake error** when the task no longer existed (`toAppError(new Error('Task not found'))`) — and the `ErrorState` they rendered offered **Thử lại**, which reloaded the same nothing, forever | **State review**: `ScreenStatus` had no way to say "the request succeeded and the answer is *nothing*", so "deleted elsewhere" was forced into "failure" | `ScreenStatus` gained **`empty`**; both view-models set it, and both screens render an `EmptyState` with *Quay lại danh sách*. Two unit tests + two end-to-end checks + `docs/asset/states/task-missing.png` |
| `AppError.canRetry` existed, was tested in `http-client.test.ts`… and **nothing used it**: the UI drew a Retry button for a 404, for a 422 and for a body that does not parse | **Reading the error path end to end** while documenting the states | `ErrorState` now renders Retry only when `canRetry` is true; otherwise it explains the situation and offers *Quay lại*. `errors.test.ts` pins the policy (13 cases) and `e2e-web.mjs` asserts that a malformed payload shows **no** Thử lại |
| On the web build a **screen reader could not tell a completed task from an open one**: the checkbox had `role=checkbox` and a label but **no `aria-checked`** | **Real failure** found by dumping the DOM during the accessibility pass (`document.querySelectorAll('[role=checkbox]')` → 0 elements with `aria-checked`) | `accessibilityState` alone is not translated by react-native-web, so the state is now stated twice: `accessibilityState` for native, explicit `aria-checked` / `aria-disabled` / `aria-busy` / `aria-pressed` for web. The E2E run now asserts it (12 checkboxes found) |
| Five light-theme colours were **below WCAG AA as text**: `success` 3.90:1, `warning` 3.92:1 on its own tint, `primary` 4.21:1 on the background, `error` 4.24:1, `secondary` 3.07:1 | **Measured** with a relative-luminance script while auditing the design tokens (the docs claimed "≥ 4.5:1") | Palette re-tuned (`#047A58`, `#9A5313`, `#2560D8`, `#C4281C`, `#0A7A6D`); the ratios are now a unit test, so the claim cannot rot |
| Course pills used the colour **sent by the API** as text on a 13 % tint — `#12A594` gives 3.07:1, so one subject was unreadable while another was fine | **Design review** of `course-card.tsx` / `task-card.tsx` | Server colours became decorative (tint + progress bar); the code text uses `text-primary`, which is guaranteed by the palette test |
| The mapping layer — the only place where untrusted JSON becomes a domain object — had **no tests at all** | **Coverage review**: every other data-layer file had a suite | 12 tests: id coercion, unknown enums, ISO normalisation, missing/blank/impossible fields, non-array payloads |
| Nothing in the app proved that rotation keeps user input | **Design gap** — `INSTRUCTION.md` §6 (B1) asks for it explicitly and the app was locked to portrait with in-memory-only form state | Unlocked rotation, implemented `TaskDraftStore`, added a test and a live check (scenario 9) |
