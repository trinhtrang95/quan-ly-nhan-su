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

export interface ThemeConfig {
  preset: ThemePresetId;
  autoDark: boolean;
}

const THEME_STORAGE_KEY = 'hr_pro_theme_config_v1';

export const THEME_PRESETS: ThemePresetMeta[] = [
  {
    id: 'teal',
    label: 'Xanh ngọc',
    swatchColor: '#0D9488',
    badgeEmoji: '🟢',
    sidebarBg: '#0F232E',
    sidebarDarker: '#0B1B24',
    sidebarActive: '#163C45',
    primary: '#0D9488',
    primaryHover: '#0F766E',
    accentLight: '#2DD4BF',
    pageBg: '#EEF3F6',
    scale: {
      50: '#F0FDFA',
      100: '#CCFBF1',
      200: '#99F6E4',
      300: '#5EEAD4',
      400: '#2DD4BF',
      500: '#14B8A6',
      600: '#0D9488',
      700: '#0F766E',
      800: '#115E59',
      900: '#134E4A',
    },
  },
  {
    id: 'olive',
    label: 'Xanh rêu',
    swatchColor: '#4D7C0F',
    badgeEmoji: '🫒',
    sidebarBg: '#1B2A1A',
    sidebarDarker: '#131E12',
    sidebarActive: '#2A4228',
    primary: '#4D7C0F',
    primaryHover: '#3F6212',
    accentLight: '#A3E635',
    pageBg: '#EEF3EB',
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
    id: 'blue',
    label: 'Xanh dương',
    swatchColor: '#2563EB',
    badgeEmoji: '🔵',
    sidebarBg: '#0F1E3A',
    sidebarDarker: '#091428',
    sidebarActive: '#1E3A6E',
    primary: '#2563EB',
    primaryHover: '#1D4ED8',
    accentLight: '#60A5FA',
    pageBg: '#ECF2F9',
    scale: {
      50: '#EFF6FF',
      100: '#DBEAFE',
      200: '#BFDBFE',
      300: '#93C5FD',
      400: '#60A5FA',
      500: '#3B82F6',
      600: '#2563EB',
      700: '#1D4ED8',
      800: '#1E40AF',
      900: '#1E3A8A',
    },
  },
  {
    id: 'amber',
    label: 'Vàng',
    swatchColor: '#D97706',
    badgeEmoji: '🟡',
    sidebarBg: '#2B1F11',
    sidebarDarker: '#1E150B',
    sidebarActive: '#45311B',
    primary: '#D97706',
    primaryHover: '#B45309',
    accentLight: '#FBBF24',
    pageBg: '#F8F4EC',
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
    sidebarBg: '#382E28',
    sidebarDarker: '#28201C',
    sidebarActive: '#50423A',
    primary: '#9A7B56',
    primaryHover: '#7E6242',
    accentLight: '#E6CCB2',
    pageBg: '#F5F0E6',
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
    sidebarBg: '#311326',
    sidebarDarker: '#220C1A',
    sidebarActive: '#4D1E3C',
    primary: '#DB2777',
    primaryHover: '#BE185D',
    accentLight: '#F472B6',
    pageBg: '#F7EDF3',
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
    sidebarBg: '#3B2233',
    sidebarDarker: '#2A1724',
    sidebarActive: '#56324B',
    primary: '#E15B8E',
    primaryHover: '#C84376',
    accentLight: '#F9A8D4',
    pageBg: '#FAF1F6',
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
    swatchColor: '#0F172A',
    badgeEmoji: '🌙',
    sidebarBg: '#090E17',
    sidebarDarker: '#05080E',
    sidebarActive: '#1E293B',
    primary: '#14B8A6',
    primaryHover: '#0D9488',
    accentLight: '#2DD4BF',
    pageBg: '#0B1120',
    scale: {
      50: '#132A2E',
      100: '#16383D',
      200: '#1D4D53',
      300: '#2DD4BF',
      400: '#2DD4BF',
      500: '#14B8A6',
      600: '#0D9488',
      700: '#2DD4BF',
      800: '#5EEAD4',
      900: '#CCFBF1',
    },
  },
];

export function loadSavedThemeConfig(): ThemeConfig {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const validPreset = THEME_PRESETS.some((p) => p.id === parsed?.preset)
          ? (parsed.preset as ThemePresetId)
          : 'teal';
        return {
          preset: validPreset,
          autoDark: Boolean(parsed?.autoDark),
        };
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return {
    preset: 'teal',
    autoDark: false,
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

  const root = document.documentElement;
  root.setAttribute('data-theme', config.preset);
  root.setAttribute('data-dark-mode', isDarkEffective ? 'true' : 'false');

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
