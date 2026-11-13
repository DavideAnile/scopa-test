import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
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

import { STICKER_IDS } from '@/constants/stickers';
import { Table } from '@/constants/theme';
import { stickerUri } from '@/online/stickers';
import type { PlayerIndex } from '@scopa';
import { type ChatMessage, MAX_CHAT_LENGTH, REACTIONS } from '@server/protocol';

const QUICK = ['Ciao! 👋', 'Bella! 👏', 'Scopa! 🧹', 'Che fortuna 😅', 'Rivincita? 🔁', 'GG 🤝'];

type Props = {
  messages: ChatMessage[];
  you: PlayerIndex;
  onSend: (text: string) => void;
  onSendSticker: (id: string) => void;
  /** Lasciapassare per gli sticker; null = sticker non disponibili (serve Davide in partita). */
  stickerToken: string | null;
  /** Avvisa che stai scrivendo (true) o hai smesso (false). */
  onTyping?: (on: boolean) => void;
  /** Nome dell'avversario se sta scrivendo adesso, altrimenti null. */
  typingName?: string | null;
  /** Mette (o toglie, con null) la mia reazione a un messaggio. */
  onReact: (id: number, emoji: string | null) => void;
  /** Contatore delle reazioni dell'avversario ai miei messaggi (cresce a ogni nuova). */
  opponentReactions: number;
};

export function ChatPanel({
  messages,
  you,
  onSend,
  onSendSticker,
  stickerToken,
  onTyping,
  typingName,
  onReact,
  opponentReactions,
}: Props) {
  const stickersEnabled = stickerToken !== null;
  const stickerSource = (id: string) => {
    const uri = stickerToken ? stickerUri(id, stickerToken) : null;
    return uri ? { uri } : null;
  };
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const [draft, setDraft] = useState('');
  // Sezione "Sticker" aperta sotto i messaggi, come la tastiera degli sticker di WhatsApp.
  const [stickersOpen, setStickersOpen] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);

  // Messaggio su cui si sta scegliendo la reazione (barretta delle emoji aperta).
  const [reactingTo, setReactingTo] = useState<number | null>(null);
  const [reactionsSeen, setReactionsSeen] = useState(opponentReactions);

  const unread = open
    ? 0
    : messages.slice(seen).filter((m) => m.from !== you).length + (opponentReactions > reactionsSeen ? 1 : 0);

  // Vibrazione quando l'avversario reagisce a un mio messaggio.
  const reactionsRef = useRef(opponentReactions);
  useEffect(() => {
    if (opponentReactions === reactionsRef.current) return;
    reactionsRef.current = opponentReactions;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [opponentReactions]);

  const react = (id: number, emoji: string, current: string | null) => {
    onReact(id, current === emoji ? null : emoji);
    setReactingTo(null);
  };

  // Vibrazione quando arriva un messaggio nuovo dell'avversario (non per quelli già presenti all'apertura).
  const last = messages.at(-1);
  const lastId = useRef(last?.id);
  useEffect(() => {
    if (!last || last.id === lastId.current) return;
    lastId.current = last.id;
    if (last.from !== you) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [last, you]);

  const close = () => {
    onTyping?.(false);
    setSeen(messages.length);
    setReactionsSeen(opponentReactions);
    setReactingTo(null);
    setOpen(false);
  };

  const changeDraft = (text: string) => {
    setDraft(text);
    onTyping?.(text.trim().length > 0);
  };

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    onTyping?.(false);
    onSend(t);
    setDraft('');
  };

  const sendSticker = (id: string) => {
    onTyping?.(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSendSticker(id);
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
            <View>
              <Text style={styles.title}>Chat</Text>
              {typingName && <Text style={styles.typing}>{typingName} sta scrivendo…</Text>}
            </View>
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
              {messages.length === 0 && (
                <Text style={styles.empty}>
                  Nessun messaggio. Saluta il tuo avversario!{'\n'}Tieni premuto un messaggio per reagire.
                </Text>
              )}
              {messages.map((m) => {
                const mine = m.from === you;
                const myReaction = m.reactions?.[you] ?? null;
                const shown = (m.reactions ?? []).filter((r): r is string => !!r);
                const source = m.sticker ? stickerSource(m.sticker) : null;
                return (
                  <View key={m.id} style={[styles.msg, mine ? styles.alignEnd : styles.alignStart]}>
                    {reactingTo === m.id && (
                      <View style={styles.reactBar}>
                        {REACTIONS.map((e) => (
                          <Pressable
                            key={e}
                            onPress={() => react(m.id, e, myReaction)}
                            accessibilityLabel={`Reagisci ${e}`}
                            style={({ pressed }) => [styles.reactBtn, myReaction === e && styles.reactBtnOn, pressed && styles.pressed]}>
                            <Text style={styles.reactEmoji}>{e}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                    <Pressable
                      onLongPress={() => setReactingTo(m.id)}
                      onPress={() => setReactingTo(null)}
                      delayLongPress={350}
                      accessibilityLabel={`Messaggio ${m.id}`}>
                      {m.sticker ? (
                        <View style={[styles.stickerMsg, mine ? styles.alignEnd : styles.alignStart]}>
                          {!mine && <Text style={styles.author}>{m.name}</Text>}
                          {source ? (
                            <Image source={source} style={styles.stickerImage} contentFit="contain" />
                          ) : (
                            <Text style={styles.text}>[sticker]</Text>
                          )}
                        </View>
                      ) : (
                        <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                          {!mine && <Text style={styles.author}>{m.name}</Text>}
                          <Text style={[styles.text, mine && styles.textMine]}>{m.text}</Text>
                        </View>
                      )}
                    </Pressable>
                    {shown.length > 0 && (
                      <View style={styles.reactions}>
                        <Text style={styles.reactionsText}>{shown.join(' ')}</Text>
                      </View>
                    )}
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
              {stickersEnabled && (
                <Pressable
                  onPress={() => setStickersOpen((v) => !v)}
                  accessibilityLabel="Sticker"
                  style={({ pressed }) => [styles.stickerBtn, stickersOpen && styles.stickerBtnOn, pressed && styles.pressed]}>
                  <Text style={[styles.stickerBtnText, stickersOpen && styles.stickerBtnTextOn]}>Sticker</Text>
                </Pressable>
              )}
              <TextInput
                value={draft}
                onChangeText={changeDraft}
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
                accessibilityLabel="Invia"
                style={({ pressed }) => [styles.sendBtn, (!draft.trim() || pressed) && styles.pressed]}>
                <SymbolView
                  name={{ ios: 'paperplane.fill', android: 'send', web: 'send' }}
                  tintColor="#2B2100"
                  size={22}
                  fallback={<Text style={styles.sendText}>➤</Text>}
                />
              </Pressable>
            </View>
            {stickersEnabled && stickersOpen && (
              <ScrollView style={styles.stickerPanel} contentContainerStyle={styles.stickerGrid}>
                {STICKER_IDS.map((id) => (
                  <Pressable
                    key={id}
                    onPress={() => sendSticker(id)}
                    accessibilityLabel={`Invia ${id}`}
                    style={({ pressed }) => [styles.stickerCell, pressed && styles.pressed]}>
                    <Image source={stickerSource(id)} style={styles.stickerThumb} contentFit="contain" />
                  </Pressable>
                ))}
              </ScrollView>
            )}
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
  typing: { color: Table.accent, fontSize: 13, fontStyle: 'italic', marginTop: 2 },
  list: { padding: 16, gap: 8 },
  empty: { color: Table.feltTextMuted, textAlign: 'center', marginTop: 24 },
  msg: { maxWidth: '80%', gap: 2 },
  bubble: { borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12 },
  reactBar: {
    flexDirection: 'row',
    gap: 2,
    backgroundColor: Table.cardFace,
    borderRadius: 22,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginBottom: 4,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
  },
  reactBtn: { borderRadius: 16, paddingHorizontal: 5, paddingVertical: 2 },
  reactBtnOn: { backgroundColor: '#F5C54266' },
  reactEmoji: { fontSize: 24 },
  reactions: {
    marginTop: -6,
    backgroundColor: Table.feltDark,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFFFFF30',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  reactionsText: { fontSize: 13 },
  mine: { backgroundColor: Table.accent, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: Table.felt, borderBottomLeftRadius: 4 },
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
    // Sul web il campo ha una larghezza minima propria: senza questo spinge fuori il tasto di invio.
    minWidth: 0,
  },
  sendBtn: {
    backgroundColor: Table.accent,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  sendText: { color: '#2B2100', fontSize: 20 },
  stickerBtn: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Table.accent,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  stickerBtnOn: { backgroundColor: Table.accent },
  stickerBtnText: { color: Table.accent, fontWeight: 800, fontSize: 15 },
  stickerBtnTextOn: { color: '#2B2100' },
  stickerPanel: { flexGrow: 0, maxHeight: 280, borderTopWidth: 1, borderTopColor: '#FFFFFF20' },
  stickerGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
  stickerCell: { width: '25%', aspectRatio: 1, padding: 6 },
  stickerThumb: { flex: 1 },
  stickerMsg: { gap: 2 },
  alignEnd: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  alignStart: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  stickerImage: { width: 130, height: 130 },
});
