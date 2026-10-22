import type { Clock } from '../../core/clock';
import { toAppError } from '../../core/errors';
import type { NetworkMonitor } from '../../core/network-monitor';
import type { Course, Session, StudentProfile } from '../../domain/models';
import type {
  CourseRepository,
  Loaded,
  ProfileRepository,
  ScheduleRepository,
} from '../../domain/repositories';
import type { JsonCache } from '../local/json-cache';
import type { StudyApi } from '../remote/study-api';
import { CachedListRepository } from './cached-list-repository';

type Common = {
  api: StudyApi;
  cache: JsonCache;
  network: NetworkMonitor;
  clock: Clock;
};

export function createCourseRepository(deps: Common): CourseRepository {
  const repository = new CachedListRepository<Course>({
    cache: deps.cache,
    cacheKey: 'courses',
    clock: deps.clock,
    network: deps.network,
    fetchRemote: () => deps.api.fetchCourses(),
  });
  return {
    loadCourses: () => repository.load(),
    refreshCourses: () => repository.refresh(),
  };
}

export function createScheduleRepository(deps: Common): ScheduleRepository {
  const repository = new CachedListRepository<Session>({
    cache: deps.cache,
    cacheKey: 'sessions',
    clock: deps.clock,
    network: deps.network,
    fetchRemote: () => deps.api.fetchSessions(),
  });
  return {
    loadSessions: () => repository.load(),
    refreshSessions: () => repository.refresh(),
  };
}

const PROFILE_CACHE_KEY = 'profile';

/** The profile is a single object (not a list), so it has its own tiny repository. */
export function createProfileRepository(deps: Common): ProfileRepository {
  const load = async (): Promise<Loaded<StudentProfile>> => {
    const cached = await deps.cache.read<StudentProfile>(PROFILE_CACHE_KEY);
    if (cached) return { data: cached.value, origin: 'cache', savedAt: cached.savedAt };
    return refresh();
  };

  const refresh = async (): Promise<Loaded<StudentProfile>> => {
    try {
      const online = await deps.network.isOnline();
      if (!online) throw toAppError(new Error('Network request failed'));
      const profile = await deps.api.fetchProfile();
      const savedAt = deps.clock().getTime();
      await deps.cache.write(PROFILE_CACHE_KEY, profile, savedAt);
      return { data: profile, origin: 'network', savedAt };
    } catch (error) {
      const cached = await deps.cache.read<StudentProfile>(PROFILE_CACHE_KEY);
      if (cached) return { data: cached.value, origin: 'cache', savedAt: cached.savedAt };
      throw toAppError(error);
    }
  };

  return { loadProfile: load, refreshProfile: refresh };
}
