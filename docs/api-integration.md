# API Integration

> Describes the REST API the app consumes and how the data layer handles it.
> Implementation: `app/src/config/env.ts`, `app/src/core/http-client.ts`, `app/src/data/remote/study-api.ts`,
> `app/src/data/mappers.ts`. Backend: `backend/db.json` (json-server 0.17).

---

## 1. Client Configuration

- **Base URL source** — a chain, with no literal in the app code:

  ```text
  .env (EXPO_PUBLIC_API_URL)  →  app.config.ts (extra.apiBaseUrl)  →  src/config/env.ts (appConfig.apiBaseUrl)
  ```

  When `EXPO_PUBLIC_API_URL` is empty the per-platform development default applies
  (`src/config/env.ts` → `platformDefaultBaseUrl()`):

  | App runs on | Default base URL | Why |
  |---|---|---|
  | Android emulator | `http://10.0.2.2:3000` | `10.0.2.2` is the host loopback alias of the emulator |
  | iOS simulator | `http://localhost:3000` | shares the host network |
  | Web preview | `/api` | `scripts/preview.mjs` proxies `/api/*` → `http://127.0.0.1:3000` (no CORS) |
  | Physical device | `http://<computer-LAN-IP>:3000` via `EXPO_PUBLIC_API_URL` | documented in `GETTING_STARTED.md` |

  Trailing slashes are stripped once (`stripTrailingSlash`) so paths never become `//tasks`.

- **Timeouts** — one timeout, `EXPO_PUBLIC_API_TIMEOUT_MS` (default **8000 ms**), applied per request through
  `AbortController`. React Native's `fetch` has no native timeout, so without the abort a request on a flaky
  network can spin forever.
- **Shared client** — a single `FetchHttpClient` instance is created in the composition root
  (`src/app/services.ts`) and injected into `StudyApi`; repositories receive `StudyApi`. No screen constructs a
  request.
- **Headers / interceptors** — `Accept: application/json` always, `Content-Type: application/json` when a body
  exists. No auth header (no accounts in scope). Error normalisation plays the role of a response interceptor.
- **Connectivity pre-check** — `NetInfoMonitor.isOnline()` runs before a request so the common case (airplane
  mode) fails fast with `AppError.kind = 'offline'` instead of waiting for a socket timeout.

---

## 2. Endpoints Used

The mock API exposes every top-level key of `backend/db.json` as a REST resource. The app uses:

| Method | Path | Used by (screen / repository) | Request | Response |
|:------:|------|-------------------------------|---------|----------|
| `GET` | `/tasks?_sort=dueDate` | Tasks, Today, Detail, Courses → `TaskRepositoryImpl.refreshTasks` | – | `StudyTask[]` |
| `POST` | `/tasks` | Create form → `TaskRepositoryImpl.createTask` | `TaskInput` JSON | created `StudyTask` (with `id`) |
| `PATCH` | `/tasks/:id` | Edit form, checkbox toggle, detail → `updateTask` / `setTaskStatus` | partial `TaskInput` | updated `StudyTask` |
| `DELETE` | `/tasks/:id` | Detail → `deleteTask` | – | `{}` |
| `GET` | `/courses` | Courses, Today, Timetable → `CourseRepository.refreshCourses` | – | `Course[]` |
| `GET` | `/sessions` | Timetable, Today → `ScheduleRepository.refreshSessions` | – | `Session[]` |
| `GET` | `/profile` | Today → `ProfileRepository.refreshProfile` | – | `StudentProfile` (single object) |

There is deliberately **no `GET /tasks/:id`** in the client: the detail screen resolves its task from the
already-loaded list, which is exactly what makes it work in airplane mode. A per-id request would paint a
spinner instead of the cached task the list already holds. `StudyApi.fetchTask()` existed for a while and was
removed once no caller used it — dead endpoints are dead code.

Writing through the mock modifies `backend/db.json` itself; `make api-reset` (or
`git checkout backend/db.json`) restores the seed data.

The API also supports `?_page=&_limit=`, `?q=`, `?_sort=&_order=`, `?field=value` and `?_embed=`. The app only
uses `_sort` today: **search and filtering run on the cached list** (`domain/task-rules.ts`) so that they keep
working offline — a request per keystroke would make the search useless exactly where the app is needed most.
Server-side `?q=` and pagination become worthwhile only when the dataset outgrows a semester of tasks.

---

## 3. Data Models

| Model | Fields | Source | Notes (mapping, validation) |
|-------|--------|--------|-----------------------------|
| `Course` | `id, code, name, lecturer, credits, color, room` | `GET /courses` | `color` is a hex token rendered in pills, timetable bars and progress bars; `name` falls back to `"Môn học"` |
| `Session` | `id, courseId, dayOfWeek (1–7), startTime "HH:mm", endTime, room, type` | `GET /sessions` | `dayOfWeek` is clamped to 1…7; `type` is normalised to `Lecture \| Lab \| Tutorial` |
| `StudyTask` | `id, courseId, title, description, type, dueDate, priority, status, createdAt, updatedAt` (+ client-only `pendingSync`) | `GET /tasks`, `POST`, `PATCH` | `dueDate/createdAt/updatedAt` are normalised to ISO-8601 (invalid → `parse` error, `createdAt` falls back to `dueDate`); `type ∈ Assignment\|Exam\|Project\|Reading`, `priority ∈ Low\|Medium\|High`, `status ∈ todo\|doing\|done` with fallbacks |
| `StudentProfile` | `id, name, studentId, className, faculty, semester, avatar` | `GET /profile` | Read-only; every field has a display fallback (`—`) so a partial object cannot break the Today screen |
| `TaskInput` | `courseId, title, description, type, dueDate, priority, status?` | client → `POST/PATCH` | Produced by the form after validation; `dueDate` is converted from local time to ISO by `parseDueInput` |

Mapping is done by explicit functions in `data/mappers.ts` (`mapTask`, `mapCourses`, `mapSessions`,
`mapProfile`), never by casting JSON to a TypeScript type: the compiler is not a runtime validator, and a real
backend will eventually send something unexpected.

---

## 4. Error Handling

Every failure below becomes one `AppError` (`app/src/core/errors.ts`) with a `kind`, a Vietnamese
`userMessage` and a `canRetry` flag. Screens render `userMessage`; `technicalMessage` goes to logs only.

| Situation | How it is detected | What the user sees |
|-----------|-------------------|--------------------|
| No network (airplane mode, Wi-Fi off) | `NetInfoMonitor.isOnline() === false`, or `fetch` rejects with `TypeError: Network request failed` → `kind: 'offline'` | Cached data + banner "Đang dùng dữ liệu lưu ngoại tuyến…", or (no cache) error state "Không có kết nối mạng. Kiểm tra Wi-Fi/4G rồi thử lại." + **Thử lại** |
| Timeout | `AbortController` fires after `EXPO_PUBLIC_API_TIMEOUT_MS` → `AbortError` → `kind: 'timeout'` | "Máy chủ phản hồi quá chậm. Vui lòng thử lại." + **Thử lại** |
| 4xx — bad request / not found / forbidden / rate limit | `response.ok === false` → `AppError.http(status)` | 404: "Không tìm thấy dữ liệu cần tìm."; 400/422: "Dữ liệu gửi đi chưa hợp lệ."; 401/403: "Bạn không có quyền thực hiện thao tác này." Repeating these requests cannot change the answer, so `canRetry = false` and the screen shows *Quay lại* plus an explanation instead of **Thử lại**; 408/429 stay retryable |
| 5xx — server error / server down (`make api-down`) | `AppError.http(5xx)`, `canRetry = true` | "Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút." + **Thử lại**; cached data is used when present |
| Malformed response body | `JSON.parse` fails → `kind: 'parse'` | "Dữ liệu nhận được không hợp lệ." — `canRetry = false`, so **no Retry button**: a repeated request returns the same body |
| Malformed object shape | mapper validation (`mapTask` requires `id` + `title`, valid dates) | Same `parse` message, no Retry button; the technical message names the field |
| A record that no longer exists (deleted on another device) | the load succeeds, the id is simply absent | `status: 'empty'` → "Công việc không còn tồn tại" + *Quay lại danh sách*. Not an error, so no Retry loop |
| Storage failure (cache/outbox) | AsyncStorage rejects → `kind: 'storage'` | "Không đọc được dữ liệu trên thiết bị." (Settings offers "Xoá dữ liệu lưu offline") |
| Failed *write* while online (4xx/5xx) | Repository re-throws and rolls back the optimistic change | Inline banner in the list/detail/form, e.g. "Dữ liệu gửi đi chưa hợp lệ." — the row returns to its previous state |
| Failed *write* while offline | `kind: 'offline'` → queued in the outbox | No error: the row shows ⏳ and the banner counts pending changes ("1 thay đổi đang chờ đồng bộ") |

**Fail fast, and say which field.** The mappers (`app/src/data/mappers.ts`) are the only place where untrusted
JSON becomes a domain object, and they answer three questions explicitly:

| Question | Decision | Why |
|---|---|---|
| A required field is missing / blank / an impossible date | Throw one `parse` `AppError` naming the field (`task.dueDate is not a valid date: "…"`) | The alternative is `undefined` or `Invalid Date` surfacing three screens later; the message is actionable when you are debugging against a real backend |
| An enum value is unknown (`type: "Homework"`, `status: "archived"`) | Fall back to a safe default (`Assignment` / `todo`) | An unknown label must never reach the UI as raw server text; the task stays usable |
| Ids arrive as numbers, dates in another timezone | Coerce the id to string, normalise every date to ISO-8601 | Local comparisons (`sortTasks`, `isOverdue`) then work identically on cache and network data |
| One row in a list is broken | The whole list becomes an error state, not a half-rendered list | A list silently missing its overdue task is worse than an honest "Thử lại" — the failure is visible in the first demo, not after the deadline |

The first three are covered by `src/data/__tests__/mappers.test.ts` (12 cases) and the fourth by `make e2e-web`
(*A malformed payload shows the error state instead of crashing*).

**Rule we follow:** no technical text ever reaches the user. `SocketTimeoutException: failed to connect to
/10.0.2.2 (port 3000)` is logged as `technicalMessage` and rendered as "Máy chủ phản hồi quá chậm…".

Evidence of these paths: `app/src/core/__tests__/http-client.test.ts` (timeout, 404, 500, malformed JSON,
network failure, body serialisation) and `docs/testing-guide.md` (manual scenarios with screenshots).
