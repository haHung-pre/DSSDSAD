# Project Proposal — Milestone M1

> Team: **StudyMate** · Course: Mobile Application Development (INT1449) · PTIT
> This document is the evidence for rubric criterion **A1 — Problem & Idea**.

---

## 1. Team & Topic

- **Team:** StudyMate — Nguyễn Đức Hà Hùng (B23DCCE039), Nguyễn Cảnh Đức Anh (B23DCCE006),
  Ariunjargal Tergel (B23DCAT500)
- **Topic:** Student Task & Schedule Manager (suggested topic #4 in `INSTRUCTION.md` §5), specialised for
  PTIT students who study two blocks a day and get deadlines announced on many different channels.

## 2. Problem

**Who has it:** second- and third-year students at PTIT (and at any university that mixes a fixed timetable
with a stream of ad-hoc deadlines).

**What the problem is.** A student's week is split between two kinds of information that live in different
places:

1. a **fixed weekly timetable** (subject, room, theory/lab) that is published once per semester as a PDF or a
   screenshot in a class group chat, and
2. **deadlines** — assignments, lab reports, mid-terms, project milestones — announced in class, in a Zalo
   group, on the LMS, or in an email, each with its own due date and priority.

Because these two live apart, the failure mode is always the same: the student knows the timetable but not the
deadline, or sees the deadline only after it has passed. The information is also **needed offline**: lecture
halls, basements and labs are exactly where the campus Wi-Fi is worst.

**How it is solved today:**

| Existing solution | Why it is not enough for this scenario |
|---|---|
| Paper notebook / whiteboard | Not searchable, not on the phone, no reminders, lost easily. |
| Phone note app (Notes, Google Keep) | A flat list: no course structure, no due-date urgency, no "what is due this week". |
| Google Calendar | Week timetable yes, but every deadline must be typed in manually; no course grouping, no offline-first assumptions, no "overdue / due today" summary. |
| Class Zalo / Messenger group | The information exists but is buried in chat; searching for "deadline" the night before is the actual user experience. |
| The LMS (web) | Requires login and network, is course-oriented rather than day-oriented, and does not show the timetable. |

## 3. Idea

**StudyMate** puts the weekly timetable and every deadline on one screen, ordered by *what is due next*.

- The **Today** screen opens on the next class and the three nearest deadlines, with a semester completion rate.
- The **Tasks** screen groups work per course with urgency-coded due dates, filters (upcoming / overdue / done)
  and one-tap completion.
- The **Timetable** screen shows the week with the current day pre-selected.
- Everything that was loaded once is **kept on the device**: the app opens and stays useful in airplane mode,
  and changes made offline are queued and pushed automatically when the network returns.
- Every data screen is explicit about its state: loading, content, empty (nothing to show, or the record is
gone) or error — with a retry button only when retrying can actually help.

What makes it more than a to-do list: the **offline-first write path** (an edit made in the basement is not
lost and is not overwritten by the next refresh) and the **urgency model** shared by every screen
(overdue → due today → this week), which is what the user actually needs in one glance.

## 4. Scope

| Must have (M3) | Nice to have | Out of scope |
|---|---|---|
| 5 functional screens: Today, Tasks (+ filters), Task detail, Create/Edit task, Timetable; plus Courses and Settings | Local notifications / reminders | Real authentication / multiple accounts |
| **Exam countdown** on Today for the next upcoming exam (part of the chosen topic, `INSTRUCTION.md` §5.4) | — | — |
| Search over tasks (title, notes, course code), offline | Weekly statistics chart | Real-time sync between devices |
| Course → task drill-down; form draft that survives rotation / app kill | Import timetable from a PDF/LMS link | Editing the timetable inside the app |
| Full CRUD on tasks through the REST API | Widgets / home-screen extensions | Push notifications backend |
| Offline cache for tasks, courses, sessions, profile | Local notifications / reminders | Editing the timetable inside the app |
| Offline write queue with automatic replay | Share a task to a classmate | iOS/Android store release |
| Four UI states on every data screen | Share a task to a classmate | — |

## 5. Users & Key Challenge

- **Target users:** PTIT students in years 2–4, one-handed use, on the way between buildings, often on a weak
  mobile connection. They open the app for a few seconds: "what do I have today, what is due next".
- **Why mobile, not a web app:** it is the device that is already in the hand in the corridor, works offline
  once data is cached, and can show the next class without a login screen.
- **Hardest part — offline sync.** The app must (a) paint instantly from a local snapshot, (b) let the user
  write while offline, and (c) not lose or duplicate those writes when the network returns, including the
  awkward case "task created offline, then edited offline, then refreshed from the server". Our answer is a
  **cache + outbox**: writes are applied to the local snapshot immediately and recorded as operations that are
  replayed in FIFO order. The trade-off (and what we deliberately do not solve) is documented in
  [`architecture.md`](architecture.md#4-offline-strategy).

## 6. Initial Design Sketch

**Main user flows**

1. *Check today* → open app → Today shows the next class + nearest deadlines → tap a deadline → detail → mark done.
2. *Add a deadline* → Tasks → `+` → pick course, type title, set due date → save (works offline) → the row
   appears in the list with a "pending sync" marker if the device was offline.
3. *Find a room* → Timetable → tap a weekday → see subject, time, room.
4. *Look something up* → Tasks → type a keyword (or a course code) → the list filters as you type; tap
   ✕ in the search field to see everything again.
5. *Focus on one subject* → Courses → tap a course card → the task list opens scoped to that course.
6. *Check progress* → Courses → per-course completion bars; Settings → connection state, pending changes, cache.

**Screens:** Today (`SCR-01`), Tasks (`SCR-02`), Task detail (`SCR-03`), Create/Edit task (`SCR-04`),
Timetable (`SCR-05`), Courses (`SCR-06`), Settings (`SCR-07`).

**Data:** four entities — `Course`, `Session` (a class in the weekly timetable), `StudyTask`, `StudentProfile`
— served by the mock REST API in `backend/` (json-server over `backend/db.json`, adapted to this domain) and
cached on the device.

**Offline:** tasks, courses, sessions and the profile are all readable offline; writes (create / update /
status change / delete) are queued in an outbox and replayed when connectivity returns; search and filters run on
the local list, so looking something up also works without a network.

**Input safety:** the create/edit form keeps a draft on the device, so a rotation, a background kill or a crash
never costs the user a half-typed deadline.

**Framework & state management (first idea):** React Native + Expo with TypeScript, strict MVVM —
React Navigation for screens, a small observable-store controller per screen as the ViewModel (instead of
shipping a third-party state library), and a repository layer over `fetch` + AsyncStorage.

## 7. Alternatives Considered

| Option | Chosen? | Why / why not |
|---|---|---|
| Flutter + Riverpod | No | Very good fit technically, but two of the three members had no Dart experience; the oral defense requires everyone to own a vertical slice. |
| Kotlin + Jetpack Compose | No | Excellent MVVM story, but needs Android Studio on every member's machine and rules out testing on iOS devices in the team. |
| **React Native (Expo) + TypeScript** | **Yes** | One language for the whole team, runs on every member's phone through Expo Go, and the same code produces the web build we use for screenshots and demos. |
| Redux Toolkit / Zustand for state | No | The app has seven screens and no cross-screen state; a per-screen controller class (plain TypeScript, unit-testable without React) is smaller and easier to explain line by line. |
| TanStack Query | No (rejected for scope) | Would give caching for free, but hides the cache/outbox logic we are graded on; we wanted to own and defend that code. |
| SQLite (expo-sqlite) for the cache | No | The dataset is small (a semester of tasks, ~10 sessions); JSON snapshots in AsyncStorage keep the data layer readable and let the same code run on web. |
| Mock API vs own backend | Mock API (`backend/db.json`) | `INSTRUCTION.md` provides json-server; it gives real HTTP, real status codes and real network failures without spending time on server code. |

## 8. Ownership Plan

Split by **vertical slices** so each member can defend a complete feature end to end
(screen → controller → repository → data source → tests).

| Member | Will own (modules / documents) | Related docs |
|---|---|---|
| Nguyễn Đức Hà Hùng | Task list + task detail slice (Tasks screen, `TasksController`, `TaskDetailController`, `TaskRepository`, outbox), `docs/architecture.md` | README §8–§9 |
| Nguyễn Cảnh Đức Anh | Today dashboard + timetable slice (`HomeController`, `TimetableController`, schedule domain rules, session/course repositories), `docs/ui-design.md` | README §8–§9 |
| Ariunjargal Tergel | Create/Edit form slice (`TaskFormController`, validation), Courses screen, Settings screen, theme/tokens, `docs/api-integration.md`, `docs/testing-guide.md` | README §8–§9 |

## 9. Risks

| Risk | Mitigation |
|---|---|
| Offline sync produces duplicates (create queued twice, refresh racing a write) | Single `Outbox` with FIFO replay, local ids prefixed `local-` and replaced by the server id after replay; covered by repository unit tests. |
| Data-layer bugs only appear on a device (timeouts, airplane mode) | Every failure path mapped to one `AppError` type and tested with a fake `fetch`; manual airplane-mode scenario in `docs/testing-guide.md`. |
| UI states skipped under time pressure | `LoadingState` / `EmptyState` / `ErrorState` are shared components, so a screen cannot "forget" a state without it being visible in review. |
| One member falls behind and cannot explain their slice in the oral defense | Slices are independent files; PRs are reviewed by another member; the AI log records who asked what. |
| json-server writes modify `backend/db.json` in the repo | `make api-reset` restores the seed data; the file is reviewed before every submission. |

## 10. Instructor Feedback

*(To be filled in after the M1 review, with the instructor's comments. Nothing to record yet.)*
