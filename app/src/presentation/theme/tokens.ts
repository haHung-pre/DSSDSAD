/**
 * Design tokens — the single source of the app's look (see docs/ui-design.md §5).
 * Screens never hard-code a colour: they read them from `useTheme()`.
 */

export type ThemeColors = {
  primary: string;
  primarySoft: string;
  onPrimary: string;
  secondary: string;
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textInverse: string;
  error: string;
  errorSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  overlay: string;
  shadow: string;
};

/**
 * Contrast note: the light palette is tuned so that every colour used as *text* reaches
 * WCAG AA (4.5:1) on `surface`, on `background` and on its own `*Soft` tint — see
 * `presentation/__tests__/theme-contrast.test.ts`, which fails if a token is lightened
 * later. The dark palette already passes without adjustment.
 */
export const lightColors: ThemeColors = {
  primary: '#2560D8', // was #2F6FED — 4.21:1 on `background`, too low for small text
  primarySoft: '#E4ECFD',
  onPrimary: '#FFFFFF',
  secondary: '#0A7A6D', // was #12A594 — 3.07:1 on `surface`
  background: '#F4F6FB',
  surface: '#FFFFFF',
  surfaceMuted: '#EDF1F9',
  border: '#DCE3F0',
  textPrimary: '#101828',
  textSecondary: '#5B6478',
  textInverse: '#FFFFFF',
  error: '#C4281C', // was #D92D20 — 4.24:1 on `errorSoft`
  errorSoft: '#FEECEB',
  success: '#047A58', // was #00936A — 3.90:1 on `surface`
  successSoft: '#E3F6EF',
  warning: '#9A5313', // was #B4641B — 3.92:1 on `warningSoft`
  warningSoft: '#FDF0E3',
  overlay: 'rgba(16, 24, 40, 0.45)',
  shadow: '#101828',
};

export const darkColors: ThemeColors = {
  primary: '#7AA5FF',
  primarySoft: '#1C2A4A',
  onPrimary: '#0B1220',
  secondary: '#3ED0BC',
  background: '#0B1220',
  surface: '#151E2E',
  surfaceMuted: '#1E293B',
  border: '#2A3548',
  textPrimary: '#F5F7FB',
  textSecondary: '#A5B1C6',
  textInverse: '#0B1220',
  error: '#FF8A80',
  errorSoft: '#3A1F22',
  success: '#4BD3A4',
  successSoft: '#10312A',
  warning: '#F2A45C',
  warningSoft: '#3A2A17',
  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: '#000000',
};

/** 8pt spacing scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.4 },
  title: { fontSize: 20, fontWeight: '700' as const },
  heading: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
} as const;

export const layout = {
  screenPadding: spacing.lg,
  /** Minimum touch target (accessibility). */
  touchTarget: 44,
  maxContentWidth: 720,
} as const;

export const priorityColors = {
  High: { light: '#D92D20', dark: '#FF8A80' },
  Medium: { light: '#B4641B', dark: '#F2A45C' },
  Low: { light: '#5B6478', dark: '#A5B1C6' },
} as const;
