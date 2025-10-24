import { SafeAreaView, StyleSheet } from 'react-native';
import { LibraryScreen } from '@/src/features/library/LibraryScreen';

export default function LibraryRoute() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <LibraryScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA'
  }
});
