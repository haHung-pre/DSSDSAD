import { darkColors, lightColors, type ThemeColors } from '../theme/tokens';

/**
 * WCAG 2.1 AA contrast for the colour pairs the app actually paints text on.
 *
 * This is a *guard*, not decoration: it is easy to make a screen look nicer by lightening a
 * semantic colour, and the regression is invisible on a bright monitor. The light palette was
 * re-tuned against these numbers (`docs/ui-design.md` §5.1 records the ratios).
 */

const hex = (color: string): [number, number, number] => {
  const value = color.replace('#', '');
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
};

const relativeLuminance = (color: string): number => {
  const [r, g, b] = hex(color).map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrastRatio = (foreground: string, background: string): number => {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
};

const AA_NORMAL_TEXT = 4.5;

/** [foreground, background] pairs used for real text somewhere in the app. */
const TEXT_PAIRS: [keyof ThemeColors, keyof ThemeColors][] = [
  ['textPrimary', 'surface'],
  ['textPrimary', 'background'],
  ['textPrimary', 'surfaceMuted'],
  ['textSecondary', 'surface'],
  ['textSecondary', 'background'],
  ['textSecondary', 'surfaceMuted'],
  ['primary', 'surface'],
  ['primary', 'background'],
  ['primary', 'primarySoft'],
  ['onPrimary', 'primary'],
  ['error', 'surface'],
  ['error', 'errorSoft'],
  ['success', 'surface'],
  ['success', 'successSoft'],
  ['warning', 'surface'],
  ['warning', 'warningSoft'],
  ['secondary', 'surface'],
];

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
])('%s theme contrast', (_name, palette) => {
  it.each(TEXT_PAIRS)('%s on %s reaches WCAG AA (4.5:1)', (foreground, background) => {
    const ratio = contrastRatio(palette[foreground], palette[background]);
    // The message carries the measured value so a failure is actionable.
    expect(`${foreground} on ${background}: ${ratio.toFixed(2)} => ${ratio >= AA_NORMAL_TEXT}`).toBe(
      `${foreground} on ${background}: ${ratio.toFixed(2)} => true`,
    );
  });
});

describe('contrastRatio', () => {
  it('is 21:1 for black on white and 1:1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#2560D8', '#2560D8')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#2560D8', '#FFFFFF')).toBeCloseTo(contrastRatio('#FFFFFF', '#2560D8'), 5);
  });
});
