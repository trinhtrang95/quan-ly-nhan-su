export type ThemePresetId =
  | 'teal'
  | 'olive'
  | 'blue'
  | 'amber'
  | 'cream'
  | 'deep_pink'
  | 'light_pink'
  | 'dark';

export interface ThemePresetMeta {
  id: ThemePresetId;
  label: string;
  swatchColor: string;
  badgeEmoji: string;
  sidebarBg: string;
  sidebarDarker: string;
  sidebarActive: string;
  primary: string;
  primaryHover: string;
  accentLight: string;
  pageBg: string;
  scale: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
}

export type DisplayDensityMode = 'large' | 'standard' | 'small';

export interface ThemeConfig {
  preset: ThemePresetId;
  autoDark: boolean;
  density: DisplayDensityMode;
}

const THEME_STORAGE_KEY = 'hr_pro_theme_config_v1';

export const THEME_PRESETS: ThemePresetMeta[] = [
  {
    id: 'blue',
    label: 'Xanh thương hiệu (#14539E)',
    swatchColor: '#14539E',
    badgeEmoji: '🔵',
    sidebarBg: '#14539E',
    sidebarDarker: '#0F3E77',
    sidebarActive: '#1B64BA',
    primary: '#14539E',
    primaryHover: '#2563EB',
    accentLight: '#93C5FD',
    pageBg: '#F8FAFC',
    scale: {
      50: '#EFF6FF',
      100: '#DBEAFE',
      200: '#BFDBFE',
      300: '#93C5FD',
      400: '#60A5FA',
      500: '#3B82F6',
      600: '#14539E',
      700: '#2563EB',
      800: '#1E40AF',
      900: '#1E3A8A',
    },
  },
  {
    id: 'teal',
    label: 'Xanh ngọc',
    swatchColor: '#0D9488',
    badgeEmoji: '🟢',
    sidebarBg: '#14539E',
    sidebarDarker: '#0F3E77',
    sidebarActive: '#1B64BA',
    primary: '#14539E',
    primaryHover: '#2563EB',
    accentLight: '#93C5FD',
    pageBg: '#F8FAFC',
    scale: {
      50: '#EFF6FF',
      100: '#DBEAFE',
      200: '#BFDBFE',
      300: '#93C5FD',
      400: '#60A5FA',
      500: '#3B82F6',
      600: '#14539E',
      700: '#2563EB',
      800: '#1E40AF',
      900: '#1E3A8A',
    },
  },
  {
    id: 'olive',
    label: 'Xanh rêu',
    swatchColor: '#4D7C0F',
    badgeEmoji: '🫒',
    sidebarBg: '#3F6212',
    sidebarDarker: '#365314',
    sidebarActive: '#4D7C0F',
    primary: '#4D7C0F',
    primaryHover: '#65A30D',
    accentLight: '#BEF264',
    pageBg: '#F8FAFC',
    scale: {
      50: '#F7FEE7',
      100: '#ECFCCB',
      200: '#D9F99D',
      300: '#BEF264',
      400: '#A3E635',
      500: '#84CC16',
      600: '#4D7C0F',
      700: '#3F6212',
      800: '#365314',
      900: '#1A2E05',
    },
  },
  {
    id: 'amber',
    label: 'Vàng',
    swatchColor: '#D97706',
    badgeEmoji: '🟡',
    sidebarBg: '#B45309',
    sidebarDarker: '#92400E',
    sidebarActive: '#D97706',
    primary: '#D97706',
    primaryHover: '#F59E0B',
    accentLight: '#FDE68A',
    pageBg: '#F8FAFC',
    scale: {
      50: '#FFFBEB',
      100: '#FEF3C7',
      200: '#FDE68A',
      300: '#FCD34D',
      400: '#FBBF24',
      500: '#F59E0B',
      600: '#D97706',
      700: '#B45309',
      800: '#92400E',
      900: '#78350F',
    },
  },
  {
    id: 'cream',
    label: 'Kem',
    swatchColor: '#A68A64',
    badgeEmoji: '🥯',
    sidebarBg: '#73583A',
    sidebarDarker: '#5C462E',
    sidebarActive: '#8C6D49',
    primary: '#9A7B56',
    primaryHover: '#7E6242',
    accentLight: '#E6CCB2',
    pageBg: '#F8FAFC',
    scale: {
      50: '#FAF6F0',
      100: '#F2E9DC',
      200: '#E5D4C0',
      300: '#D5BCA0',
      400: '#C2A382',
      500: '#9A7B56',
      600: '#8C6D49',
      700: '#73583A',
      800: '#5C462E',
      900: '#463523',
    },
  },
  {
    id: 'deep_pink',
    label: 'Hồng đậm',
    swatchColor: '#DB2777',
    badgeEmoji: '🟣',
    sidebarBg: '#BE185D',
    sidebarDarker: '#9D174D',
    sidebarActive: '#DB2777',
    primary: '#DB2777',
    primaryHover: '#EC4899',
    accentLight: '#F9A8D4',
    pageBg: '#F8FAFC',
    scale: {
      50: '#FDF2F8',
      100: '#FCE7F3',
      200: '#FBCFE8',
      300: '#F9A8D4',
      400: '#F472B6',
      500: '#EC4899',
      600: '#DB2777',
      700: '#BE185D',
      800: '#9D174D',
      900: '#831843',
    },
  },
  {
    id: 'light_pink',
    label: 'Hồng nhạt',
    swatchColor: '#F472B6',
    badgeEmoji: '🌸',
    sidebarBg: '#C84376',
    sidebarDarker: '#9D174D',
    sidebarActive: '#E15B8E',
    primary: '#E15B8E',
    primaryHover: '#C84376',
    accentLight: '#F9A8D4',
    pageBg: '#F8FAFC',
    scale: {
      50: '#FFF5F9',
      100: '#FCE7F3',
      200: '#FBCFE8',
      300: '#F9A8D4',
      400: '#F472B6',
      500: '#EC4899',
      600: '#E15B8E',
      700: '#C84376',
      800: '#9D174D',
      900: '#831843',
    },
  },
  {
    id: 'dark',
    label: 'Nền tối',
    swatchColor: '#1E293B',
    badgeEmoji: '🌙',
    sidebarBg: '#1E293B',
    sidebarDarker: '#0F172A',
    sidebarActive: '#334155',
    primary: '#2563EB',
    primaryHover: '#3B82F6',
    accentLight: '#60A5FA',
    pageBg: '#0F172A',
    scale: {
      50: '#1E293B',
      100: '#1E3A8A',
      200: '#1D4ED8',
      300: '#60A5FA',
      400: '#60A5FA',
      500: '#3B82F6',
      600: '#2563EB',
      700: '#60A5FA',
      800: '#93C5FD',
      900: '#DBEAFE',
    },
  },
];

function normalizeDensityMode(raw: unknown): DisplayDensityMode {
  if (raw === 'large') return 'large';
  if (raw === 'small' || raw === 'compact') return 'small';
  return 'standard';
}

export function loadSavedThemeConfig(): ThemeConfig {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const validPreset = THEME_PRESETS.some((p) => p.id === parsed?.preset)
          ? (parsed.preset as ThemePresetId)
          : 'blue';
        const validDensity = normalizeDensityMode(parsed?.density);
        return {
          preset: validPreset,
          autoDark: Boolean(parsed?.autoDark),
          density: validDensity,
        };
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return {
    preset: 'blue',
    autoDark: false,
    density: 'standard',
  };
}

export function saveThemeConfig(config: ThemeConfig): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(config));
    }
  } catch {
    // Ignore storage write errors
  }
}

export function applyThemeToDocument(config: ThemeConfig): void {
  if (typeof document === 'undefined') return;

  const osPrefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  const isDarkEffective =
    config.preset === 'dark' || (config.autoDark && osPrefersDark);

  const selectedMeta =
    THEME_PRESETS.find((p) => p.id === config.preset) || THEME_PRESETS[0];

  const density = normalizeDensityMode(config.density);

  const root = document.documentElement;
  root.setAttribute('data-theme', config.preset);
  root.setAttribute('data-dark-mode', isDarkEffective ? 'true' : 'false');
  root.setAttribute('data-density', density);

  root.classList.remove(
    'density-large',
    'density-standard',
    'density-small',
    'theme-compact'
  );
  root.classList.add(`density-${density}`);
  if (density === 'small') {
    root.classList.add('theme-compact');
  }

  if (document.body) {
    document.body.classList.remove(
      'density-large',
      'density-standard',
      'density-small',
      'theme-compact'
    );
    document.body.classList.add(`density-${density}`);
    if (density === 'small') {
      document.body.classList.add('theme-compact');
    }
    document.body.setAttribute('data-density', density);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('hr-theme-density-change', { detail: density })
    );
  }

  root.style.setProperty(
    '--theme-sidebar-bg',
    isDarkEffective && config.preset !== 'dark'
      ? '#090E17'
      : selectedMeta.sidebarBg
  );
  root.style.setProperty(
    '--theme-sidebar-darker',
    isDarkEffective && config.preset !== 'dark'
      ? '#05080E'
      : selectedMeta.sidebarDarker
  );
  root.style.setProperty('--theme-sidebar-active', selectedMeta.sidebarActive);
  root.style.setProperty('--theme-primary', selectedMeta.primary);
  root.style.setProperty('--theme-primary-hover', selectedMeta.primaryHover);
  root.style.setProperty('--theme-accent-light', selectedMeta.accentLight);
  root.style.setProperty(
    '--theme-page-bg',
    isDarkEffective ? '#0B1120' : selectedMeta.pageBg
  );

  // Override Tailwind v4 teal color tokens so bg-teal-*, text-teal-*, border-teal-* update dynamically
  root.style.setProperty('--color-teal-50', selectedMeta.scale[50]);
  root.style.setProperty('--color-teal-100', selectedMeta.scale[100]);
  root.style.setProperty('--color-teal-200', selectedMeta.scale[200]);
  root.style.setProperty('--color-teal-300', selectedMeta.scale[300]);
  root.style.setProperty('--color-teal-400', selectedMeta.scale[400]);
  root.style.setProperty('--color-teal-500', selectedMeta.scale[500]);
  root.style.setProperty('--color-teal-600', selectedMeta.scale[600]);
  root.style.setProperty('--color-teal-700', selectedMeta.scale[700]);
  root.style.setProperty('--color-teal-800', selectedMeta.scale[800]);
  root.style.setProperty('--color-teal-900', selectedMeta.scale[900]);
}
