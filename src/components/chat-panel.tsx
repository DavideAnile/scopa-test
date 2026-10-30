import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Table } from '@/constants/theme';
import type { PlayerIndex } from '@scopa';
import { type ChatMessage, MAX_CHAT_LENGTH } from '@server/protocol';

const QUICK = ['Ciao! 👋', 'Bella! 👏', 'Scopa! 🧹', 'Che fortuna 😅', 'Rivincita? 🔁', 'GG 🤝'];

type Props = {
  messages: ChatMessage[];
  you: PlayerIndex;
  onSend: (text: string) => void;
};

export function ChatPanel({ messages, you, onSend }: Props) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const [draft, setDraft] = useState('');
  const scroll = useRef<ScrollViewInstance>(null);

  const unread = open ? 0 : messages.slice(seen).filter((m) => m.from !== you).length;

  // Vibrazione quando arriva un messaggio nuovo dell'avversario (non per quelli già presenti all'apertura).
  const last = messages.at(-1);
  const lastId = useRef(last?.id);
  useEffect(() => {
    if (!last || last.id === lastId.current) return;
    lastId.current = last.id;
    if (last.from !== you) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [last, you]);

  const close = () => {
    setSeen(messages.length);
    setOpen(false);
  };

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setDraft('');
  };

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={10} accessibilityLabel="Chat">
        <Text style={styles.icon}>💬</Text>
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread}</Text>
          </View>
        )}
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.header}>
            <Text style={styles.title}>Chat</Text>
            <Pressable onPress={close} hitSlop={10}>
              <Text style={styles.done}>Fatto</Text>
            </Pressable>
          </View>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              ref={scroll}
              style={styles.flex}
              contentContainerStyle={styles.list}
              onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
              {messages.length === 0 && <Text style={styles.empty}>Nessun messaggio. Saluta il tuo avversario!</Text>}
              {messages.map((m) => {
                const mine = m.from === you;
                return (
                  <View key={m.id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                    {!mine && <Text style={styles.author}>{m.name}</Text>}
                    <Text style={[styles.text, mine && styles.textMine]}>{m.text}</Text>
                  </View>
                );
              })}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.quickBar}
              contentContainerStyle={styles.quick}>
              {QUICK.map((q) => (
                <Pressable key={q} onPress={() => send(q)} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
                  <Text style={styles.chipText}>{q}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.inputRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Scrivi un messaggio…"
                placeholderTextColor="#8A9A90"
                style={styles.input}
                maxLength={MAX_CHAT_LENGTH}
                returnKeyType="send"
                onSubmitEditing={() => send(draft)}
                submitBehavior="submit"
              />
              <Pressable
                onPress={() => send(draft)}
                disabled={!draft.trim()}
                style={({ pressed }) => [styles.sendBtn, (!draft.trim() || pressed) && styles.pressed]}>
                <Text style={styles.sendText}>Invia</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  icon: { fontSize: 24 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#E5484D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: 800 },
  sheet: { flex: 1, backgroundColor: Table.feltDark },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFFFFF20',
  },
  title: { color: Table.feltText, fontSize: 20, fontWeight: 800 },
  done: { color: Table.accent, fontSize: 17, fontWeight: 700 },
  list: { padding: 16, gap: 8 },
  empty: { color: Table.feltTextMuted, textAlign: 'center', marginTop: 24 },
  bubble: { maxWidth: '80%', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12 },
  mine: { alignSelf: 'flex-end', backgroundColor: Table.accent, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: Table.felt, borderBottomLeftRadius: 4 },
  author: { color: Table.accent, fontSize: 12, fontWeight: 700, marginBottom: 2 },
  text: { color: Table.feltText, fontSize: 16 },
  textMine: { color: '#2B2100' },
  quickBar: { flexGrow: 0 },
  quick: { gap: 8, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' },
  chip: { borderRadius: 16, borderWidth: 1, borderColor: '#FFFFFF40', paddingVertical: 6, paddingHorizontal: 12 },
  chipText: { color: Table.feltText, fontSize: 14 },
  pressed: { opacity: 0.6 },
  inputRow: { flexDirection: 'row', gap: 8, padding: 12, paddingTop: 4 },
  input: {
    flex: 1,
    backgroundColor: Table.felt,
    color: Table.feltText,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
  },
  sendBtn: { backgroundColor: Table.accent, borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center' },
  sendText: { color: '#2B2100', fontWeight: 800, fontSize: 16 },
});
