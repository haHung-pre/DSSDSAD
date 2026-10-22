import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { AppError } from '../../core/errors';
import { useTheme } from '../theme/theme-context';
import { PrimaryButton, SecondaryButton } from './buttons';
import { Icon, type IconName } from './icons';

/** Loading — a skeleton of rows instead of a bare spinner keeps the layout stable. */
export function LoadingState({ label = 'Đang tải…', rows = 3 }: { label?: string; rows?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel={label}>
      {Array.from({ length: rows }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.skeleton,
            {
              backgroundColor: theme.colors.surfaceMuted,
              height: index === 0 ? 24 : 68,
              width: index === 0 ? '45%' : '100%',
            },
          ]}
        />
      ))}
      <View style={styles.spinnerRow}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>
      </View>
    </View>
  );
}

/** Empty — always offers the next useful action. */
export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  icon = 'inbox',
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: IconName;
}) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.iconBadge, { backgroundColor: theme.colors.primarySoft }]}>
        <Icon name={icon} size={26} color={theme.colors.primary} />
      </View>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.message, { color: theme.colors.textSecondary }]}>{message}</Text>
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

/**
 * Error — shows the *friendly* message from `AppError.userMessage` and, **only when retrying
 * can plausibly help**, a Retry button.
 *
 * `AppError.canRetry` draws the line: offline, timeout, 5xx, 408 and 429 are transient, so the
 * button stays. A 404/403, a rejected payload (400/422) or a response we could not parse will
 * come back exactly the same way, so the screen explains what the user can do instead
 * (go back, report it) rather than offering a button that cannot work.
 *
 * Technical details never reach the user; they only go to the logs.
 */
export function ErrorState({
  error,
  onRetry,
  onBack,
  backLabel = 'Quay lại',
}: {
  error: AppError | null;
  onRetry: () => void;
  onBack?: () => void;
  backLabel?: string;
}) {
  const theme = useTheme();
  const retryable = error?.canRetry ?? true;
  const offline = error?.kind === 'offline';
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconBadge,
          { backgroundColor: offline ? theme.colors.warningSoft : theme.colors.errorSoft },
        ]}
      >
        <Icon
          name={offline ? 'wifi-off' : 'alert'}
          size={26}
          color={offline ? theme.colors.warning : theme.colors.error}
        />
      </View>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
        {offline ? 'Mất kết nối' : retryable ? 'Không tải được dữ liệu' : 'Không đọc được dữ liệu'}
      </Text>
      <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
        {error?.userMessage ?? 'Đã có lỗi xảy ra. Vui lòng thử lại.'}
      </Text>
      {retryable ? (
        <PrimaryButton label="Thử lại" onPress={onRetry} style={styles.action} />
      ) : (
        <>
          <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
            Lỗi này sẽ lặp lại nếu tải lại ngay. Hãy quay lại sau, hoặc báo cho nhóm phát triển nếu nó vẫn
            còn.
          </Text>
          {onBack ? <SecondaryButton label={backLabel} onPress={onBack} style={styles.action} /> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 8,
  },
  skeleton: {
    borderRadius: 14,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  spinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  label: { fontSize: 13 },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  action: { marginTop: 12, minWidth: 160 },
  hint: { fontSize: 13, textAlign: 'center', lineHeight: 18, maxWidth: 320 },
});
