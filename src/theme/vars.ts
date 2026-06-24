/**
 * Type-safe CSS variable references.
 * Use these instead of hardcoded hex values in inline styles.
 *
 * @example
 *   import { c } from '../theme';
 *   <div style={{ background: c.bgMain, color: c.textPrimary }} />
 */
export const c = {
  // Backgrounds
  bgDeep:        'var(--color-bg-deep)',
  bgNav:         'var(--color-bg-nav)',
  bgTopBar:      'var(--color-bg-top-bar)',
  bgPanel:       'var(--color-bg-panel)',
  bgSubHeader:   'var(--color-bg-sub-header)',
  bgTableHeader: 'var(--color-bg-table-header)',
  bgMain:        'var(--color-bg-main)',
  bgCard:        'var(--color-bg-card)',
  bgCardHover:   'var(--color-bg-card-hover)',
  bgInput:       'var(--color-bg-input)',

  // Borders
  border:      'var(--color-border)',
  borderLight: 'var(--color-border-light)',

  // Text
  textPrimary:   'var(--color-text-primary)',
  textSecondary: 'var(--color-text-secondary)',
  textDim:       'var(--color-text-dim)',
  textMuted:     'var(--color-text-muted)',
  textSubtle:    'var(--color-text-subtle)',
  textFaint:     'var(--color-text-faint)',

  // Accent
  accent:      'var(--color-accent)',
  accentHover: 'var(--color-accent-hover)',
  accentDark:  'var(--color-accent-dark)',

  // Semantic
  success:      'var(--color-success)',
  successDark:  'var(--color-success-dark)',
  warning:      'var(--color-warning)',
  warningHover: 'var(--color-warning-hover)',
  danger:       'var(--color-danger)',

  // Game mode badges
  modeRanked: 'var(--color-mode-ranked)',
  modeTrio:   'var(--color-mode-trio)',
  modeDuo:    'var(--color-mode-duo)',
  modeOther:  'var(--color-mode-other)',

  // Rank positions
  rankFirst: 'var(--color-rank-first)',
  rankTop5:  'var(--color-rank-top5)',
  rankOther: 'var(--color-rank-other)',

  playstyleText:       'var(--color-playstyle-text)',
  playstyleLabel:      'var(--color-playstyle-label)',
  playstyleIcon:       'var(--color-playstyle-icon)',
  playstyleTextShadow: 'var(--color-playstyle-text-shadow)',
} as const;

export type ColorKey = keyof typeof c;
