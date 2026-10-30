import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Table } from '@/constants/theme';
import type { Pair, PlayerView } from '@scopa';

/** Quando la partita la vince Davide, compare questo messaggio a entrambi i giocatori. */
const LOVE_NAME = 'davide';
const LOVE_MESSAGE = 'Amore sei scarsa ma ti amo lo stesso';

type Props = {
  visible: boolean;
  /** La vista mostrata a fine partita (status roundOver o finished). */
  view: PlayerView;
  /** Nomi indicizzati per giocatore (0 e 1). */
  names: Pair<string>;
  /** Assente = l'utente ha già premuto Continua e si aspetta l'altro. */
  onContinue?: () => void;
  onRematch?: () => void;
  onExit: () => void;
  /** Riga informativa sopra i pulsanti (es. "In attesa di Marco…"). */
  note?: string;
};

const mark = (won: boolean) => (won ? '✓' : '');

export function RoundSummary({ visible, view, names, onContinue, onRematch, onExit, note }: Props) {
  const result = view.rounds.at(-1);
  if (!result) return null;
  const { stats, winners, points } = result;
  const me = view.you;
  const finished = view.status === 'finished';

  const roundWinner = result.winner;
  let roundLine: string;
  if (roundWinner === null) roundLine = 'Pareggio';
  else if (roundWinner === me) roundLine = 'Hai vinto tu!';
  else roundLine = `Vince ${names[roundWinner]}`;

  let title = `Partita ${view.rounds.length} di ${view.series}`;
  if (finished) {
    if (view.winner === null) title = 'Serie in pareggio';
    else if (view.winner === me) title = 'Hai vinto la serie! 🏆';
    else title = `${names[view.winner]} vince la serie`;
  }

  const love = roundWinner !== null && names[roundWinner].trim().toLowerCase() === LOVE_NAME;

  const rows: [string, string, string][] = [
    ['Carte', `${stats[0].cards} ${mark(winners.cards === 0)}`, `${stats[1].cards} ${mark(winners.cards === 1)}`],
    ['Denari', `${stats[0].denari} ${mark(winners.denari === 0)}`, `${stats[1].denari} ${mark(winners.denari === 1)}`],
    ['Settebello', mark(winners.settebello === 0), mark(winners.settebello === 1)],
    [
      'Primiera',
      `${stats[0].primiera ?? '—'} ${mark(winners.primiera === 0)}`,
      `${stats[1].primiera ?? '—'} ${mark(winners.primiera === 1)}`,
    ],
    ['Scope', String(stats[0].scope), String(stats[1].scope)],
  ];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{finished ? `Ultima partita: ${roundLine.toLowerCase()}` : roundLine}</Text>

          {love && (
            <Animated.View entering={ZoomIn.springify().damping(10)} style={styles.love}>
              <Text style={styles.loveText}>💕 {LOVE_MESSAGE} 💕</Text>
            </Animated.View>
          )}

          <View style={styles.row}>
            <Text style={[styles.cell, styles.head]} />
            <Text style={[styles.cell, styles.head]} numberOfLines={1}>
              {names[0]}
            </Text>
            <Text style={[styles.cell, styles.head]} numberOfLines={1}>
              {names[1]}
            </Text>
          </View>
          {rows.map(([label, a, b]) => (
            <View key={label} style={styles.row}>
              <Text style={[styles.cell, styles.rowLabel]}>{label}</Text>
              <Text style={styles.cell}>{a}</Text>
              <Text style={styles.cell}>{b}</Text>
            </View>
          ))}
          <View style={[styles.row, styles.totalRow]}>
            <Text style={[styles.cell, styles.rowLabel]}>Punti</Text>
            <Text style={[styles.cell, styles.bold, roundWinner === 0 && styles.winner]}>{points[0]}</Text>
            <Text style={[styles.cell, styles.bold, roundWinner === 1 && styles.winner]}>{points[1]}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.cell, styles.rowLabel]}>Partite vinte</Text>
            <Text style={[styles.cell, styles.big]}>{view.wins[0]}</Text>
            <Text style={[styles.cell, styles.big]}>{view.wins[1]}</Text>
          </View>

          {note && <Text style={styles.note}>{note}</Text>}
          <View style={styles.buttons}>
            {finished ? (
              <>
                {onRematch && <Button label="Rivincita" onPress={onRematch} primary />}
                <Button label="Esci" onPress={onExit} />
              </>
            ) : (
              onContinue && <Button label="Continua" onPress={onContinue} primary />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Button({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, primary && styles.buttonPrimary, pressed && { opacity: 0.8 }]}>
      <Text style={[styles.buttonText, primary && styles.buttonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000A0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    alignSelf: 'stretch',
    maxWidth: 420,
    backgroundColor: Table.feltDark,
    borderRadius: 16,
    padding: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FFFFFF30',
  },
  title: { color: Table.accent, fontSize: 24, fontWeight: 800, textAlign: 'center' },
  subtitle: { color: Table.feltText, fontSize: 17, fontWeight: 700, textAlign: 'center', marginBottom: 8 },
  love: {
    backgroundColor: '#F7C6D9',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  loveText: { color: '#8E1B4F', fontSize: 18, fontWeight: 800, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#FFFFFF30', paddingTop: 6, marginTop: 4 },
  cell: { flex: 1, color: Table.feltText, fontSize: 16, textAlign: 'center' },
  head: { fontWeight: 700, color: Table.feltTextMuted },
  rowLabel: { textAlign: 'left', color: Table.feltTextMuted },
  bold: { fontWeight: 800 },
  winner: { color: Table.accent },
  big: { fontWeight: 800, fontSize: 22 },
  note: { color: Table.accent, fontSize: 15, fontWeight: 600, textAlign: 'center', marginTop: 12 },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 16, justifyContent: 'center' },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Table.feltText,
  },
  buttonPrimary: { backgroundColor: Table.accent, borderColor: Table.accent },
  buttonText: { color: Table.feltText, fontSize: 16, fontWeight: 700 },
  buttonTextPrimary: { color: '#2B2100' },
});
