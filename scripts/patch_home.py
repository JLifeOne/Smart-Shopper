from pathlib import Path
import re
p = Path('apps/mobile/app/(app)/home.tsx')
s = p.read_text(encoding='utf-8', errors='ignore')
# Replace case 'search' with insights
s = re.sub(r"case 'search':\s*return <PlaceholderScreen[^;]+;", "case 'insights':        return <PlaceholderScreen title=\"Insights\" message=\"Insights coming soon.\" />;", s, flags=re.S)
# Insert lists case after promos
s = s.replace("case 'promos':\n        return (\n          <PromosScreen />\n        );", "case 'promos':\n        return (\n          <PromosScreen />\n        );\n      case 'lists':\n        return <PlaceholderScreen title=\"Lists\" message=\"Lists hub coming soon.\" />;")
# Update bottom nav tabs
s = s.replace("{ key: 'search', label: 'Search', icon: activeTab === 'search' ? 'search' : 'search-outline' }", "{ key: 'insights', label: 'Insights', icon: activeTab === 'insights' ? 'stats-chart' : 'stats-chart-outline' }")
s = s.replace("{ key: 'receipts', label: 'Receipts', icon: activeTab === 'receipts' ? 'document-text' : 'document-text-outline' }", "{ key: 'lists', label: 'Lists', icon: activeTab === 'lists' ? 'checkmark-done' : 'checkmark-done-outline' }")
# Add search state if missing
if "const [searchQuery," not in s:
    s = s.replace("const insets = useSafeAreaInsets();", "const insets = useSafeAreaInsets();\n  const [searchQuery, setSearchQuery] = useState('');")
# Prepend GlobalSearchBar above body
if "GlobalSearchBar value" not in s:
    s = s.replace("<SafeAreaView style={newStyles.safeArea} edges={['top', 'bottom']}>", "<SafeAreaView style={newStyles.safeArea} edges={['top', 'bottom']}>\n      <GlobalSearchBar value={searchQuery} onChange={setSearchQuery} />")
# Add GlobalSearchBar component
if "function GlobalSearchBar" not in s:
    s = s.replace("const newStyles = StyleSheet.create({", "function GlobalSearchBar({ value, onChange }: { value: string; onChange: (t: string) => void }) {\n  return (\n    <View style={newStyles.searchContainer}>\n      <View style={newStyles.searchPill}>\n        <Ionicons name=\"search\" size={18} color=\"#64748B\" />\n        <TextInput placeholder=\"Search items, lists, stores\" placeholderTextColor=\"#94A3B8\" value={value} onChangeText={onChange} style={newStyles.searchInput} />\n      </View>\n    </View>\n  );\n}\n\nconst newStyles = StyleSheet.create({")
# Add search styles
if "searchContainer:" not in s:
    s = s.replace("});", ",\n  searchContainer: { paddingHorizontal: 24, paddingTop: 8 },\n  searchPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 24, marginBottom: 8 },\n  searchInput: { flex: 1, color: '#0C1D37' }\n});")

p.write_text(s, encoding='utf-8')
print('patched')