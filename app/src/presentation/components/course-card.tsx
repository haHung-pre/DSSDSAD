import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Course, StudyTask } from '../../domain/models';
import { isDone } from '../../domain/task-rules';
import { useTheme } from '../theme/theme-context';
import { ProgressBar } from './ui';

/** Course summary card with a completion bar computed from its tasks. */
export function CourseCard({
  course,
  tasks,
  onPress,
}: {
  course: Course;
  tasks: StudyTask[];
  onPress?: () => void;
}) {
  const theme = useTheme();
  const total = tasks.length;
  const done = tasks.filter(isDone).length;
  const progress = total === 0 ? 0 : done / total;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Xem công việc của ${course.code}` : undefined}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        {/* The colour is data from the API, so it is used as a tint only: the code itself is
            rendered in a theme colour, which keeps it readable whatever the server sends. */}
        <View style={[styles.badge, { backgroundColor: `${course.color}22` }]}>
          <Text style={[styles.code, { color: theme.colors.textPrimary }]}>{course.code}</Text>
        </View>
        <Text style={[styles.credits, { color: theme.colors.textSecondary }]}>{course.credits} tín chỉ</Text>
      </View>

      <Text style={[styles.name, { color: theme.colors.textPrimary }]}>{course.name}</Text>
      <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>
        {course.lecturer} · Phòng {course.room}
      </Text>

      <View style={styles.progressBlock}>
        <ProgressBar value={progress} color={course.color} />
        <View style={styles.progressLabels}>
          <Text style={[styles.progressText, { color: theme.colors.textSecondary }]}>
            {total === 0 ? 'Chưa có công việc' : `${done}/${total} công việc đã xong`}
          </Text>
          <Text style={[styles.progressText, { color: theme.colors.textPrimary }]}>
            {total === 0 ? '—' : `${Math.round(progress * 100)}%`}
          </Text>
        </View>
      </View>

      {onPress ? (
        <Text style={[styles.cta, { color: theme.colors.primary }]}>Xem công việc của môn này →</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  code: { fontSize: 12, fontWeight: '700' },
  credits: { fontSize: 12 },
  name: { fontSize: 16, fontWeight: '700', lineHeight: 21 },
  meta: { fontSize: 12 },
  progressBlock: { gap: 6, marginTop: 6 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { fontSize: 12, fontWeight: '500' },
  cta: { fontSize: 12, fontWeight: '600', marginTop: 4 },
});
