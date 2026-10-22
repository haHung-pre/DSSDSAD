# AI Usage Log

> **Mandatory** — see [`INSTRUCTION.md` §7](../INSTRUCTION.md#7-ai-usage-policy).
> This file records the AI interactions that shaped the repository.
>
> **Status of the entries below:** they were written as a *draft by the assistant itself* for the sessions in
> which the first version of StudyMate was produced. The column **"What we kept, changed or rejected"** is
> intentionally left for each member to complete **in their own words** after they have read and run the code —
> that column is what the oral defense examines, and only you can truthfully fill it.

---

## Log

| # | Date | Member | Tool / model | Task — what you asked | What AI produced | What we kept, changed or rejected — and how we verified it | Files |
|:-:|------|--------|--------------|-----------------------|------------------|---------------------------------------------------------------|-------|
| 1 | 2026-10-20 | Hùng | Arena.ai agent (Claude/GPT-class assistant) | "Read the INT1449 starter repo and build the whole project: proposal, design docs, app, tests" | Full proposal, UI/UX and architecture docs; the React Native + Expo app (screens, view-models, repositories, cache/outbox, theme); 37 unit tests; screenshots | _(Hùng to complete)_ | `docs/proposal.md`, `docs/ui-design.md`, `docs/architecture.md`, `app/src/**` |
| 2 | 2026-10-20 | Hùng | Arena.ai agent | Design an offline strategy that survives a refresh, an edit of an offline-created task and a delete | Cache-first repository + FIFO outbox, `applyPendingOperations`, `rewritePendingCreate`; tests for each path | _(Hùng to complete)_ | `app/src/data/repositories/task-repository.ts`, `app/src/data/local/outbox.ts`, `app/src/data/__tests__/task-repository.test.ts` |
| 3 | 2026-10-20 | Đức Anh | Arena.ai agent | Design the Today dashboard and the timetable week strip; which schedule calculations belong in the domain layer? | `domain/schedule.ts` (`isoWeekday`, `sessionsForDay`, `nextSession`, `weekDates`), `HomeController`, `TimetableController`, screen layouts | _(Đức Anh to complete)_ | `app/src/domain/schedule.ts`, `app/src/presentation/controllers/home-controller.ts`, `timetable-controller.ts`, `screens/home-screen.tsx`, `screens/timetable-screen.tsx` |
| 4 | 2026-10-20 | Tergel | Arena.ai agent | Create/edit form with validation and offline-safe save; course and settings screens | `TaskFormController` (validation, quick due-date chips), `CoursesController`, `SettingsController`, theme tokens + provider | _(Tergel to complete)_ | `app/src/presentation/controllers/task-form-controller.ts`, `courses-controller.ts`, `settings-controller.ts`, `presentation/theme/**` |
| 5 | 2026-10-20 | All | Arena.ai agent | "Write the API integration doc and the testing guide, then actually run the tests and take screenshots" | `docs/api-integration.md`, `docs/testing-guide.md`, the captured evidence in `docs/asset/` | _(all members — check every claim against your own run)_ | `docs/api-integration.md`, `docs/testing-guide.md`, `docs/asset/**` |
| 6 | 2026-10-22 | All | Arena.ai agent | Second pass: "read the brief again, find every gap against the rubric, and close it" | Rotation unlocked, `TaskDraftStore` + 5 tests, offline search (`searchTasks` + 6 tests), course → task drill-down, `max-content-width` actually applied, ESLint + `make verify`, two rendering bugs fixed | _(all members: re-check the new files and the claims in README §6)_ | `app/src/data/local/task-draft-store.ts`, `app/src/domain/task-rules.ts`, `app/src/presentation/screens/tasks-screen.tsx`, `app/eslint.config.js`, `Makefile` |
| 7 | 2026-10-22 | All | Arena.ai agent | Third pass: "make it as perfect as it can be — hunt real concurrency and engine bugs, and turn the manual checks into something that fails loudly" | Serialised outbox writes (`mutationChain`), single-flight `syncPending()` (`syncInFlight`), correct error selection on the Today dashboard, `String.normalize`-independent search (`foldChar`), `AppState`-triggered replay, 12 new unit tests (64 total, 9 suites) and an asserted end-to-end script (`scripts/e2e-web.mjs`, 19 checks) wired into `make e2e-web` | _(all members: run `make verify` and `make e2e-web` yourselves, read the four fixed files, and write what you kept/changed/rejected)_ | `app/src/data/local/outbox.ts`, `app/src/data/repositories/task-repository.ts`, `app/src/presentation/controllers/home-controller.ts`, `app/src/domain/task-rules.ts`, `app/src/presentation/hooks/use-auto-sync.ts`, `scripts/e2e-web.mjs` |
| 8 | 2026-10-22 | All | Arena.ai agent | Fourth pass: "re-read the whole starter repository (brief, guides, PR template) and make it as perfect as it can be" | Per-view-model `RequestTracker` (stale responses dropped, optimistic writes protected) applied to the task list, task detail, Today, Timetable and Courses; the topic's **exam countdown** (`nextExam` / `examCountdown` + Today card, 4 tests); `app/README.md` refreshed; docs re-audited line by line against `INSTRUCTION.md` §4–§8 | _(all members: run `make verify` and `make e2e-web`, then read `presentation/state/request-tracker.ts` and the countdown card — those are the two things an examiner is most likely to ask about this pass)_ | `app/src/presentation/state/request-tracker.ts`, `app/src/domain/task-rules.ts`, `app/src/presentation/screens/home-screen.tsx`, `app/README.md`, `docs/testing-guide.md` |
| 9 | 2026-10-22 | All | Arena.ai agent | Fifth pass: "keep going — audit the press handlers and anything that depends on the clock, and give us something to rehearse the demo with" | In-flight guards in `TaskFormController.save()` and `TaskDetailController` (`isSaving` / `busy`), `useNow()` so day labels and the countdown do not freeze, 6 new tests (80 total, 11 suites), and `docs/demo-script.md` | _(all members: rehearse `docs/demo-script.md` at least once on a real device, and be ready to explain why the guard sits in the view-model and not in the button)_ | `app/src/presentation/hooks/use-now.ts`, `app/src/presentation/controllers/task-form-controller.ts`, `app/src/presentation/controllers/task-detail-controller.ts`, `docs/demo-script.md` |
| 10 | 2026-10-22 | All | Arena.ai agent | Sixth pass: "audit accessibility and the untrusted-input path — prove what the docs claim" | Light palette re-tuned to WCAG AA with a contrast unit test, explicit `aria-*` state (react-native-web drops `accessibilityState`), course colours demoted to decorative, 12 mapper tests + 36 contrast tests (128 total, 13 suites), E2E a11y block and a malformed-payload check (26/26) | _(all members: run `make e2e-web` and read `theme-contrast.test.ts` — the palette numbers are the easiest thing to be asked about, and the `aria-*` duplication needs a one-sentence explanation)_ | `app/src/presentation/theme/tokens.ts`, `app/src/presentation/__tests__/theme-contrast.test.ts`, `app/src/data/__tests__/mappers.test.ts`, `app/src/presentation/components/task-card.tsx`, `scripts/e2e-web.mjs` |
| 11 | 2026-10-22 | All | Arena.ai agent | Seventh pass: "keep going — anything still untested or still telling the old story about this repo?" | 16 tests for `domain/schedule.ts` (the last untested domain module), `nextSessionInfo()` so the hero card stops calling a running class "next" and names the weekday when it is not today, plus the starter leftovers a new member would trip over (`init.sh` message, root `.env.example`, devcontainer) | _(all members: read `schedule.ts` and be able to answer "what does the Today card show at 10:00 during a 09:45–11:45 lecture, and why?")_ | `app/src/domain/schedule.ts`, `app/src/domain/__tests__/schedule.test.ts`, `app/src/presentation/screens/home-screen.tsx`, `scripts/init.sh`, `.env.example` |
| 12 | 2026-10-22 | All | Arena.ai agent | Eighth pass: "re-read the brief and the starter, then make the app as close to perfect as it can be" | Read `INSTRUCTION.md` §4/§6, `AGENTS.md`, `GETTING_STARTED.md` and the whole `app/src` tree against the rubric. Found two real state bugs: a **fake error + useless Retry** for a task that no longer exists, and a **`canRetry` policy that nothing used**. Added `ScreenStatus = 'empty'`, `canRetry`-driven `ErrorState`, `errors.test.ts` (13 cases), `settings-controller.test.ts` (the last untested view-model), a guard so "Xoá dữ liệu lưu offline" cannot delete unsynced work, the Prettier config the repo declared but never applied, and 4 missing wireframes (161 tests / 16 suites, 30/30 E2E) | _(all members: read `app/src/core/errors.ts` and `task-detail-controller.ts` — "why is 'not found' not an error?" is exactly the kind of question C2 asks)_ | `app/src/core/errors.ts`, `app/src/presentation/state/async-slice.ts`, `app/src/presentation/components/state-views.tsx`, `app/src/presentation/controllers/task-detail-controller.ts`, `app/src/presentation/controllers/task-form-controller.ts`, `app/src/core/__tests__/errors.test.ts`, `scripts/e2e-web.mjs` |

---

## Notable Interactions

### N1. Offline write queue vs. a stale server response

- **Member / date / tool:** Hùng / 2026-10-20 / Arena.ai agent
- **Prompt (key excerpt):** "A task was edited while offline. The user pulls to refresh before the queue is
  replayed. What does the list show, and how do we guarantee the edit is not lost?"
- **What the AI suggested:** fetch the server list, then overlay the outbox operations on top of it
  (`applyPendingOperations`), instead of replacing the cache with the response.
- **What we decided and why:** kept the overlay; without it the refresh silently reverts the user's change, and
  the pending badge would contradict the list content.
- **What the AI got wrong or missed:** the merge was correct, but the surrounding design had an easy trap we had
  to settle explicitly before accepting the code — queueing *every* failed write, including a `timeout` that may
  already have reached the server, would duplicate the operation on replay. We restricted queueing to
  `kind === 'offline'` and covered it with a test.

### N2. State management without a library

- **Member / date / tool:** all / 2026-10-20 / Arena.ai agent
- **Prompt (key excerpt):** "We have seven screens and no cross-screen state. Should we use Redux, Zustand or
  TanStack Query?"
- **What the AI suggested:** a per-screen controller class over a tiny `ObservableStore` bound with
  `useSyncExternalStore`, instead of a global store.
- **What we decided and why:** kept it — controllers are plain classes, so the view-model tests run without
  React, and "where does this state live?" has a one-line answer in the defense.
- **What the AI got wrong or missed:** nothing that survived review — but the pattern only works if the
  controller is created with `useMemo` and reloaded on screen focus; we checked both in the code and by
  navigating back and forth in the running app.

### N3. A real bug the AI introduced: timezone-dependent tests

- **Member / date / tool:** Hùng / 2026-10-20 / Arena.ai agent
- **Prompt (key excerpt):** "Write unit tests for the due-date rules."
- **What the AI suggested:** expectations built on `+07:00` timestamps, with no timezone pinning in the test
  script.
- **What we decided and why:** the *rules* are right (users think in local calendar days); the test run had to
  be deterministic, so `test` now runs with `TZ=Asia/Ho_Chi_Minh`. Verified by running the suite with `TZ=UTC`
  and watching 1 of 37 tests fail.
- **What the AI got wrong or missed:** it assumed the CI/dev machine timezone matched the developer's.

### N2b. A requirement the first version quietly failed

- **Member / date / tool:** all / 2026-10-22 / Arena.ai agent
- **Prompt (key excerpt):** "Compare the app against `INSTRUCTION.md` §6 (B1) line by line."
- **What the AI suggested:** the first build had `orientation: 'portrait'` (copied from the Expo template) and
  form state only in memory, so "keeps user input on rotation" was not actually satisfied.
- **What we decided and why:** unlock rotation, persist every keystroke to a `TaskDraftStore`, restore it with a
  visible notice, and prove it by rotating and reloading the running build.
- **What the AI got wrong or missed:** it inherited a template default that contradicts the grading criteria and
  never flagged it — a good reminder that "the template compiles" is not "the requirement is met".

### N4. Emoji as UI icons

- **Member / date / tool:** Tergel / 2026-10-20 / Arena.ai agent
- **Prompt (key excerpt):** "Add icons to the tab bar and the empty/error states."
- **What the AI suggested:** emoji characters (`🏠 ✅ 📚 📡`).
- **What we decided and why:** rejected after looking at the first screenshots — they rendered as `□` (no emoji
  font in the build). Replaced with an inline SVG icon set.
- **What the AI got wrong or missed:** it assumed emoji are universally available; they are not on every
  Android build or headless web renderer.

### N5. Three ways the same offline queue could silently misbehave

- **Member / date / tool:** all / 2026-10-22 / Arena.ai agent
- **Prompt (key excerpt):** "Go through the offline write path and the auto-sync hooks again; assume the user is
  unlucky, not careful, and find where data or requests can be lost or duplicated."
- **What the AI found:** (1) `Outbox.enqueue()` was a read-modify-write on one storage key, so two writes in the
  same tick kept only the last one; (2) `syncPending()` had three callers (connectivity listener, the **Đồng bộ
  ngay** button, and the app coming back to the foreground) with no guard, so a queued `create` could be POSTed
  twice; (3) the replay only ran on a connectivity *change*, so an already-online phone kept its ⏳ rows until the
  user opened Settings.
- **What we decided and why:** all three are fixed with small, testable mechanisms — a promise chain inside the
  outbox, a `syncInFlight` single-flight promise, and an `AppState === 'active'` listener — plus 12 tests that
  *fail* on the old code (the outbox test reproduced `1 of 5` operations surviving).
- **What the AI got wrong or missed:** the first version treated "the app is reliable because the tests pass" as
  done; none of the three was reachable from a single-user manual click-through, which is exactly why they needed
  code reading and a repeatable end-to-end run.
- **What we kept, changed or rejected:** _(to fill — run `npm test`, then re-introduce one of the three bugs and
  watch the new test fail; that is the fastest way to be able to defend it)_

### N6. "It works" was not the same as "it stays correct"

- **Member / date / tool:** all / 2026-10-22 / Arena.ai agent
- **Prompt (key excerpt):** "Re-read the brief and the code as if you were the grader: which of our claims could
  be false for a second under a slow network?"
- **What the AI found:** two real ordering bugs that no single click-through can show — (1) two overlapping
  `load()` calls could apply the **older** response last, so the list jumped back; (2) a background
  `revalidate()` built before the user ticked a checkbox would flip the row back when it landed. Separately, it
  noticed that the topic's *exam countdown* (`INSTRUCTION.md` §5.4) had never been built.
- **What we decided and why:** one small, testable mechanism (`RequestTracker`: request token + local-write
  version) instead of timers or cancellation plumbing, and the countdown computed in the domain layer like every
  other rule. The two regression tests were written first and **verified to fail** with the guard removed.
- **What the AI got wrong or missed:** earlier passes treated the async paths as "obviously fine because the
  happy path works"; the manual scenarios could never surface this class of bug.
- **What we kept, changed or rejected:** _(to fill — remove the `isLatest` check and run `npm test`; the two new
  tests should go red. That is the demonstration to prepare for the oral defense.)_

### N7. "The button shows a spinner" is not a guard

- **Member / date / tool:** all / 2026-10-22 / Arena.ai agent
- **Prompt (key excerpt):** "Audit every press handler for re-entry, and everything that depends on the clock."
- **What the AI found:** the save and delete buttons rendered a loading spinner, but the handlers never checked the
  in-flight flag — a second tap that lands before React re-renders the disabled button creates a duplicate task,
  and a second `DELETE` is sent for an id the server already removed (it surfaces as an error *after* a
  successful delete). Separately, every screen computed `new Date()` once at render time, so an app left open
  overnight kept saying "Hôm nay" for yesterday and showed a stale exam countdown.
- **What we decided and why:** guards belong in the view-model (`if (isSaving) return false`, `if (busy) return`)
  because the UI is only one of the callers; and a `useNow()` hook re-renders on a minute timer plus on
  foreground, which is enough for day-granularity labels and costs nothing measurable.
- **What the AI got wrong or missed:** previous passes reasoned about *rendering* (the button looks disabled)
  rather than about *events* (two presses can reach the handler before the re-render).
- **What we kept, changed or rejected:** _(to fill — comment out the `isSaving` check and run `npm test`; then tap
  save twice quickly in the running app and count the rows.)_

### N8. Two claims in our own docs that were false

- **Member / date / tool:** all / 2026-10-22 / Arena.ai agent
- **Prompt (key excerpt):** "Pick two sentences from `docs/ui-design.md` §7 and prove them with a measurement."
- **What the AI found:** "text tokens are ≥ 4.5:1" was false for five light-theme colours (3.07 – 4.39), and
  "checkboxes expose `role=checkbox` + *checked*" was false on the web build, where the element had a role and a
  label but no `aria-checked` — a screen reader could not distinguish a finished task from an open one. A third,
  quieter issue: course pills used the colour **the server sends** as text, so readability depended on data.
- **What we decided and why:** make the claim executable. The palette is now checked by a pure-maths unit test
  (34 pairs × 2 themes), the ARIA state is written twice (native `accessibilityState` + explicit `aria-*` for web,
  because react-native-web does not translate the former), and server colours are used only as tints.
- **What the AI got wrong or missed:** in earlier passes it wrote accessibility claims from the *code it intended*
  rather than from the *rendered DOM*; the whole class of bug is invisible without inspecting the output.
- **What we kept, changed or rejected:** _(to fill — lighten one token in `tokens.ts` and watch
  `theme-contrast.test.ts` fail; then delete `aria-checked` in `task-card.tsx` and watch `make e2e-web` fail.)_

### N9. The last untested module was the one that decides what the home screen says

- **Member / date / tool:** all / 2026-10-22 / Arena.ai agent
- **Prompt (key excerpt):** "Which file would I be most afraid to change live during the oral defense? Test that one first."
- **What the AI found:** `domain/schedule.ts` — ISO weekday mapping, day ordering, "next class", the Monday-based
  week — had **no tests**, although its answers change every hour and every weekday and it feeds both Today and
  Lịch học. Writing the 16 tests confirmed the rules were right, and exposed a wording bug the tests made obvious:
  `nextSession()` returns the class that is *running now* (correct, it is what the student needs) but the hero
  card labelled it "TIẾT HỌC TIẾP THEO" — and when the next class was tomorrow, it did not say so.
- **What we decided and why:** keep the domain behaviour and make it speak: `nextSessionInfo()` returns
  `{ session, ongoing, weekday }`, the card renders "ĐANG DIỄN RA" or "TIẾP THEO", and prefixes the weekday when
  the class is not today. `nextSession()` remained as a wrapper so no other caller changed.
- **What the AI got wrong or missed:** earlier passes added tests where the *new* code was, not where the *risk*
  was; the oldest, smallest module stayed untested the longest.
- **What we kept, changed or rejected:** _(to fill — change `nextSessionInfo()` to skip the running class and see
  which test fails; then decide, as a team, which behaviour you actually want and defend that choice.)_

### N10. "Perfect" meant removing a button, not adding a feature

- **Member / date / tool:** all / 2026-10-22 / Arena.ai agent
- **Prompt (key excerpt):** "Read the brief and the starter again, all of it, then make it as close to perfect as
  it can be."
- **What the AI found:** the app had all four UI states *on paper*, but two of them were lying. (1) Opening a task
  that had just been deleted on another device produced **"Không tải được dữ liệu"** with a **Thử lại** button —
  a failure message for a request that had *succeeded*, and a retry that could only ever fail again. (2)
  `AppError.canRetry` — a property with a unit test, documented in two design docs — was **never read by any
  screen**, so a 404 and an unparsable payload both got the same Retry button.
- **What we decided and why:** add one status value (`empty`) instead of inventing a new error kind, and let the
  existing `canRetry` rule decide whether `ErrorState` renders a button at all. Both changes *delete* UI rather
  than add it, which is why they are easy to defend in the oral exam.
- **What the AI got wrong or missed:** it had documented `canRetry` as if it drove the UI. Documentation that
  describes an intention instead of the code is exactly what README §8.3 is for. It had also never run
  `npm run format` — the declared Prettier config was being violated by 30 files the whole time.
- **What we kept, changed or rejected:** _(to fill — make `ErrorState` always render Retry again and watch
  `errors.test.ts` + two E2E checks fail; then argue, as a team, which behaviour a user actually wants.)_
