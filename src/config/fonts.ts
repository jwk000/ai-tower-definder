/**
 * Font configuration — Exo 2 (Google Fonts)
 * Vector font, scales without distortion
 */

/** Primary font family for game UI */
export const FONT_FAMILY = "'Exo 2', 'Segoe UI', 'Microsoft YaHei', sans-serif";

/** Font presets for common use cases */
export const FONTS = {
  /** Small labels (12px) */
  label: `12px ${FONT_FAMILY}`,
  /** Medium labels (14px) */
  labelMedium: `14px ${FONT_FAMILY}`,
  /** Standard UI text (16px) */
  body: `16px ${FONT_FAMILY}`,
  /** Bold UI text (16px) */
  bodyBold: `bold 16px ${FONT_FAMILY}`,
  /** Bold info text at custom size */
  infoBold: (size: number) => `bold ${size}px ${FONT_FAMILY}`,
  /** Large overlay title (64px) */
  title: `bold 64px ${FONT_FAMILY}`,
  /** Overlay subtext (32px) */
  subtitle: `32px ${FONT_FAMILY}`,
  /** Debug text (14px) */
  debug: `14px ${FONT_FAMILY}`,
  /** Debug small (11px) */
  debugSmall: `11px ${FONT_FAMILY}`,
  /** Debug tiny (10px) */
  debugTiny: `10px ${FONT_FAMILY}`,
} as const;

/** Get font string for a given size with optional bold */
export function getFont(size: number, bold = false): string {
  return `${bold ? 'bold ' : ''}${size}px ${FONT_FAMILY}`;
}
