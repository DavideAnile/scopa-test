import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatPanel } from '@/components/chat-panel';
import { GameTable } from '@/components/game-table';
import { MenuButton } from '@/components/menu-button';
import { RoundSummary } from '@/components/round-summary';
import { Spacing, Table } from '@/constants/theme';
import { useTableScene } from '@/game/use-table-scene';
import { ERROR_TEXT, type OnlineState, inviteLink, online, useOnline } from '@/online/client';
import { type Card, type Pair, type PlayerView, other } from '@scopa';
import type { RoomInfo } from '@server/protocol';

/** Tutto quello che serve all'amico in un solo messaggio: si gioca da Safari, niente da installare. */
function invite(code: string) {
  const link = inviteLink(code);
  if (!link) return Share.share({ message: `Giochiamo a scopa! 🃏 Entra con il codice ${code}` });
  const text = 'Giochiamo a scopa! 🃏 Apri il link con Safari, scegli il tuo nome e tocca Entra.';
  // Su iOS il link passato come `url` diventa un link vero (cliccabile in WhatsApp/iMessage).
  return Platform.OS === 'ios' ? Share.share({ message: text, url: link }) : Share.share({ message: `${text}\n${link}` });
}

const leaveAndGoBack = () => {
  online.send({ t: 'leave' });
  router.back();
};

export default function RoomScreen() {
  const state = useOnline();
  const { room, view, error, closedByOpponent } = state;

  if (closedByOpponent) {
    return (
      <Message title="Partita chiusa" text="Il tuo avversario ha lasciato la partita.">
        <MenuButton label="Indietro" onPress={() => router.back()} />
      </Message>
    );
  }

  if (!room) {
    if (error) {
      return (
        <Message title="Ops" text={ERROR_TEXT[error.code] ?? 'Qualcosa è andato storto.'}>
          <MenuButton label="Indietro" onPress={() => router.back()} />
        </Message>
      );
    }
    return (
      <Message title="Un attimo…" text={state.status === 'online' ? 'Preparo la partita' : 'Connessione al server'}>
        <ActivityIndicator color={Table.accent} size="large" />
        <MenuButton label="Annulla" variant="outline" onPress={leaveAndGoBack} />
      </Message>
    );
  }

  if (!view) {
    return (
      <Message title="In attesa dell'amico" text="Mandagli l'invito: gli basta aprire il link con Safari. Il codice della partita è:">
        <Text style={styles.code}>{room.code}</Text>
        <MenuButton label="Invita un amico" onPress={() => invite(room.code).catch(() => {})} />
        <MenuButton label="Annulla" variant="outline" onPress={leaveAndGoBack} />
      </Message>
    );
  }

  return <OnlineGame room={room} view={view} state={state} />;
}

function OnlineGame({ room, view, state }: { room: RoomInfo; view: PlayerView; state: OnlineState }) {
  const { scene, shown, busy } = useTableScene(view);
  // Mossa inviata e non ancora confermata dal server: niente altri tocchi.
  const [sentFor, setSentFor] = useState<number | null>(null);
  const pending = sentFor === view.moveNo;

  const me = room.you;
  const opp = other(me);
  const names: Pair<string> = [room.names[0] ?? '…', room.names[1] ?? '…'];

  const play = (card: Card, capture: Card[]) => {
    setSentFor(view.moveNo);
    online.send({ t: 'play', card, capture, moveNo: view.moveNo });
  };

  const exit = () => {
    if (view.status === 'finished') return leaveAndGoBack();
    Alert.alert('Abbandonare la partita?', "La partita verrà chiusa anche per l'avversario.", [
      { text: 'Resta', style: 'cancel' },
      { text: 'Esci', style: 'destructive', onPress: leaveAndGoBack },
    ]);
  };

  let notice: string | null = null;
  if (state.status !== 'online') notice = 'Connessione persa, mi riconnetto…';
  else if (!room.connected[opp]) notice = `${names[opp]} si è disconnesso, aspetta che torni…`;

  // A fine partita si riparte quando entrambi premono "Continua" (o "Rivincita" a fine serie).
  const votes = shown.status === 'finished' ? room.rematch : room.ready;
  let note: string | undefined;
  if (votes[me]) note = `In attesa di ${names[opp]}…`;
  else if (votes[opp]) note = shown.status === 'finished' ? `${names[opp]} vuole la rivincita!` : `${names[opp]} è pronto`;

  return (
    <>
      <GameTable
        view={view}
        scene={scene}
        shown={shown}
        busy={busy || pending}
        names={names}
        onPlay={play}
        onExit={exit}
        notice={notice}
        headerRight={<ChatPanel messages={state.chat} you={me} onSend={(text) => online.send({ t: 'chat', text })} />}
      />
      <RoundSummary
        visible={!busy && shown.status !== 'playing'}
        view={shown}
        names={names}
        onContinue={room.ready[me] ? undefined : () => online.send({ t: 'continue' })}
        onRematch={room.rematch[me] ? undefined : () => online.send({ t: 'rematch' })}
        onExit={leaveAndGoBack}
        note={note}
      />
    </>
  );
}

function Message({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{text}</Text>
        <View style={styles.actions}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Table.felt },
  safe: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  title: { color: Table.accent, fontSize: 30, fontWeight: 900, textAlign: 'center' },
  text: { color: Table.feltText, fontSize: 16, textAlign: 'center', lineHeight: 22 },
  code: {
    color: Table.feltText,
    fontSize: 64,
    fontWeight: 900,
    letterSpacing: 12,
    textAlign: 'center',
    marginVertical: Spacing.three,
  },
  actions: { gap: Spacing.two, alignItems: 'stretch' },
});
