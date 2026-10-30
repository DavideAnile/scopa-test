import * as Haptics from 'expo-haptics';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Board } from '@/components/board';
import { Table } from '@/constants/theme';
import type { Scene } from '@/game/scene';
import { type Card, type Pair, type PlayerView, bestCapture, legalCaptures, matchCapture, other } from '@scopa';

type Props = {
  /** Stato reale e aggiornato (per decidere le mosse). */
  view: PlayerView;
  /** Quello che si vede: scena animata e punteggi "in ritardo" rispetto a `view`. */
  scene: Scene;
  shown: PlayerView;
  busy: boolean;
  /** Nomi indicizzati per giocatore (0 e 1), non per "tu/avversario". */
  names: Pair<string>;
  onPlay: (card: Card, capture: Card[]) => void;
  onExit: () => void;
  headerRight?: ReactNode;
  /** Avviso sotto la barra in alto (es. avversario disconnesso). */
  notice?: string | null;
};

export function GameTable({ view, scene, shown, busy, names, onPlay, onExit, headerRight, notice }: Props) {
  const me = view.you;
  const opp = other(me);
  const myTurn = view.status === 'playing' && view.turn === me && !busy;

  // Carte del tavolo scelte in anticipo (serve solo se ci sono più prese possibili).
  // Valgono solo per il tavolo su cui sono state scelte: dopo una mossa si azzerano da sole.
  const [picked, setPicked] = useState<{ table: Card[]; cards: Card[] }>({ table: [], cards: [] });
  const chosen = picked.table === view.table ? picked.cards : [];

  const togglePick = (card: Card) => {
    const next = chosen.includes(card) ? chosen.filter((c) => c !== card) : [...chosen, card];
    setPicked({ table: view.table, cards: next });
  };

  const playCard = (card: Card) => {
    if (!myTurn || !view.hand.includes(card)) {
      if (view.table.includes(card) && myTurn) togglePick(card);
      return;
    }
    const options = legalCaptures(card, view.table);
    const preselected = chosen.length > 0 ? matchCapture(card, view.table, chosen) : null;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPlay(card, preselected ?? bestCapture(card, options));
  };

  const bannerKey = scene.banner?.key;
  useEffect(() => {
    if (bannerKey) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [bannerKey]);

  let hint: string;
  if (view.status === 'finished') hint = 'Serie finita';
  else if (view.status === 'roundOver') hint = 'Fine partita';
  else if (busy) hint = ' ';
  else if (!myTurn) hint = `Tocca a ${names[opp]}…`;
  else if (chosen.length > 0) hint = 'Ora tocca la carta da giocare';
  else hint = 'Tocca a te';

  return (
    <View style={styles.felt}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable onPress={onExit} hitSlop={12}>
            <Text style={styles.exit}>‹ Esci</Text>
          </Pressable>
          <Text style={styles.score} numberOfLines={1}>
            {shown.wins[me]} – {shown.wins[opp]}
            <Text style={styles.muted}>
              {'  '}partita {shown.roundNo}/{shown.series}
            </Text>
          </Text>
          <View style={styles.topRight}>{headerRight}</View>
        </View>

        {notice && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        )}

        <Board scene={scene} names={[names[0], names[1]]} onPressCard={playCard} highlighted={chosen} />

        <View style={styles.hintRow}>
          <Text style={[styles.hint, myTurn && styles.hintActive]}>{hint}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  felt: { flex: 1, backgroundColor: Table.felt },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  topRight: { minWidth: 60, alignItems: 'flex-end' },
  exit: { color: Table.feltText, fontSize: 17, fontWeight: 600, minWidth: 60 },
  score: { color: Table.feltText, fontSize: 22, fontWeight: 800 },
  muted: { color: Table.feltTextMuted, fontSize: 14, fontWeight: 500 },
  notice: {
    marginHorizontal: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#00000040',
  },
  noticeText: { color: Table.accent, fontSize: 14, fontWeight: 700, textAlign: 'center' },
  hintRow: { height: 36, alignItems: 'center', justifyContent: 'center' },
  hint: { color: Table.feltTextMuted, fontSize: 16, fontWeight: 600 },
  hintActive: { color: Table.accent, fontWeight: 800 },
});
