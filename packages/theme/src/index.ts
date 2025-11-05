export const palette = {
  ink: '#0C1D37',
  inkSoft: '#152544',
  haze: '#F5F7FA',
  accent: '#4FD1C5',
  accentDark: '#319795',
  accentSoft: '#E6FFFA',
  success: '#38A169',
  warning: '#ED8936',
  danger: '#E53E3E',
  neutral: '#6C7A91'
} as const;

export const typography = {
  fontFamily: {
    regular: 'Inter-Regular',
    semibold: 'Inter-SemiBold',
    bold: 'Inter-Bold'
  },
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32
  }
} as const;

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999
} as const;

export const shadows = {
  light: {
    shadowColor: '#101828',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2
  },
  medium: {
    shadowColor: '#101828',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4
  }
} as const;

export const theme = {
  palette,
  typography,
  spacing,
  radius,
  shadows
};

export type Theme = typeof theme;
