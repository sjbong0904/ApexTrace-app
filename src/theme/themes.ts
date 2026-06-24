export interface ThemeColors {
  // Backgrounds (darkest → lightest)
  bgDeep:        string; // #111 – deepest wells (tooltips, legend bg)
  bgNav:         string; // #000 – nav rail
  bgTopBar:      string; // #101010 – top bar
  bgPanel:       string; // #181818 – side panels
  bgSubHeader:   string; // #1a1a1a – sub-headers, accordion inner
  bgTableHeader: string; // #202020 – table heads, stripe alternates
  bgMain:        string; // #1e1e1e – main content area
  bgCard:        string; // #252525 – cards
  bgCardHover:   string; // #2a2a2a – card hover / pressed
  bgInput:       string; // #2a2a2a – inputs

  // Borders
  border:       string; // #333
  borderLight:  string; // #444

  // Text (lightest → darkest)
  textPrimary:   string; // #fff
  textSecondary: string; // #eee
  textDim:       string; // #ccc – slightly dimmed labels
  textMuted:     string; // #888
  textSubtle:    string; // #555 – between muted and faint
  textFaint:     string; // #666

  // Accent (brand red)
  accent:      string;
  accentHover: string;
  accentDark:  string;

  // Semantic
  success:      string;
  successDark:  string;
  warning:      string;
  warningHover: string;
  danger:       string;

  // Game mode badges
  modeRanked: string;
  modeTrio:   string;
  modeDuo:    string;
  modeOther:  string;

  // Rank positions
  rankFirst: string;
  rankTop5:  string;
  rankOther: string;

  // Playstyle badge (gradient cards — always light text on colorful bg)
  playstyleText:       string;
  playstyleLabel:      string;
  playstyleIcon:       string;
  playstyleTextShadow: string;
}

export interface Theme {
  id: 'dark' | 'light';
  name: string;
  colors: ThemeColors;
}

// ── Dark ──────────────────────────────────────────────────────────────────
export const darkTheme: Theme = {
  id: 'dark',
  name: '다크',
  colors: {
    bgDeep:        '#111111',
    bgNav:         '#000000',
    bgTopBar:      '#101010',
    bgPanel:       '#181818',
    bgSubHeader:   '#1a1a1a',
    bgTableHeader: '#202020',
    bgMain:        '#1e1e1e',
    bgCard:        '#252525',
    bgCardHover:   '#2a2a2a',
    bgInput:       '#2a2a2a',

    border:      '#333333',
    borderLight: '#444444',

    textPrimary:   '#ffffff',
    textSecondary: '#eeeeee',
    textDim:       '#cccccc',
    textMuted:     '#888888',
    textSubtle:    '#555555',
    textFaint:     '#666666',

    accent:      '#e74c3c',
    accentHover: '#ff4757',
    accentDark:  '#c0392b',

    success:      '#2ecc71',
    successDark:  '#27ae60',
    warning:      '#e67e22',
    warningHover: '#d35400',
    danger:       '#ff6b6b',

    modeRanked: '#d97aff',
    modeTrio:   '#509df5',
    modeDuo:    '#ffaf6d',
    modeOther:  '#fd9daa',

    rankFirst: '#ff4757',
    rankTop5:  '#00d2be',
    rankOther: '#dfe6e9',

    playstyleText:       '#ffffff',
    playstyleLabel:      'rgba(255, 255, 255, 0.75)',
    playstyleIcon:       'rgba(255, 255, 255, 0.6)',
    playstyleTextShadow: '0 2px 4px rgba(0, 0, 0, 0.45)',
  },
};

// ── Light (warm neutral — paper-like surfaces, soft contrast) ───────────────
export const lightTheme: Theme = {
  id: 'light',
  name: '라이트',
  colors: {
    bgDeep:        '#ddd9d4',
    bgNav:         '#f7f6f3',
    bgTopBar:      '#f7f6f3',
    bgPanel:       '#efede8',
    bgSubHeader:   '#e8e6e1',
    bgTableHeader: '#eae8e3',
    bgMain:        '#f3f2ef',
    bgCard:        '#fafaf8',
    bgCardHover:   '#f0efec',
    bgInput:       '#ffffff',

    border:      '#d4d0c8',
    borderLight: '#c4bfb6',

    textPrimary:   '#2c2825',
    textSecondary: '#3d3935',
    textDim:       '#5c5752',
    textMuted:     '#736e68',
    textSubtle:    '#8f8983',
    textFaint:     '#a8a29e',

    accent:      '#d64537',
    accentHover: '#e74c3c',
    accentDark:  '#b8382b',

    success:      '#1a8f4e',
    successDark:  '#157a43',
    warning:      '#c2780a',
    warningHover: '#a36408',
    danger:       '#d64537',

    modeRanked: '#7c3aed',
    modeTrio:   '#1d6fd4',
    modeDuo:    '#d4610a',
    modeOther:  '#c0266a',

    rankFirst: '#d64537',
    rankTop5:  '#0d8a8a',
    rankOther: '#5c5752',

    playstyleText:       '#ffffff',
    playstyleLabel:      'rgba(255, 255, 255, 0.85)',
    playstyleIcon:       'rgba(255, 255, 255, 0.7)',
    playstyleTextShadow: '0 1px 3px rgba(0, 0, 0, 0.35)',
  },
};

export const ALL_THEMES: Theme[] = [darkTheme, lightTheme];
