import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type ViewStyle
} from 'react-native';

type PopSearchBarProps = {
  value?: string;
  onChangeText?: (text: string) => void;
  onSubmit: (query: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  style?: ViewStyle;
};

export const PopSearchBar: React.FC<PopSearchBarProps> = ({
  value = '',
  onChangeText,
  onSubmit,
  onCancel,
  placeholder = 'Search lists, items, receipts...',
  style
}) => {
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Separate animated values so layout props stay JS-driven
  const layout = useRef(new Animated.Value(0)).current;
  const fx = useRef(new Animated.Value(0)).current;

  const stopAll = () => {
    layout.stopAnimation();
    fx.stopAnimation();
  };

  const open = () => {
    if (expanded) {
      return;
    }
    setExpanded(true);
    stopAll();
    Animated.parallel([
      Animated.timing(layout, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false
      }),
      Animated.timing(fx, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      })
    ]).start(() => requestAnimationFrame(() => inputRef.current?.focus()));
  };

  const close = () => {
    if (!expanded) {
      return;
    }
    stopAll();
    Animated.parallel([
      Animated.timing(layout, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false
      }),
      Animated.timing(fx, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      })
    ]).start(() => {
      setExpanded(false);
      inputRef.current?.blur();
      onCancel?.();
    });
  };

  const width = layout.interpolate({
    inputRange: [0, 1],
    outputRange: [56, 999]
  });
  const radius = layout.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 16]
  });
  const scale = fx.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1]
  });
  const glowOpacity = fx.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35]
  });

  return (
    <View style={[styles.wrap, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            opacity: glowOpacity,
            transform: [{ scale }]
          }
        ]}
      />

      <Animated.View
        style={[
          styles.bar,
          {
            width,
            borderRadius: radius as any,
            transform: [{ scale }],
            ...(Platform.OS === 'android' ? { elevation: 5 } : {})
          }
        ]}
      >
        {!expanded ? (
          <Pressable
            onPress={open}
            style={styles.iconBtn}
            accessibilityRole="search"
            accessibilityLabel="Open search"
          >
            <Ionicons name="search" size={20} color="#0f766e" />
          </Pressable>
        ) : (
          <View style={styles.row}>
            <View style={styles.leadingIcon}>
              <Ionicons name="search" size={18} color="#0f766e" />
            </View>
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor="#9CA3AF"
              returnKeyType="search"
              autoCorrect
              onSubmitEditing={() => onSubmit(value)}
              onBlur={() => {
                if (!value.trim()) {
                  close();
                }
              }}
              style={styles.input}
            />
            {!!value && (
              <Pressable
                onPress={() => onChangeText?.('')}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Clear"
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </Pressable>
            )}
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8, alignItems: 'flex-start' },
  glow: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 0,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(45,212,191,0.25)',
    ...(Platform.OS === 'web' ? { filter: 'blur(12px)' as any } : {})
  },
  bar: {
    height: 48,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    overflow: 'hidden'
  },
  iconBtn: { height: 48, width: 56, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', height: 48 },
  input: { flex: 1, fontSize: 16, color: '#0f172a', paddingVertical: Platform.OS === 'ios' ? 10 : 8 },
  leadingIcon: { marginHorizontal: 10, justifyContent: 'center', alignItems: 'center' },
  clearButton: { paddingHorizontal: 4, paddingVertical: 4, marginHorizontal: 8 }
});
