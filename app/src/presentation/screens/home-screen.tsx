import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { services } from '../../app/services';
import { isoWeekday, nextSessionInfo, todaySessions, weekdayLabel } from '../../domain/schedule';
import { examCountdown, nextExam, summarize, upcomingDeadlines } from '../../domain/task-rules';
import type { RootStackParamList } from '../../navigation/types';
import { ErrorState, EmptyState, LoadingState } from '../components/state-views';
import { OfflineBanner } from '../components/offline-banner';
import { SessionRow } from '../components/session-row';
import { TaskCard } from '../components/task-card';
import { Card, ProgressBar, SectionHeader, StatTile } from '../components/ui';
import { Screen } from '../components/screen';
import { HomeController } from '../controllers/home-controller';
import { formatDateTime, formatDayHeader, formatTimeRange } from '../format';
import { useNow } from '../hooks/use-now';
import { useTheme } from '../theme/theme-context';
import { useStore } from '../state/observable-store';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const theme = useTheme();

  const controller = useMemo(
    () =>
      new HomeController({
        profileRepository: services.profileRepository,
        courseRepository: services.courseRepository,
        scheduleRepository: services.scheduleRepository,
        taskRepository: services.taskRepository,
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
  const classes = todaySessions(state.sessions, now);
  const nextInfo = nextSessionInfo(state.sessions, now);
  const next = nextInfo?.session ?? null;
  // A class that is running right now is not "next": label the hero card honestly, and say
  // which day the class falls on when it is not today.
  const nextIsToday = nextInfo ? nextInfo.weekday === isoWeekday(now) : false;
  const summary = summarize(state.tasks, now);
  const deadlines = upcomingDeadlines(state.tasks, now, 3);
  const nextCourse = state.courses.find((course) => course.id === next?.courseId);
  // "Đếm ngược kỳ thi" — part of the topic (INSTRUCTION.md §5.4), computed in the domain layer.
  const exam = nextExam(state.tasks, now);
  const countdown = exam ? examCountdown(exam, now) : null;
  const examCourse = exam ? state.courses.find((course) => course.id === exam.courseId) : undefined;
  const firstName = state.profile?.name.split(' ').slice(-1)[0] ?? 'bạn';

  return (
    <Screen
      title={`Chào ${firstName}`}
      subtitle={formatDayHeader(now)}
      refreshing={state.isRefreshing}
      onRefresh={() => void controller.refresh()}
    >
      {state.status === 'loading' || state.status === 'idle' ? <LoadingState rows={4} /> : null}

      {state.status === 'error' ? (
        <ErrorState error={state.error} onRetry={() => void controller.load()} />
      ) : null}

      {state.status === 'ready' ? (
        <>
          {state.offline ? <OfflineBanner savedAt={state.savedAt} pending={state.pending} now={now} /> : null}

          {state.tasks.length === 0 && state.sessions.length === 0 ? (
            <EmptyState
              icon="inbox"
              title="Học kỳ đang trống"
              message="Thêm công việc đầu tiên để StudyMate nhắc bạn trước khi quá hạn."
              actionLabel="Thêm công việc"
              onAction={() => navigation.navigate('TaskForm', {})}
            />
          ) : (
            <>
              <Card style={{ backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }}>
                <Text style={[styles.nextLabel, { color: theme.colors.onPrimary }]}>
                  {next ? (nextInfo?.ongoing ? 'TIẾT HỌC ĐANG DIỄN RA' : 'TIẾT HỌC TIẾP THEO') : 'HÔM NAY'}
                </Text>
                {next ? (
                  <>
                    <Text style={[styles.nextTitle, { color: theme.colors.onPrimary }]}>
                      {nextCourse?.name ?? `Môn #${next.courseId}`}
                    </Text>
                    <Text style={[styles.nextMeta, { color: theme.colors.onPrimary }]}>
                      {nextIsToday ? '' : `${weekdayLabel(nextInfo?.weekday ?? 1)} · `}
                      {formatTimeRange(next.startTime, next.endTime)} · Phòng {next.room}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.nextTitle, { color: theme.colors.onPrimary }]}>
                    Không còn tiết nào hôm nay
                  </Text>
                )}
              </Card>

              <View style={styles.statsRow}>
                <StatTile label="Quá hạn" value={summary.overdue} tone="danger" />
                <StatTile label="Trong 7 ngày" value={summary.dueThisWeek} tone="warning" />
                <StatTile label="Đã xong" value={summary.done} tone="success" />
              </View>

              {exam && countdown ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Xem kỳ thi ${exam.title}, ${countdown.label.toLowerCase()}`}
                  onPress={() => navigation.navigate('TaskDetail', { taskId: exam.id })}
                >
                  <Card
                    style={{
                      gap: 8,
                      borderColor: countdown.urgent ? theme.colors.warning : theme.colors.border,
                      borderWidth: countdown.urgent ? 1.5 : 1,
                    }}
                  >
                    <View style={styles.countdownRow}>
                      <View style={styles.countdownText}>
                        <Text style={[styles.nextLabel, { color: theme.colors.textSecondary }]}>
                          ĐẾM NGƯỢC KỲ THI
                        </Text>
                        <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>
                          {exam.title}
                        </Text>
                        <Text style={[styles.helper, { color: theme.colors.textSecondary }]}>
                          {examCourse ? `${examCourse.code} · ` : ''}
                          {formatDateTime(exam.dueDate)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.countdownBadge,
                          {
                            backgroundColor: countdown.urgent
                              ? theme.colors.warningSoft
                              : theme.colors.surfaceMuted,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.countdownNumber,
                            { color: countdown.urgent ? theme.colors.warning : theme.colors.primary },
                          ]}
                        >
                          {countdown.days}
                        </Text>
                        <Text
                          style={[
                            styles.countdownUnit,
                            { color: countdown.urgent ? theme.colors.warning : theme.colors.textSecondary },
                          ]}
                        >
                          ngày
                        </Text>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              ) : null}

              <Card style={{ gap: 10 }}>
                <View style={styles.progressHeader}>
                  <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Tiến độ học kỳ</Text>
                  <Text style={[styles.progressValue, { color: theme.colors.primary }]}>
                    {Math.round(summary.completionRate * 100)}%
                  </Text>
                </View>
                <ProgressBar value={summary.completionRate} />
                <Text style={[styles.helper, { color: theme.colors.textSecondary }]}>
                  {summary.done}/{summary.total} công việc đã hoàn thành
                  {summary.dueToday > 0 ? ` · ${summary.dueToday} việc đến hạn hôm nay` : ''}
                </Text>
              </Card>

              <SectionHeader title="Lịch hôm nay" />
              {classes.length === 0 ? (
                <Card>
                  <Text style={[styles.helper, { color: theme.colors.textSecondary }]}>
                    Không có tiết học nào hôm nay. Dành thời gian cho deadline nhé!
                  </Text>
                </Card>
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

              <SectionHeader
                title="Deadline sắp tới"
                action={
                  <Text
                    onPress={() => navigation.navigate('Tabs', { screen: 'Tasks' })}
                    accessibilityRole="button"
                    style={[styles.link, { color: theme.colors.primary }]}
                  >
                    Xem tất cả
                  </Text>
                }
              />
              {deadlines.length === 0 ? (
                <Card>
                  <Text style={[styles.helper, { color: theme.colors.textSecondary }]}>
                    Không còn deadline nào đang mở. Tuyệt vời!
                  </Text>
                </Card>
              ) : (
                <View style={styles.list}>
                  {deadlines.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      course={state.courses.find((course) => course.id === task.courseId)}
                      now={now}
                      compact
                      onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
                      onToggle={() => navigation.navigate('TaskDetail', { taskId: task.id })}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  nextLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, opacity: 0.9 },
  nextTitle: { fontSize: 19, fontWeight: '700', marginTop: 6 },
  nextMeta: { fontSize: 13, marginTop: 4, opacity: 0.95 },
  statsRow: { flexDirection: 'row', gap: 8 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  countdownText: { flex: 1, gap: 3 },
  countdownBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 68,
  },
  countdownNumber: { fontSize: 26, fontWeight: '800', lineHeight: 30 },
  countdownUnit: { fontSize: 11, fontWeight: '600' },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  progressValue: { fontSize: 15, fontWeight: '700' },
  helper: { fontSize: 12, lineHeight: 18 },
  list: { gap: 8 },
  link: { fontSize: 13, fontWeight: '600' },
});
