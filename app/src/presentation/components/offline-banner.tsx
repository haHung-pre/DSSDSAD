import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/theme-context';
import { formatRelativeTime } from '../format';
import { Icon } from './icons';

/**
 * Shown when the last refresh failed but cached data is on screen. This is the
 * difference between "Error" (nothing to show) and "stale but useful".
 */
export function OfflineBanner({
  savedAt,
  pending,
  now,
}: {
  savedAt: number | null;
  pending?: number;
  now: Date;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: theme.colors.warningSoft, borderColor: theme.colors.warning },
      ]}
    >
      <Icon name="wifi-off" size={18} color={theme.colors.warning} />
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: theme.colors.warning }]}>Đang dùng dữ liệu lưu ngoại tuyến</Text>
        <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
          {savedAt ? `Cập nhật ${formatRelativeTime(savedAt, now)}.` : 'Chưa thể kết nối máy chủ.'}
          {pending ? ` ${pending} thay đổi đang chờ đồng bộ.` : ''}
        </Text>
      </View>
    </View>
  );
}

export function InlineNotice({
  message,
  tone = 'info',
  onDismiss,
}: {
  message: string;
  tone?: 'info' | 'error' | 'success';
  onDismiss?: () => void;
}) {
  const theme = useTheme();
  const color =
    tone === 'error' ? theme.colors.error : tone === 'success' ? theme.colors.success : theme.colors.primary;
  const background =
    tone === 'error'
      ? theme.colors.errorSoft
      : tone === 'success'
        ? theme.colors.successSoft
        : theme.colors.primarySoft;

  return (
    <View style={[styles.notice, { backgroundColor: background, borderColor: color }]}>
      <Text style={[styles.noticeText, { color }]}>{message}</Text>
      {onDismiss ? (
        <Text
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Đóng thông báo"
          style={[styles.dismiss, { color }]}
        >
          ✕
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  textBlock: { flex: 1, gap: 2 },
  title: { fontSize: 13, fontWeight: '700' },
  body: { fontSize: 12, lineHeight: 17 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  noticeText: { flex: 1, fontSize: 13 },
  dismiss: { fontSize: 14, fontWeight: '700' },
});
