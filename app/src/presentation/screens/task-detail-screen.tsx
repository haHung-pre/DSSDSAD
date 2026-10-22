import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { services } from '../../app/services';
import { dueLabel, isDone } from '../../domain/task-rules';
import type { RootStackParamList } from '../../navigation/types';
import { DangerButton, PrimaryButton, SecondaryButton } from '../components/buttons';
import { InlineNotice } from '../components/offline-banner';
import { Screen } from '../components/screen';
import { EmptyState, ErrorState, LoadingState } from '../components/state-views';
import { Card, Divider, Pill } from '../components/ui';
import { TaskDetailController } from '../controllers/task-detail-controller';
import { formatDateTime, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, TASK_TYPE_LABELS } from '../format';
import { useStore } from '../state/observable-store';
import { useNow } from '../hooks/use-now';
import { useTheme } from '../theme/theme-context';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskDetail'>;

export function TaskDetailScreen({ route, navigation }: Props) {
  const { taskId } = route.params;
  const theme = useTheme();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const controller = useMemo(
    () =>
      new TaskDetailController(taskId, {
        taskRepository: services.taskRepository,
        courseRepository: services.courseRepository,
      }),
    [taskId],
  );
  const state = useStore(controller);

  useFocusEffect(
    useCallback(() => {
      void controller.load();
    }, [controller]),
  );

  const now = useNow();
  const task = state.task;
  const course = controller.courseOf(task);

  return (
    <Screen
      title={task?.title ?? 'Chi tiết công việc'}
      subtitle={course ? `${course.code} · ${course.name}` : undefined}
    >
      {state.status === 'loading' ? <LoadingState rows={4} /> : null}
      {state.status === 'error' ? (
        <ErrorState
          error={state.error}
          onRetry={() => void controller.load()}
          onBack={() => navigation.goBack()}
        />
      ) : null}
      {state.status === 'empty' ? (
        // The list and the server agreed on the task a moment ago; it is gone now (deleted on
        // another device, or a stale link). Nothing to retry — send the user back to the list.
        <EmptyState
          icon="inbox"
          title="Công việc không còn tồn tại"
          message="Có thể công việc đã bị xoá trên thiết bị khác. Danh sách sẽ được tải lại khi bạn quay về."
          actionLabel="Quay lại danh sách"
          onAction={() => navigation.goBack()}
        />
      ) : null}

      {state.status === 'ready' && task ? (
        <>
          {state.actionError ? (
            <InlineNotice
              tone="error"
              message={state.actionError.userMessage}
              onDismiss={controller.clearActionError}
            />
          ) : null}

          <Card style={{ gap: 12 }}>
            <View style={styles.pills}>
              <Pill
                label={TASK_STATUS_LABELS[task.status]}
                color={isDone(task) ? theme.colors.success : theme.colors.primary}
                background={isDone(task) ? theme.colors.successSoft : theme.colors.primarySoft}
              />
              <Pill label={TASK_TYPE_LABELS[task.type]} bordered />
              <Pill
                label={`Ưu tiên ${TASK_PRIORITY_LABELS[task.priority]}`}
                color={
                  task.priority === 'High'
                    ? theme.colors.error
                    : task.priority === 'Medium'
                      ? theme.colors.warning
                      : theme.colors.textSecondary
                }
                background={theme.colors.surfaceMuted}
              />
              {task.pendingSync ? (
                <Pill
                  label="Chờ đồng bộ"
                  color={theme.colors.warning}
                  background={theme.colors.warningSoft}
                />
              ) : null}
            </View>

            <Divider />

            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: theme.colors.textSecondary }]}>Hạn chót</Text>
              <Text style={[styles.rowValue, { color: theme.colors.textPrimary }]}>
                {formatDateTime(task.dueDate)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: theme.colors.textSecondary }]}>Còn lại</Text>
              <Text style={[styles.rowValue, { color: theme.colors.textPrimary }]}>
                {dueLabel(task, now)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: theme.colors.textSecondary }]}>Môn học</Text>
              <Text style={[styles.rowValue, { color: theme.colors.textPrimary }]}>
                {course ? `${course.code} · ${course.name}` : '—'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: theme.colors.textSecondary }]}>Hình thức</Text>
              <Text style={[styles.rowValue, { color: theme.colors.textPrimary }]}>
                {TASK_TYPE_LABELS[task.type]}
              </Text>
            </View>
          </Card>

          <Card style={{ gap: 8 }}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Ghi chú</Text>
            <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
              {task.description.trim().length > 0 ? task.description : 'Chưa có ghi chú cho công việc này.'}
            </Text>
          </Card>

          <View style={styles.actions}>
            <PrimaryButton
              label={isDone(task) ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành'}
              onPress={() => void controller.toggleDone()}
              loading={state.busy}
            />
            <SecondaryButton
              label="Sửa công việc"
              onPress={() => navigation.navigate('TaskForm', { taskId: task.id })}
            />
            {confirmDelete ? (
              <Card style={{ gap: 10, borderColor: theme.colors.error }}>
                <Text style={[styles.confirmText, { color: theme.colors.textPrimary }]}>
                  Xoá công việc này? Thao tác sẽ được đồng bộ khi có mạng.
                </Text>
                <View style={styles.confirmRow}>
                  <DangerButton
                    label="Xoá"
                    onPress={async () => {
                      const ok = await controller.remove();
                      if (ok) navigation.goBack();
                    }}
                    style={{ flex: 1 }}
                  />
                  <SecondaryButton label="Huỷ" onPress={() => setConfirmDelete(false)} style={{ flex: 1 }} />
                </View>
              </Card>
            ) : (
              <DangerButton label="Xoá công việc" onPress={() => setConfirmDelete(true)} />
            )}
          </View>

          <Text style={[styles.footer, { color: theme.colors.textSecondary }]}>
            Cập nhật lần cuối: {formatDateTime(task.updatedAt)}
          </Text>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  rowLabel: { fontSize: 13 },
  rowValue: { fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  description: { fontSize: 14, lineHeight: 21 },
  actions: { gap: 10 },
  confirmText: { fontSize: 14 },
  confirmRow: { flexDirection: 'row', gap: 10 },
  footer: { fontSize: 11, textAlign: 'center', marginTop: 4 },
});
