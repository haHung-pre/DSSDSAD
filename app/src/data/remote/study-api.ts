import type { HttpClient } from '../../core/http-client';
import type { Course, Session, StudentProfile, StudyTask, TaskInput, TaskPatch } from '../../domain/models';
import { mapCourses, mapProfile, mapSessions, mapTask, mapTasks } from '../mappers';

export type TaskDto = Record<string, unknown>;

/**
 * Thin typed wrapper around the REST endpoints. No caching, no retries, no error
 * translation beyond what `FetchHttpClient` already does — repositories own policy.
 *
 * Endpoints (json-server conventions, see docs/api-integration.md):
 *   GET    /tasks?_sort=dueDate
 *   POST   /tasks
 *   PATCH  /tasks/:id
 *   DELETE /tasks/:id
 *   GET    /courses /sessions /profile
 */
export class StudyApi {
  constructor(private readonly http: HttpClient) {}

  async fetchTasks(): Promise<StudyTask[]> {
    return mapTasks(await this.http.get<TaskDto[]>('/tasks?_sort=dueDate'));
  }

  async createTask(input: TaskInput): Promise<StudyTask> {
    return mapTask(await this.http.post<TaskDto>('/tasks', input));
  }

  async updateTask(id: string, patch: TaskPatch): Promise<StudyTask> {
    return mapTask(await this.http.patch<TaskDto>(`/tasks/${id}`, patch));
  }

  async deleteTask(id: string): Promise<void> {
    await this.http.delete(`/tasks/${id}`);
  }

  async fetchCourses(): Promise<Course[]> {
    return mapCourses(await this.http.get<unknown>('/courses'));
  }

  async fetchSessions(): Promise<Session[]> {
    return mapSessions(await this.http.get<unknown>('/sessions'));
  }

  async fetchProfile(): Promise<StudentProfile> {
    return mapProfile(await this.http.get<unknown>('/profile'));
  }
}
