import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Small inline icon set (SVG), so the UI looks the same on every platform —
 * emoji glyphs differ per OS and are missing on some Android builds and on web.
 */
export type IconName =
  | 'home'
  | 'tasks'
  | 'calendar'
  | 'book'
  | 'settings'
  | 'plus'
  | 'check'
  | 'clock'
  | 'pin'
  | 'wifi-off'
  | 'alert'
  | 'inbox'
  | 'sync'
  | 'trash'
  | 'chevron-right'
  | 'offline-cloud'
  | 'search';

type Props = {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 22, color, strokeWidth = 1.8 }: Props) {
  const common = {
    stroke: color,
    strokeWidth,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel={name}>
      {name === 'home' ? (
        <>
          <Path d="M3 10.5 12 3l9 7.5" {...common} />
          <Path d="M5.5 9.5V20h13V9.5" {...common} />
          <Path d="M10 20v-5.5h4V20" {...common} />
        </>
      ) : null}
      {name === 'tasks' ? (
        <>
          <Rect x="3.5" y="4" width="17" height="16" rx="3" {...common} />
          <Path d="M7.5 12.2l2.6 2.6 5.4-5.6" {...common} />
        </>
      ) : null}
      {name === 'calendar' ? (
        <>
          <Rect x="3.5" y="5" width="17" height="15.5" rx="3" {...common} />
          <Path d="M3.5 10h17M8 3v4M16 3v4" {...common} />
          <Path d="M7.5 14h3M13.5 14h3M7.5 17.2h3" {...common} />
        </>
      ) : null}
      {name === 'book' ? (
        <>
          <Path
            d="M4 4.5h6a2.5 2.5 0 0 1 2 1 2.5 2.5 0 0 1 2-1h6v14h-6a2.5 2.5 0 0 0-2 1 2.5 2.5 0 0 0-2-1H4z"
            {...common}
          />
          <Path d="M12 5.5v14" {...common} />
        </>
      ) : null}
      {name === 'settings' ? (
        <>
          <Circle cx="12" cy="12" r="3.2" {...common} />
          <Path d="M12 3.5v2M12 18.5v2M4.9 8l1.7 1M17.4 15l1.7 1M4.9 16l1.7-1M17.4 9l1.7-1" {...common} />
        </>
      ) : null}
      {name === 'plus' ? <Path d="M12 5v14M5 12h14" {...common} /> : null}
      {name === 'check' ? <Path d="M4.5 12.5l4.5 4.5L19.5 6.5" {...common} strokeWidth={2.4} /> : null}
      {name === 'clock' ? (
        <>
          <Circle cx="12" cy="12" r="8.5" {...common} />
          <Path d="M12 7.5V12l3 2" {...common} />
        </>
      ) : null}
      {name === 'pin' ? (
        <>
          <Path d="M12 21s6-5.6 6-10.2A6 6 0 0 0 6 10.8C6 15.4 12 21 12 21z" {...common} />
          <Circle cx="12" cy="10.5" r="2.2" {...common} />
        </>
      ) : null}
      {name === 'wifi-off' || name === 'offline-cloud' ? (
        <>
          <Path d="M3.5 8.5A13 13 0 0 1 12 5.5c2.1 0 4.1.5 5.9 1.4" {...common} />
          <Path d="M6.8 12.2a10 10 0 0 1 3-1.3M2.5 21 21.5 3" {...common} />
          <Path d="M9.2 16.2a5 5 0 0 1 3.4-.6" {...common} />
          <Circle cx="12" cy="19.4" r="1.1" fill={color} stroke="none" />
        </>
      ) : null}
      {name === 'alert' ? (
        <>
          <Path d="M12 4.5 21 19.5H3z" {...common} />
          <Path d="M12 10v4.2" {...common} />
          <Circle cx="12" cy="16.8" r="1" fill={color} stroke="none" />
        </>
      ) : null}
      {name === 'inbox' ? (
        <>
          <Path d="M3.5 13.5 6 5.5h12l2.5 8v5.5h-17z" {...common} />
          <Path d="M3.5 13.5h4l1 2.2h7l1-2.2h4" {...common} />
        </>
      ) : null}
      {name === 'sync' ? (
        <>
          <Path d="M20 12a8 8 0 0 1-13.7 5.6M4 12a8 8 0 0 1 13.7-5.6" {...common} />
          <Path d="M17.5 3.5v3.2h-3.2M6.5 20.5v-3.2h3.2" {...common} />
        </>
      ) : null}
      {name === 'trash' ? (
        <>
          <Path d="M4.5 7h15M9.5 7V4.8h5V7" {...common} />
          <Path d="M6.5 7l1 12.2h9L17.5 7" {...common} />
        </>
      ) : null}
      {name === 'chevron-right' ? <Path d="M9.5 5.5 16 12l-6.5 6.5" {...common} /> : null}
      {name === 'search' ? (
        <>
          <Circle cx="11" cy="11" r="6.5" {...common} />
          <Path d="M16 16l4.5 4.5" {...common} />
        </>
      ) : null}
    </Svg>
  );
}
