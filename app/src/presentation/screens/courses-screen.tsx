import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { services } from '../../app/services';
import { isDone, tasksForCourse } from '../../domain/task-rules';
import { CourseCard } from '../components/course-card';
import { OfflineBanner } from '../components/offline-banner';
import { Screen } from '../components/screen';
import { EmptyState, ErrorState, LoadingState } from '../components/state-views';
import { StatTile } from '../components/ui';
import type { RootStackParamList } from '../../navigation/types';
import { CoursesController } from '../controllers/courses-controller';
import { useStore } from '../state/observable-store';
import { useNow } from '../hooks/use-now';
import { useTheme } from '../theme/theme-context';

export function CoursesScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const controller = useMemo(
    () =>
      new CoursesController({
        courseRepository: services.courseRepository,
        taskRepository: services.taskRepository,
      }),
    [],
  );
  const state = useStore(controller);

  useFocusEffect(
    useCallback(() => {
      void controller.load();
    }, [controller]),
  );

  const now = useNow();
  const totalTasks = state.tasks.length;
  const doneTasks = state.tasks.filter(isDone).length;

  return (
    <Screen
      title="Môn học"
      subtitle={`${state.courses.length} môn trong học kỳ`}
      refreshing={state.isRefreshing}
      onRefresh={() => void controller.refresh()}
    >
      {state.status === 'loading' || state.status === 'idle' ? <LoadingState rows={4} /> : null}
      {state.status === 'error' ? (
        <ErrorState error={state.error} onRetry={() => void controller.load()} />
      ) : null}

      {state.status === 'ready' ? (
        <>
          {state.offline ? <OfflineBanner savedAt={null} now={now} /> : null}

          {state.courses.length === 0 ? (
            <EmptyState
              icon="book"
              title="Chưa có môn học"
              message="Học kỳ của bạn chưa có môn nào. Kiểm tra lại db.json của backend mock."
            />
          ) : (
            <>
              <View style={styles.statsRow}>
                <StatTile label="Môn học" value={state.courses.length} />
                <StatTile label="Công việc" value={totalTasks} />
                <StatTile label="Đã xong" value={doneTasks} tone="success" />
              </View>

              <View style={styles.list}>
                {state.courses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    tasks={tasksForCourse(state.tasks, course.id)}
                    onPress={() =>
                      navigation.navigate('Tabs', { screen: 'Tasks', params: { courseId: course.id } })
                    }
                  />
                ))}
              </View>

              <Text style={[styles.footer, { color: theme.colors.textSecondary }]}>
                Tiến độ được tính từ các công việc đã đánh dấu hoàn thành trong từng môn.
              </Text>
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 8 },
  list: { gap: 10 },
  footer: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
