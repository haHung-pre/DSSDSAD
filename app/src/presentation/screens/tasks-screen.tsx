import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { services } from '../../app/services';
import { filterTasks, isDone, isOverdue, searchTasks, TASK_FILTERS } from '../../domain/task-rules';
import type { RootStackParamList, TabParamList } from '../../navigation/types';
import { FilterChips } from '../components/filter-chips';
import { InlineNotice, OfflineBanner } from '../components/offline-banner';
import { Icon } from '../components/icons';
import { Screen } from '../components/screen';
import { EmptyState, ErrorState, LoadingState } from '../components/state-views';
import { TaskCard } from '../components/task-card';
import { TasksController } from '../controllers/tasks-controller';
import { useStore } from '../state/observable-store';
import { useNow } from '../hooks/use-now';
import { useTheme } from '../theme/theme-context';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function TasksScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<TabParamList, 'Tasks'>>();
  const theme = useTheme();
  const [searchFocused, setSearchFocused] = useState(false);

  const controller = useMemo(
    () =>
      new TasksController({
        taskRepository: services.taskRepository,
        courseRepository: services.courseRepository,
        clock: services.clock,
      }),
    [],
  );
  const state = useStore(controller);

  useFocusEffect(
    useCallback(() => {
      void controller.load();
    }, [controller]),
  );

  // Deep link from a course card: navigates with { courseId }.
  const routeCourseId = route.params?.courseId ?? null;
  React.useEffect(() => {
    controller.setCourse(routeCourseId);
  }, [controller, routeCourseId]);

  const now = useNow();
  const scoped =
    state.courseId === null ? state.tasks : state.tasks.filter((task) => task.courseId === state.courseId);
  const matching = searchTasks(scoped, state.query, state.courses);
  const visible = filterTasks(matching, state.filter, now);
  const courseInScope =
    state.courseId === null ? null : state.courses.find((course) => course.id === state.courseId);

  const counts = {
    all: scoped.length,
    upcoming: scoped.filter((task) => !isDone(task) && !isOverdue(task, now)).length,
    overdue: scoped.filter((task) => isOverdue(task, now)).length,
    done: scoped.filter(isDone).length,
  };

  const chips = TASK_FILTERS.map((filter) => ({
    key: filter.key,
    label: filter.label,
    count: counts[filter.key],
  }));

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <Screen title="Công việc" subtitle="Đang tải danh sách…">
        <LoadingState rows={5} />
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen title="Công việc" subtitle="Không tải được dữ liệu">
        <ErrorState error={state.error} onRetry={() => void controller.load()} />
      </Screen>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <View style={[styles.header, { paddingHorizontal: theme.layout.screenPadding }]}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Công việc</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            {state.query.trim().length > 0
              ? `${visible.length}/${scoped.length} kết quả cho "${state.query.trim()}"`
              : counts.all === 0
                ? 'Chưa có công việc nào'
                : `${counts.upcoming} đang mở · ${counts.overdue} quá hạn · ${counts.done} đã xong`}
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('TaskForm', {})}
          accessibilityRole="button"
          accessibilityLabel="Thêm công việc"
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: theme.colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Icon name="plus" size={22} color={theme.colors.onPrimary} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: theme.layout.screenPadding, gap: 10, paddingBottom: 8 }}>
        <TextInput
          value={state.query}
          onChangeText={controller.setQuery}
          placeholder="Tìm theo tên, ghi chú hoặc mã môn…"
          placeholderTextColor={theme.colors.textSecondary}
          accessibilityLabel="Tìm công việc"
          autoCorrect={false}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={[
            styles.search,
            {
              color: theme.colors.textPrimary,
              backgroundColor: theme.colors.surface,
              borderColor: searchFocused ? theme.colors.primary : theme.colors.border,
              // keep the browser's focus ring from doubling the border on web
              outlineWidth: 0,
            },
          ]}
        />
        {courseInScope ? (
          <View style={styles.scopeRow}>
            <Text style={[styles.scopeText, { color: theme.colors.textSecondary }]}>Đang lọc theo môn</Text>
            <Text
              onPress={() => navigation.navigate('Tabs', { screen: 'Tasks', params: {} })}
              accessibilityRole="button"
              accessibilityLabel={`Bỏ lọc môn ${courseInScope.code}`}
              style={[styles.scopeChip, { color: courseInScope.color, borderColor: courseInScope.color }]}
            >
              {courseInScope.code} ✕
            </Text>
          </View>
        ) : null}
        <FilterChips options={chips} selected={state.filter} onSelect={controller.setFilter} />
        {state.offline ? <OfflineBanner savedAt={state.savedAt} pending={state.pending} now={now} /> : null}
        {state.actionError ? (
          <InlineNotice
            tone="error"
            message={state.actionError.userMessage}
            onDismiss={controller.clearActionError}
          />
        ) : null}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(task) => task.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingHorizontal: theme.layout.screenPadding, paddingBottom: 96 },
        ]}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        refreshControl={
          <RefreshControl
            refreshing={state.isRefreshing}
            onRefresh={() => void controller.refresh()}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            course={state.courses.find((course) => course.id === item.courseId)}
            now={now}
            busy={state.busyTaskIds.includes(item.id)}
            onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}
            onToggle={() => void controller.toggleDone(item.id)}
          />
        )}
        ListEmptyComponent={
          state.query.trim().length > 0 ? (
            <EmptyState
              icon="search"
              title="Không tìm thấy công việc"
              message={`Không có kết quả cho "${state.query.trim()}". Thử từ khoá khác hoặc xoá ô tìm kiếm.`}
              actionLabel="Xoá tìm kiếm"
              onAction={() => controller.setQuery('')}
            />
          ) : state.filter === 'all' ? (
            <EmptyState
              icon="inbox"
              title="Chưa có công việc nào"
              message="Tạo công việc đầu tiên để không bỏ lỡ deadline nào."
              actionLabel="Thêm công việc"
              onAction={() => navigation.navigate('TaskForm', {})}
            />
          ) : (
            <EmptyState
              icon="tasks"
              title="Không có mục nào ở đây"
              message="Thử chọn bộ lọc khác để xem các công việc còn lại."
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  subtitle: { fontSize: 13 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { flexGrow: 1, paddingTop: 4 },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scopeText: { fontSize: 12 },
  scopeChip: {
    fontSize: 12,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
});
