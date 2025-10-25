import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

type Trigger = (message: string, duration?: number) => void;

let trigger: Trigger = () => {};

export const Toast = {
  show(message: string, duration = 1300) {
    trigger(message, duration);
  },
  Host: ToastHost
};

function ToastHost() {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    trigger = (nextMessage, duration = 1300) => {
      setMessage(nextMessage);
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.delay(duration),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true })
      ]).start(({ finished }) => {
        if (finished) {
          setMessage(null);
        }
      });
    };

    return () => {
      trigger = () => {};
    };
  }, [opacity]);

  if (!message) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.toast}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: 'center'
  },
  toast: {
    backgroundColor: '#0f766e',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: '#0c1d37',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5
  },
  text: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600'
  }
});
