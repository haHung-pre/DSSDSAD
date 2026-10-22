import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Course, Session } from '../../domain/models';
import { SESSION_TYPE_LABELS } from '../format';
import { useTheme } from '../theme/theme-context';
import { Icon } from './icons';

/** One class in the day timeline: time column, coloured bar, course and room. */
export function SessionRow({ session, course }: { session: Session; course?: Course }) {
  const theme = useTheme();
  const accent = course?.color ?? theme.colors.primary;

  return (
    <View style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={styles.timeColumn}>
        <Text style={[styles.start, { color: theme.colors.textPrimary }]}>{session.startTime}</Text>
        <Text style={[styles.end, { color: theme.colors.textSecondary }]}>{session.endTime}</Text>
      </View>

      <View style={[styles.accent, { backgroundColor: accent }]} />

      <View style={styles.body}>
        <Text style={[styles.course, { color: theme.colors.textPrimary }]} numberOfLines={1}>
          {course?.name ?? `Môn #${session.courseId}`}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>
            {course?.code ?? '—'} · {SESSION_TYPE_LABELS[session.type] ?? session.type}
          </Text>
        </View>
        <View style={styles.roomRow}>
          <Icon name="pin" size={13} color={theme.colors.textSecondary} />
          <Text style={[styles.room, { color: theme.colors.textSecondary }]}>{session.room}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  timeColumn: { width: 56, justifyContent: 'center' },
  start: { fontSize: 15, fontWeight: '700' },
  end: { fontSize: 12 },
  accent: { width: 4, borderRadius: 999 },
  body: { flex: 1, gap: 3 },
  course: { fontSize: 15, fontWeight: '600' },
  metaRow: { flexDirection: 'row', gap: 6 },
  meta: { fontSize: 12 },
  roomRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  room: { fontSize: 12 },
});
