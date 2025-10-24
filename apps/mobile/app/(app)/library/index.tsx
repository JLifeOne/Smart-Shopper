import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function LibraryScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Library coming soon</Text>
        <Text style={styles.body}>This route is in place so navigation works while we wire the full library experience.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    gap: 12,
    shadowColor: '#101828',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
    maxWidth: 320
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0C1D37'
  },
  body: {
    fontSize: 14,
    color: '#4A576D'
  }
});
