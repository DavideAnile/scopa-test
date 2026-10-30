import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/menu-button';
import { PlayingCard } from '@/components/playing-card';
import { MaxContentWidth, Spacing, Table } from '@/constants/theme';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.hero}>
          <View style={styles.fan}>
            <View style={{ marginRight: -14, transform: [{ rotate: '-12deg' }] }}>
              <PlayingCard card="1C" />
            </View>
            <View style={{ transform: [{ translateY: -8 }] }}>
              <PlayingCard card="7D" />
            </View>
            <View style={{ marginLeft: -14, transform: [{ rotate: '12deg' }] }}>
              <PlayingCard card="10S" />
            </View>
          </View>
          <Text style={styles.title}>Scopa</Text>
          <Text style={styles.subtitle}>Senza pubblicità, quante partite vuoi.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contro il computer</Text>
          <View style={styles.row}>
            <MenuButton label="Serie da 10" style={styles.grow} onPress={() => router.push('/game/local?series=10')} />
            <MenuButton label="Serie da 15" style={styles.grow} onPress={() => router.push('/game/local?series=15')} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Con un amico</Text>
          <Text style={styles.sectionText}>Crea una partita e condividi il codice, con chat, rivincite e storico.</Text>
          <View style={styles.row}>
            <MenuButton label="Gioca online" style={styles.grow} onPress={() => router.push('/online')} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Table.felt,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  fan: {
    flexDirection: 'row',
    marginBottom: Spacing.three,
  },
  title: {
    color: Table.accent,
    fontSize: 56,
    fontWeight: 900,
    letterSpacing: 1,
  },
  subtitle: {
    color: Table.feltTextMuted,
    fontSize: 16,
    fontWeight: 500,
  },
  section: {
    gap: Spacing.two,
    backgroundColor: Table.feltDark,
    borderRadius: 16,
    padding: Spacing.three,
  },
  sectionTitle: {
    color: Table.feltText,
    fontSize: 18,
    fontWeight: 700,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  grow: {
    flex: 1,
  },
  sectionText: {
    color: Table.feltTextMuted,
    fontSize: 14,
  },
});
