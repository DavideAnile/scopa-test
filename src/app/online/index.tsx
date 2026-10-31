import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/menu-button';
import { MaxContentWidth, Spacing, Table } from '@/constants/theme';
import { GAME_SERVER, online, useOnline } from '@/online/client';
import { type Identity, loadIdentity, saveIdentity } from '@/online/identity';
import { useWaitingText } from '@/online/use-waiting-text';

const STATUS_TEXT = {
  idle: 'Non collegato',
  connecting: 'Connessione…',
  online: 'Collegato',
  offline: 'Server non raggiungibile, riprovo…',
} as const;

export default function OnlineHomeScreen() {
  const { status, room, waitingSince } = useOnline();
  const waitingText = useWaitingText(waitingSince);
  // Il link d'invito (…/online?code=ABCD) precompila il codice.
  const params = useLocalSearchParams<{ code?: string }>();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState(() => (params.code ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4));

  useEffect(() => {
    loadIdentity().then((id) => {
      setIdentity(id);
      setName(id.name);
      if (id.name) online.connect(id.playerId, id.name);
    });
  }, []);

  const cleanName = name.trim().slice(0, 20);

  /** Salva il nome se è cambiato e si assicura di essere collegati. */
  const ensureName = () => {
    if (!identity || !cleanName) return false;
    if (cleanName !== identity.name) {
      const next = { ...identity, name: cleanName };
      setIdentity(next);
      saveIdentity(next);
    }
    online.connect(identity.playerId, cleanName);
    return true;
  };

  const create = (series: 10 | 15) => {
    if (!ensureName()) return;
    online.send({ t: 'create', series });
    router.push('/online/room');
  };

  const join = () => {
    if (!ensureName() || code.trim().length !== 4) return;
    online.send({ t: 'join', code: code.trim().toUpperCase() });
    router.push('/online/room');
  };

  if (!GAME_SERVER) {
    return (
      <Screen>
        <Text style={styles.title}>Gioca con un amico</Text>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Server non avviato</Text>
          <Text style={styles.text}>
            Sul Mac avvia il server con <Text style={styles.code}>npm run party</Text> e riapri l&apos;app dal QR
            che compare nel terminale.
          </Text>
        </View>
        <MenuButton label="Indietro" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Home</Text>
        </Pressable>
        <View style={styles.status}>
          <View style={[styles.dot, status === 'online' && styles.dotOnline]} />
          <Text style={styles.statusText}>{STATUS_TEXT[status]}</Text>
        </View>
      </View>
      <Text style={styles.title}>Gioca con un amico</Text>
      {waitingText && <Text style={styles.waiting}>{waitingText}</Text>}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Il tuo nome</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          onBlur={ensureName}
          placeholder="Come ti chiami?"
          placeholderTextColor="#8A9A90"
          style={styles.input}
          maxLength={20}
          autoCorrect={false}
          returnKeyType="done"
        />
      </View>

      {room && (
        <MenuButton label={`Torna alla partita ${room.code}`} onPress={() => router.push('/online/room')} />
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Crea una partita</Text>
        <Text style={styles.text}>Una serie di 10 o 15 partite: vince chi ne vince di più.</Text>
        <View style={styles.row}>
          <MenuButton label="Serie da 10" style={styles.grow} onPress={() => create(10)} disabled={!cleanName} />
          <MenuButton label="Serie da 15" style={styles.grow} onPress={() => create(15)} disabled={!cleanName} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Entra con un codice</Text>
        <View style={styles.row}>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
            placeholder="ABCD"
            placeholderTextColor="#8A9A90"
            style={[styles.input, styles.codeInput]}
            autoCapitalize="characters"
            autoCorrect={false}
            onSubmitEditing={join}
            returnKeyType="go"
          />
          <MenuButton label="Entra" style={styles.grow} onPress={join} disabled={!cleanName || code.length !== 4} />
        </View>
      </View>

      <MenuButton
        label="Storico partite"
        variant="outline"
        disabled={!cleanName}
        onPress={() => ensureName() && router.push('/online/history')}
      />
    </Screen>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Table.felt, flexDirection: 'row', justifyContent: 'center' },
  safe: { flex: 1, maxWidth: MaxContentWidth },
  flex: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: Table.feltText, fontSize: 17, fontWeight: 600 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5484D' },
  dotOnline: { backgroundColor: '#46C46E' },
  statusText: { color: Table.feltTextMuted, fontSize: 13 },
  title: { color: Table.accent, fontSize: 32, fontWeight: 900 },
  waiting: {
    color: Table.accent,
    fontSize: 15,
    fontWeight: 700,
    backgroundColor: '#00000030',
    borderRadius: 12,
    padding: Spacing.three,
  },
  section: { gap: Spacing.two, backgroundColor: Table.feltDark, borderRadius: 16, padding: Spacing.three },
  sectionTitle: { color: Table.feltText, fontSize: 18, fontWeight: 700 },
  text: { color: Table.feltTextMuted, fontSize: 14, lineHeight: 20 },
  code: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), color: Table.accent },
  row: { flexDirection: 'row', gap: Spacing.two },
  grow: { flex: 1 },
  input: {
    backgroundColor: Table.felt,
    color: Table.feltText,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
  },
  codeInput: { flex: 1, letterSpacing: 6, fontWeight: 800, textAlign: 'center' },
});
