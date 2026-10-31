import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing, Table } from '@/constants/theme';
import { online, useOnline } from '@/online/client';
import { useWaitingText } from '@/online/use-waiting-text';
import type { HistoryEntry } from '@server/protocol';

interface Row {
  entry: HistoryEntry;
  opponent: string;
  mine: number;
  theirs: number;
  result: 'won' | 'lost' | 'draw';
}

const BADGE = { won: 'V', lost: 'S', draw: 'P' } as const;

const dateFormat = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function HistoryScreen() {
  const { history, status, waitingSince } = useOnline();
  const waitingText = useWaitingText(waitingSince);

  useEffect(() => {
    online.send({ t: 'history' });
  }, []);

  const me = online.playerId;
  const rows: Row[] = (history ?? []).map((entry) => {
    const you = entry.players[0].id === me ? 0 : 1;
    const opp = you === 0 ? 1 : 0;
    return {
      entry,
      opponent: entry.players[opp].name,
      mine: entry.wins[you],
      theirs: entry.wins[opp],
      result: entry.winner === null ? 'draw' : entry.winner === you ? 'won' : 'lost',
    };
  });

  // Bilancio delle serie con ogni avversario.
  const tally = new Map<string, { won: number; lost: number; draw: number }>();
  for (const r of rows) {
    const t = tally.get(r.opponent) ?? { won: 0, lost: 0, draw: 0 };
    t[r.result]++;
    tally.set(r.opponent, t);
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>‹ Indietro</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Storico serie</Text>

          {history === null && (
            <View style={styles.center}>
              <ActivityIndicator color={Table.accent} />
              <Text style={styles.muted}>{status === 'online' ? 'Carico…' : (waitingText ?? 'Connessione al server…')}</Text>
            </View>
          )}
          {history?.length === 0 && <Text style={styles.muted}>Nessuna partita finita, per ora.</Text>}

          {tally.size > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Bilancio</Text>
              {[...tally].map(([name, t]) => (
                <View key={name} style={styles.row}>
                  <Text style={styles.name}>contro {name}</Text>
                  <Text style={styles.tally}>
                    <Text style={styles.win}>{t.won} V</Text>  ·  <Text style={styles.loss}>{t.lost} S</Text>
                    {t.draw > 0 ? `  ·  ${t.draw} P` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {rows.map((r) => (
            <View key={r.entry.id} style={styles.game}>
              <View style={[styles.badge, styles[r.result]]}>
                <Text style={styles.badgeText}>{BADGE[r.result]}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.name}>contro {r.opponent}</Text>
                <Text style={styles.muted}>
                  {dateFormat.format(r.entry.finishedAt)} · serie da {r.entry.series}
                </Text>
              </View>
              <Text style={styles.score}>
                {r.mine}–{r.theirs}
              </Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Table.felt, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, maxWidth: MaxContentWidth },
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  back: { color: Table.feltText, fontSize: 17, fontWeight: 600 },
  content: { padding: Spacing.four, gap: Spacing.two },
  title: { color: Table.accent, fontSize: 32, fontWeight: 900, marginBottom: Spacing.two },
  center: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.four },
  muted: { color: Table.feltTextMuted, fontSize: 13 },
  section: { backgroundColor: Table.feltDark, borderRadius: 16, padding: Spacing.three, gap: 6, marginBottom: Spacing.two },
  sectionTitle: { color: Table.feltText, fontSize: 18, fontWeight: 700 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { color: Table.feltText, fontSize: 16, fontWeight: 600 },
  tally: { color: Table.feltTextMuted, fontSize: 15 },
  win: { color: '#46C46E', fontWeight: 800 },
  loss: { color: '#E5484D', fontWeight: 800 },
  game: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: Table.feltDark,
    borderRadius: 14,
    padding: Spacing.three,
  },
  flex: { flex: 1, gap: 2 },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  won: { backgroundColor: '#46C46E' },
  lost: { backgroundColor: '#E5484D' },
  draw: { backgroundColor: '#8A9A90' },
  badgeText: { color: '#fff', fontWeight: 900 },
  score: { color: Table.feltText, fontSize: 22, fontWeight: 800 },
});
