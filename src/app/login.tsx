import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MenuButton } from '@/components/menu-button';
import { PlayingCard } from '@/components/playing-card';
import { Spacing, Table } from '@/constants/theme';
import { type LoginResult, savePassword, verifyPassword } from '@/online/auth';
import { online, useOnline } from '@/online/client';
import { useWaitingText } from '@/online/use-waiting-text';

const ERRORS: Record<Exclude<LoginResult, 'ok'>, string> = {
  wrong: 'Password sbagliata',
  locked: 'Troppi tentativi: riprova tra un minuto',
  offline: 'Server non raggiungibile, riprova',
};

export default function LoginScreen() {
  const { auth } = useOnline();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [waitingSince, setWaitingSince] = useState<number | null>(null);
  const waitingText = useWaitingText(waitingSince);

  if (auth === 'in') return <Redirect href="/" />;

  const submit = async () => {
    if (!password || waitingSince !== null) return;
    setError(null);
    setWaitingSince(Date.now());
    const result = await verifyPassword(password);
    setWaitingSince(null);
    if (result !== 'ok') {
      setError(ERRORS[result]);
      return;
    }
    await savePassword(password);
    online.setPassword(password);
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
          <Text style={styles.subtitle}>Inserisci la password per entrare</Text>

          <TextInput
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setError(null);
            }}
            placeholder="Password"
            placeholderTextColor="#8A9A90"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            onSubmitEditing={submit}
            returnKeyType="go"
          />
          {error && <Text style={styles.error}>{error}</Text>}
          {waitingText && <Text style={styles.waiting}>{waitingText}</Text>}
          <MenuButton label={waitingSince !== null ? 'Controllo…' : 'Entra'} onPress={submit} disabled={!password || waitingSince !== null} />
          <Text style={styles.hint}>Se hai ricevuto un invito, apri il link che ti hanno mandato: non serve la password.</Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Table.felt },
  safe: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.three, maxWidth: 480, width: '100%', alignSelf: 'center' },
  fan: { flexDirection: 'row', alignSelf: 'center', marginBottom: Spacing.two },
  title: { color: Table.accent, fontSize: 56, fontWeight: 900, textAlign: 'center' },
  subtitle: { color: Table.feltTextMuted, fontSize: 16, textAlign: 'center' },
  input: {
    backgroundColor: Table.feltDark,
    color: Table.feltText,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
  },
  error: { color: '#FF8A8A', fontSize: 15, fontWeight: 700, textAlign: 'center' },
  waiting: { color: Table.accent, fontSize: 14, textAlign: 'center' },
  hint: { color: Table.feltTextMuted, fontSize: 13, textAlign: 'center', marginTop: Spacing.two },
});
