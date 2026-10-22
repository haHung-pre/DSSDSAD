import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { services } from '../../app/services';
import type { TaskPriority, TaskType } from '../../domain/models';
import { TASK_PRIORITIES, TASK_TYPES } from '../../domain/models';
import type { RootStackParamList } from '../../navigation/types';
import { PrimaryButton } from '../components/buttons';
import { FilterChips } from '../components/filter-chips';
import { InlineNotice } from '../components/offline-banner';
import { Screen } from '../components/screen';
import { EmptyState, ErrorState, LoadingState } from '../components/state-views';
import { Card } from '../components/ui';
import { TaskFormController, type TaskFormValues } from '../controllers/task-form-controller';
import { TASK_PRIORITY_LABELS, TASK_TYPE_LABELS } from '../format';
import { useStore } from '../state/observable-store';
import { useTheme } from '../theme/theme-context';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskForm'>;

/**
 * Create / edit form. All validation and saving goes through `TaskFormController`,
 * so the screen itself only renders fields and forwards events.
 */
export function TaskFormScreen({ route, navigation }: Props) {
  const taskId = route.params?.taskId;
  const theme = useTheme();

  const controller = useMemo(
    () =>
      new TaskFormController({
        taskRepository: services.taskRepository,
        courseRepository: services.courseRepository,
        draftStore: services.draftStore,
        clock: services.clock,
      }),
    [],
  );
  const state = useStore(controller);

  useEffect(() => {
    void controller.init(taskId);
  }, [controller, taskId]);

  const field = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) =>
    controller.setField(key, value);

  const submit = async () => {
    const saved = await controller.save();
    if (saved) navigation.goBack();
  };

  return (
    <Screen
      title={taskId ? 'Sửa công việc' : 'Thêm công việc'}
      subtitle="Điền hạn chót để nhận nhắc nhở đúng lúc"
    >
      {state.status === 'loading' ? <LoadingState rows={4} /> : null}
      {state.status === 'error' ? (
        <ErrorState
          error={state.error}
          onRetry={() => void controller.init(taskId)}
          onBack={() => navigation.goBack()}
        />
      ) : null}
      {state.status === 'empty' ? (
        <EmptyState
          icon="inbox"
          title="Không tìm thấy công việc cần sửa"
          message="Công việc này đã bị xoá ở nơi khác, nên không còn gì để cập nhật."
          actionLabel="Quay lại danh sách"
          onAction={() => navigation.goBack()}
        />
      ) : null}

      {state.status === 'ready' ? (
        <>
          {state.saveError ? <InlineNotice tone="error" message={state.saveError.userMessage} /> : null}
          {state.draftRestored ? (
            <InlineNotice
              tone="info"
              message="Đã khôi phục bản nháp bạn đang nhập dở."
              onDismiss={controller.discardDraft}
            />
          ) : null}

          <Card style={{ gap: 6 }}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Tên công việc *</Text>
            <TextInput
              value={state.values.title}
              onChangeText={(text) => field('title', text)}
              placeholder="Ví dụ: Nộp báo cáo bài tập tuần 5"
              placeholderTextColor={theme.colors.textSecondary}
              accessibilityLabel="Tên công việc"
              style={[
                styles.input,
                {
                  color: theme.colors.textPrimary,
                  borderColor: state.errors.title ? theme.colors.error : theme.colors.border,
                  backgroundColor: theme.colors.surfaceMuted,
                },
              ]}
            />
            {state.errors.title ? (
              <Text style={[styles.error, { color: theme.colors.error }]}>{state.errors.title}</Text>
            ) : null}
          </Card>

          <Card style={{ gap: 8 }}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Môn học *</Text>
            <FilterChips
              options={state.courses.map((course) => ({
                key: String(course.id),
                label: course.code,
              }))}
              selected={state.values.courseId === null ? '' : String(state.values.courseId)}
              onSelect={(key) => field('courseId', Number(key))}
            />
            {state.errors.courseId ? (
              <Text style={[styles.error, { color: theme.colors.error }]}>{state.errors.courseId}</Text>
            ) : null}
          </Card>

          <Card style={{ gap: 8 }}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Hạn chót *</Text>
            <TextInput
              value={state.values.dueDateText}
              onChangeText={(text) => field('dueDateText', text)}
              placeholder="2026-10-31 17:00"
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="none"
              accessibilityLabel="Hạn chót, định dạng năm-tháng-ngày giờ"
              style={[
                styles.input,
                {
                  color: theme.colors.textPrimary,
                  borderColor: state.errors.dueDate ? theme.colors.error : theme.colors.border,
                  backgroundColor: theme.colors.surfaceMuted,
                },
              ]}
            />
            {state.errors.dueDate ? (
              <Text style={[styles.error, { color: theme.colors.error }]}>{state.errors.dueDate}</Text>
            ) : null}
            <View style={styles.quickRow}>
              {[
                { label: 'Hôm nay', days: 0 },
                { label: 'Ngày mai', days: 1 },
                { label: '3 ngày', days: 3 },
                { label: '1 tuần', days: 7 },
              ].map((quick) => (
                <Text
                  key={quick.label}
                  onPress={() => controller.setQuickDueDate(quick.days)}
                  accessibilityRole="button"
                  style={[
                    styles.quickChip,
                    { color: theme.colors.primary, borderColor: theme.colors.border },
                  ]}
                >
                  {quick.label}
                </Text>
              ))}
            </View>
          </Card>

          <Card style={{ gap: 8 }}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Loại công việc</Text>
            <FilterChips
              options={TASK_TYPES.map((type) => ({ key: type, label: TASK_TYPE_LABELS[type] }))}
              selected={state.values.type}
              onSelect={(value) => field('type', value as TaskType)}
            />
          </Card>

          <Card style={{ gap: 8 }}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Mức ưu tiên</Text>
            <FilterChips
              options={TASK_PRIORITIES.map((priority) => ({
                key: priority,
                label: TASK_PRIORITY_LABELS[priority],
              }))}
              selected={state.values.priority}
              onSelect={(value) => field('priority', value as TaskPriority)}
            />
          </Card>

          <Card style={{ gap: 6 }}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Ghi chú</Text>
            <TextInput
              value={state.values.description}
              onChangeText={(text) => field('description', text)}
              placeholder="Yêu cầu, tài liệu tham khảo, link nộp bài…"
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              numberOfLines={4}
              accessibilityLabel="Ghi chú"
              style={[
                styles.input,
                styles.multiline,
                {
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surfaceMuted,
                },
              ]}
            />
          </Card>

          <PrimaryButton
            label={taskId ? 'Lưu thay đổi' : 'Tạo công việc'}
            onPress={() => void submit()}
            loading={state.isSaving}
          />
          <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
            Không có mạng? Công việc vẫn được lưu trên máy và tự đồng bộ khi kết nối lại.
          </Text>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  error: { fontSize: 12 },
  quickRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  quickChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
  hint: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
