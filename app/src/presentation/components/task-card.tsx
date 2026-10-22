import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Course, StudyTask } from '../../domain/models';
import { dueLabel, isDone, isOverdue } from '../../domain/task-rules';
import { TASK_TYPE_LABELS } from '../format';
import { useTheme } from '../theme/theme-context';
import { priorityColors } from '../theme/tokens';
import { Icon } from './icons';
import { Pill } from './ui';

type Props = {
  task: StudyTask;
  course?: Course;
  now: Date;
  busy?: boolean;
  onPress: () => void;
  onToggle?: () => void;
  compact?: boolean;
};

/**
 * One task row: checkbox, title, course badge, type and due label.
 * The due label colour encodes urgency (overdue / today / later) so the list can be
 * scanned in one glance.
 */
export function TaskCard({ task, course, now, busy, onPress, onToggle, compact }: Props) {
  const theme = useTheme();
  const done = isDone(task);
  const overdue = isOverdue(task, now);

  const dueColor = done
    ? theme.colors.success
    : overdue
      ? theme.colors.error
      : dueLabel(task, now) === 'Hôm nay'
        ? theme.colors.warning
        : theme.colors.textSecondary;

  const priorityColor = theme.isDark
    ? priorityColors[task.priority].dark
    : priorityColors[task.priority].light;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${task.title}, ${dueLabel(task, now)}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Pressable
        onPress={onToggle}
        disabled={!onToggle || busy}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done, disabled: !onToggle || busy }}
        // react-native-web does not translate `accessibilityState` into ARIA attributes, so the
        // state is stated twice: once for native screen readers, once for the web build.
        aria-checked={done}
        aria-disabled={!onToggle || busy}
        accessibilityLabel={`Đánh dấu hoàn thành: ${task.title}`}
        hitSlop={8}
        style={[
          styles.checkbox,
          {
            borderColor: done ? theme.colors.success : theme.colors.border,
            backgroundColor: done ? theme.colors.success : 'transparent',
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : done ? (
          <Icon name="check" size={14} color={theme.colors.onPrimary} strokeWidth={3} />
        ) : null}
      </Pressable>

      <View style={styles.body}>
        <Text
          numberOfLines={compact ? 2 : 3}
          style={[
            styles.title,
            {
              color: done ? theme.colors.textSecondary : theme.colors.textPrimary,
              textDecorationLine: done ? 'line-through' : 'none',
            },
          ]}
        >
          {task.title}
        </Text>

        <View style={styles.metaRow}>
          {course ? (
            // Tint from the course colour, text in a theme colour (see course-card.tsx).
            <Pill label={course.code} color={theme.colors.textPrimary} background={`${course.color}22`} />
          ) : null}
          <Pill label={TASK_TYPE_LABELS[task.type]} bordered />
          <View style={styles.dueRow}>
            <View style={[styles.dot, { backgroundColor: priorityColor }]} />
            <Text style={[styles.due, { color: dueColor }]} numberOfLines={1}>
              {dueLabel(task, now)}
            </Text>
          </View>
          {task.pendingSync ? (
            <View accessibilityLabel="Chờ đồng bộ" style={styles.pending}>
              <Icon name="sync" size={13} color={theme.colors.warning} />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  body: { flex: 1, gap: 8 },
  title: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  due: { fontSize: 12, fontWeight: '600' },
  pending: { alignItems: 'center', justifyContent: 'center' },
});
