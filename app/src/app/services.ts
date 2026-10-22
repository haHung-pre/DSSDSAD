import { appConfig, type AppConfig } from '../config/env';
import { systemClock, type Clock } from '../core/clock';
import { FetchHttpClient, type HttpClient } from '../core/http-client';
import { NetInfoMonitor } from '../core/netinfo-monitor';
import type { NetworkMonitor } from '../core/network-monitor';
import { AsyncStorageKeyValueStore } from '../data/local/async-storage';
import { JsonCache } from '../data/local/json-cache';
import type { KeyValueStore } from '../data/local/key-value-store';
import { Outbox } from '../data/local/outbox';
import { PreferencesStore } from '../data/local/preferences';
import { TaskDraftStore } from '../data/local/task-draft-store';
import { StudyApi } from '../data/remote/study-api';
import {
  createCourseRepository,
  createProfileRepository,
  createScheduleRepository,
} from '../data/repositories/catalog-repositories';
import { TaskRepositoryImpl } from '../data/repositories/task-repository';
import type {
  CourseRepository,
  ProfileRepository,
  ScheduleRepository,
  TaskRepository,
} from '../domain/repositories';

/**
 * Composition root: the single place where interfaces are bound to implementations.
 * Screens and controllers receive these objects; nothing below the UI imports a
 * concrete class from anywhere else, and tests build the same graph with fakes.
 */
export type Services = {
  config: AppConfig;
  http: HttpClient;
  api: StudyApi;
  store: KeyValueStore;
  cache: JsonCache;
  outbox: Outbox;
  preferences: PreferencesStore;
  draftStore: TaskDraftStore;
  network: NetworkMonitor;
  clock: Clock;
  taskRepository: TaskRepository;
  courseRepository: CourseRepository;
  scheduleRepository: ScheduleRepository;
  profileRepository: ProfileRepository;
};

export type ServiceOverrides = Partial<Omit<Services, 'api' | 'cache' | 'outbox'>> & {
  api?: StudyApi;
  cache?: JsonCache;
  outbox?: Outbox;
};

export function createServices(overrides: ServiceOverrides = {}): Services {
  const config = overrides.config ?? appConfig;
  const clock = overrides.clock ?? systemClock;
  const network = overrides.network ?? new NetInfoMonitor();
  const store = overrides.store ?? new AsyncStorageKeyValueStore();
  const http = overrides.http ?? new FetchHttpClient(config.apiBaseUrl, config.requestTimeoutMs);
  const api = overrides.api ?? new StudyApi(http);
  const cache = overrides.cache ?? new JsonCache(store, 'cache');
  const outbox = overrides.outbox ?? new Outbox(store);
  const preferences = overrides.preferences ?? new PreferencesStore(store);
  const draftStore = overrides.draftStore ?? new TaskDraftStore(store);

  const common = { api, cache, network, clock };

  return {
    config,
    http,
    api,
    store,
    cache,
    outbox,
    preferences,
    draftStore,
    network,
    clock,
    taskRepository: overrides.taskRepository ?? new TaskRepositoryImpl({ ...common, outbox }),
    courseRepository: overrides.courseRepository ?? createCourseRepository(common),
    scheduleRepository: overrides.scheduleRepository ?? createScheduleRepository(common),
    profileRepository: overrides.profileRepository ?? createProfileRepository(common),
  };
}

/** App-wide singleton created once at startup (see App.tsx). */
export const services: Services = createServices();
