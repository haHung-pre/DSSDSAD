import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { services } from '../../app/services';
import { isoWeekday, sessionsForDay, WEEKDAYS, weekDates } from '../../domain/schedule';
import { OfflineBanner } from '../components/offline-banner';
import { Screen } from '../components/screen';
import { SessionRow } from '../components/session-row';
import { EmptyState, ErrorState, LoadingState } from '../components/state-views';
import { Card, SectionHeader } from '../components/ui';
import { TimetableController } from '../controllers/timetable-controller';
import { pad } from '../format';
import { useStore } from '../state/observable-store';
import { useNow } from '../hooks/use-now';
import { useTheme } from '../theme/theme-context';

export function TimetableScreen() {
  const theme = useTheme();

  const controller = useMemo(
    () =>
      new TimetableController({
        scheduleRepository: services.scheduleRepository,
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

  const now = useNow();
  const today = isoWeekday(now);
  const dates = weekDates(now);
  const classes = sessionsForDay(state.sessions, state.selectedDay);
  const selectedLabel = WEEKDAYS.find((day) => day.index === state.selectedDay)?.label ?? '';

  return (
    <Screen
      title="Lịch học"
      subtitle="Thời khoá biểu tuần này"
      refreshing={state.isRefreshing}
      onRefresh={() => void controller.refresh()}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.weekScroll}
        contentContainerStyle={styles.weekRow}
      >
        {dates.map((entry) => {
          const isSelected = entry.dayOfWeek === state.selectedDay;
          const isToday = entry.dayOfWeek === today;
          const weekday = WEEKDAYS.find((day) => day.index === entry.dayOfWeek);

          return (
            <Pressable
              key={entry.dayOfWeek}
              onPress={() => controller.selectDay(entry.dayOfWeek)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              aria-pressed={isSelected}
              accessibilityLabel={`${weekday?.label}, ${entry.date.getDate()}`}
              style={({ pressed }) => [
                styles.dayChip,
                {
                  backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
                  borderColor: isToday ? theme.colors.primary : theme.colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.dayLabel,
                  { color: isSelected ? theme.colors.onPrimary : theme.colors.textSecondary },
                ]}
              >
                {weekday?.short}
              </Text>
              <Text
                style={[
                  styles.dayNumber,
                  { color: isSelected ? theme.colors.onPrimary : theme.colors.textPrimary },
                ]}
              >
                {pad(entry.date.getDate())}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {state.status === 'loading' || state.status === 'idle' ? <LoadingState rows={3} /> : null}
      {state.status === 'error' ? (
        <ErrorState error={state.error} onRetry={() => void controller.load()} />
      ) : null}

      {state.status === 'ready' ? (
        <>
          {state.offline ? <OfflineBanner savedAt={null} now={now} /> : null}

          <SectionHeader title={`${selectedLabel} · ${classes.length} tiết`} />

          {classes.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="Không có tiết học"
              message={`${selectedLabel} không có lịch. Chọn ngày khác trong tuần để xem tiếp.`}
            />
          ) : (
            <View style={styles.list}>
              {classes.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  course={state.courses.find((course) => course.id === session.courseId)}
                />
              ))}
            </View>
          )}

          <Card style={{ gap: 6, marginTop: 8 }}>
            <Text style={[styles.noteTitle, { color: theme.colors.textPrimary }]}>Tổng quan tuần</Text>
            <Text style={[styles.note, { color: theme.colors.textSecondary }]}>
              {state.sessions.length} tiết học thuộc {state.courses.length} môn. Lịch được tải từ máy chủ và
              lưu lại để xem khi không có mạng.
            </Text>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  weekRow: { gap: 8, paddingVertical: 4, paddingRight: 8, alignItems: 'flex-start' },
  weekScroll: { flexGrow: 0 },
  dayChip: {
    width: 52,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  dayLabel: { fontSize: 11, fontWeight: '600' },
  dayNumber: { fontSize: 16, fontWeight: '700' },
  list: { gap: 8 },
  noteTitle: { fontSize: 14, fontWeight: '700' },
  note: { fontSize: 12, lineHeight: 18 },
});
