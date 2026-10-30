import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { CARD_ASPECT, CARD_IMAGES } from '@/constants/card-images';
import { Table } from '@/constants/theme';
import type { Card } from '@scopa';

export function CardFace({ card, width, highlighted }: { card: Card; width: number; highlighted?: boolean }) {
  return (
    <View style={[styles.card, cardBox(width), highlighted && styles.highlighted]}>
      <Image source={CARD_IMAGES[card]} style={styles.image} contentFit="contain" />
    </View>
  );
}

export function CardBack({ width }: { width: number }) {
  return (
    <View style={[styles.card, styles.back, cardBox(width)]}>
      <View style={styles.backInner}>
        <View style={styles.backDiamond} />
      </View>
    </View>
  );
}

/** Carta statica (es. nella home). Le carte in gioco sono animate dal tavolo. */
export function PlayingCard({ card, width = 64 }: { card?: Card; width?: number }) {
  return card ? <CardFace card={card} width={width} /> : <CardBack width={width} />;
}

export function cardBox(width: number) {
  return { width, height: Math.round(width * CARD_ASPECT), borderRadius: Math.max(4, width * 0.09) };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Table.cardFace,
    borderWidth: 1,
    borderColor: Table.cardBorder,
    overflow: 'hidden',
    padding: 3,
  },
  image: {
    flex: 1,
  },
  highlighted: {
    borderColor: Table.selected,
    borderWidth: 3,
  },
  back: {
    backgroundColor: Table.cardBack,
    borderColor: '#F3EFE0',
    borderWidth: 2,
  },
  backInner: {
    flex: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#F3EFE070',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backDiamond: {
    width: '45%',
    aspectRatio: 1,
    borderWidth: 1.5,
    borderColor: '#F3EFE0A0',
    transform: [{ rotate: '45deg' }],
  },
});
