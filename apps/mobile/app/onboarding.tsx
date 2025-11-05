import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const ONBOARDING_STEPS = [
  'Capture lists by text, voice, or photo.',
  'Scan receipts to track per-store prices.',
  'Compare unit prices instantly across stores.',
  'Visualize spending trends with a calendar heatmap.'
] as const;

export default function OnboardingScreen() {
  const router = useRouter();

  const handleContinue = useCallback(() => {
    router.replace('/auth/sign-up');
  }, [router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Why Smart Shopper?</Text>
        {ONBOARDING_STEPS.map((step, index) => (
          <View key={step} style={styles.stepRow}>
            <Text style={styles.stepIndex}>{index + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable onPress={handleContinue} style={styles.primaryButton} accessibilityRole="button">
          <Text style={styles.primaryButtonLabel}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0C1D37'
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 32
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 24
  },
  stepIndex: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4FD1C5',
    width: 24
  },
  stepText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: '#E0E6F1'
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24
  },
  primaryButton: {
    backgroundColor: '#4FD1C5',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonLabel: {
    color: '#0C1D37',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  }
});
