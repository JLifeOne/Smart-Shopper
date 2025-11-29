import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { palette, radius, spacing, typography } from '@smart-shopper/theming';

export interface CardProps {
  title: string;
  children: ReactNode;
  style?: ViewStyle;
}

export function Card({ title, children, style }: CardProps) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View>{children}</View>
    </View>
  );
}

export interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function PrimaryButton({ label, onPress, disabled }: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed ? styles.buttonPressed : undefined,
        disabled ? styles.buttonDisabled : undefined
      ]}
      disabled={disabled}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: '#101828',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3
  },
  cardTitle: {
    fontSize: typography.size.lg,
    fontWeight: '600',
    color: palette.ink
  },
  button: {
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonPressed: {
    opacity: 0.85
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonLabel: {
    color: palette.ink,
    fontSize: typography.size.md,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8
  }
});
