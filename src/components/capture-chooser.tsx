import { Fragment } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CardFace } from '@/components/playing-card';
import { Table } from '@/constants/theme';
import { type Card, cardName } from '@scopa';

type Props = {
  /** Carta che si vuole giocare; null = riquadro chiuso. */
  card: Card | null;
  /** Prese possibili (già filtrate dalla regola: la carta uguale è obbligatoria). */
  options: Card[][];
  onChoose: (capture: Card[]) => void;
  onCancel: () => void;
};

/** Quando una carta può prendere in più modi (es. 9 con 7+2 oppure 5+4), si sceglie qui. */
export function CaptureChooser({ card, options, onChoose, onCancel }: Props) {
  return (
    <Modal visible={card !== null} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        {card && (
          <View style={styles.sheet}>
            <View style={styles.header}>
              <CardFace card={card} width={40} />
              <Text style={styles.title}>Cosa vuoi prendere col {cardName(card).toLowerCase()}?</Text>
            </View>
            <ScrollView contentContainerStyle={styles.list}>
              {options.map((option) => (
                <Pressable
                  key={option.join('-')}
                  onPress={() => onChoose(option)}
                  accessibilityLabel={`Prendi ${option.map(cardName).join(' e ')}`}
                  style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
                  {option.map((c, i) => (
                    <Fragment key={c}>
                      {i > 0 && <Text style={styles.plus}>+</Text>}
                      <CardFace card={c} width={48} />
                    </Fragment>
                  ))}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={onCancel} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
              <Text style={styles.cancelText}>Annulla</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
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
    maxHeight: '85%',
    backgroundColor: Table.feltDark,
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#FFFFFF30',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, color: Table.accent, fontSize: 19, fontWeight: 800 },
  list: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Table.felt,
    borderWidth: 1,
    borderColor: '#FFFFFF30',
  },
  plus: { color: Table.feltText, fontSize: 20, fontWeight: 800 },
  pressed: { opacity: 0.7 },
  cancel: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Table.feltText,
  },
  cancelText: { color: Table.feltText, fontSize: 16, fontWeight: 700 },
});
