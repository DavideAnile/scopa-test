import { useEffect, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  ZoomIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { CardBack, CardFace, cardBox } from '@/components/playing-card';
import { CARD_ASPECT } from '@/constants/card-images';
import { Table } from '@/constants/theme';
import type { PileInfo, Scene, Spot, Sprite } from '@/game/scene';
import { type Card, type PlayerIndex, other } from '@scopa';

const OPP_SCALE = 0.62;
const PILE_SCALE = 0.6;
const DECK_SCALE = 0.6;
const PAD = 12;
const GAP = 8;
const EASING = Easing.bezier(0.25, 0.8, 0.25, 1);

interface Place {
  x: number; // centro
  y: number;
  rot: number;
  scale: number;
}

interface Layout {
  w: number;
  h: number;
  cardW: number;
  cardH: number;
  oppY: number;
  handY: number;
  pileX: number;
  deckX: number;
  handLeft: number;
  table: { x: number; y: number; w: number; h: number };
}

function computeLayout(w: number, h: number): Layout {
  const cardW = Math.round(Math.min(Math.max(w * 0.18, 52), 96, (h / 6.2) / CARD_ASPECT));
  const cardH = Math.round(cardW * CARD_ASPECT);
  const pileHalf = (cardH * PILE_SCALE) / 2;
  const oppY = PAD + (cardH * OPP_SCALE) / 2;
  const handY = h - PAD - cardH / 2;
  const pileX = PAD + pileHalf + 4;
  const deckX = w - PAD - (cardW * DECK_SCALE) / 2 - 4;
  const tableTop = oppY + (cardH * OPP_SCALE) / 2 + 18;
  const tableBottom = handY - cardH / 2 - 18;
  return {
    w,
    h,
    cardW,
    cardH,
    oppY,
    handY,
    pileX,
    deckX,
    handLeft: pileX + pileHalf + 10,
    table: { x: PAD, y: tableTop, w: w - PAD * 2, h: Math.max(tableBottom - tableTop, cardH) },
  };
}

function tablePlace(L: Layout, index: number, count: number): Place {
  const { table, cardW, cardH } = L;
  const maxRows = Math.max(1, Math.floor((table.h + GAP) / (cardH + GAP)));
  let cols = Math.max(1, Math.floor((table.w + GAP) / (cardW + GAP)));
  if (Math.ceil(count / cols) > maxRows) cols = Math.ceil(count / maxRows);
  const stepX = cols > 1 ? Math.min(cardW + GAP, (table.w - cardW) / (cols - 1)) : 0;
  const rows = Math.ceil(count / cols);
  const r = Math.floor(index / cols);
  const c = index % cols;
  const inRow = Math.min(cols, count - r * cols);
  const rowW = (inRow - 1) * stepX + cardW;
  const totalH = rows * cardH + (rows - 1) * GAP;
  return {
    x: table.x + (table.w - rowW) / 2 + c * stepX + cardW / 2,
    y: table.y + (table.h - totalH) / 2 + r * (cardH + GAP) + cardH / 2,
    rot: 0,
    scale: 1,
  };
}

function pilePlace(L: Layout, mine: boolean): Place {
  return { x: L.pileX, y: mine ? L.handY : L.oppY, rot: 0, scale: PILE_SCALE };
}

function scopaPlace(L: Layout, mine: boolean, k: number): Place {
  const p = pilePlace(L, mine);
  return { ...p, y: p.y + (mine ? -1 : 1) * (6 + k * 7), rot: 90 };
}

function spotPlace(L: Layout, spot: Spot, you: PlayerIndex): Place {
  switch (spot.kind) {
    case 'hand': {
      // Centrata sullo schermo, ma senza finire sopra il mazzetto a sinistra.
      const right = L.w - PAD;
      let step = L.cardW + 10;
      if (spot.count > 1) step = Math.min(step, (right - L.handLeft - L.cardW) / (spot.count - 1));
      const width = (spot.count - 1) * step + L.cardW;
      const start = Math.min(Math.max((L.w - width) / 2, L.handLeft), right - width);
      return { x: start + spot.index * step + L.cardW / 2, y: L.handY, rot: 0, scale: 1 };
    }
    case 'opp': {
      const step = L.cardW * OPP_SCALE * 0.75;
      const x0 = L.w / 2 - ((spot.count - 1) * step) / 2;
      const tilt = (spot.index - (spot.count - 1) / 2) * 6;
      return { x: x0 + spot.index * step, y: L.oppY, rot: tilt, scale: OPP_SCALE };
    }
    case 'table':
      return tablePlace(L, spot.index, spot.count);
    case 'stack': {
      const p = tablePlace(L, spot.index, spot.count);
      return { ...p, x: p.x + spot.offset * 4, y: p.y + spot.offset * 5, rot: spot.offset * 2 };
    }
    case 'pile': {
      const mine = spot.owner === you;
      return spot.scopa !== undefined ? scopaPlace(L, mine, spot.scopa) : pilePlace(L, mine);
    }
    case 'deck':
      return { x: L.deckX, y: L.oppY, rot: 0, scale: DECK_SCALE };
  }
}

type Props = {
  scene: Scene;
  onPressCard?: (card: Card) => void;
  highlighted?: readonly Card[];
  names: [string, string];
};

export function Board({ scene, onPressCard, highlighted, names }: Props) {
  const [layout, setLayout] = useState<Layout | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!layout || layout.w !== width || layout.h !== height) setLayout(computeLayout(width, height));
  };
  const me = scene.you;
  const opp = other(me);

  return (
    <View style={styles.board} onLayout={onLayout}>
      {layout && (
        <>
          <View
            style={[
              styles.tableFelt,
              { left: layout.table.x, top: layout.table.y, width: layout.table.w, height: layout.table.h },
            ]}
          />
          <Deck layout={layout} count={scene.deckCount} />
          <Pile layout={layout} pile={scene.piles[opp]} mine={false} name={names[opp]} />
          <Pile layout={layout} pile={scene.piles[me]} mine name={names[me]} />
          {scene.sprites.map((sprite) => (
            <SpriteView
              key={sprite.id}
              sprite={sprite}
              layout={layout}
              you={me}
              highlighted={sprite.card !== null && !!highlighted?.includes(sprite.card)}
              onPress={sprite.card && onPressCard ? () => onPressCard(sprite.card!) : undefined}
            />
          ))}
          {scene.banner && (
            <Animated.View
              key={scene.banner.key}
              entering={ZoomIn.springify().damping(12)}
              exiting={FadeOut.duration(250)}
              pointerEvents="none"
              style={[styles.bannerWrap, { top: layout.table.y, height: layout.table.h, width: layout.w }]}>
              <Text style={styles.banner}>{scene.banner.text}</Text>
            </Animated.View>
          )}
        </>
      )}
    </View>
  );
}

function SpriteView({
  sprite,
  layout,
  you,
  highlighted,
  onPress,
}: {
  sprite: Sprite;
  layout: Layout;
  you: PlayerIndex;
  highlighted: boolean;
  onPress?: () => void;
}) {
  const target = spotPlace(layout, sprite.spot, you);
  const [initial] = useState(() => ({
    place: sprite.from ? spotPlace(layout, sprite.from, you) : target,
    face: (sprite.from ? sprite.fromFaceUp ?? sprite.faceUp : sprite.faceUp) ? 1 : 0,
  }));

  const x = useSharedValue(initial.place.x);
  const y = useSharedValue(initial.place.y);
  const rot = useSharedValue(initial.place.rot);
  const scale = useSharedValue(initial.place.scale);
  const face = useSharedValue(initial.face);

  const duration = sprite.duration ?? 320;
  const delay = sprite.delay ?? 0;
  const faceTarget = sprite.faceUp ? 1 : 0;

  useEffect(() => {
    const cfg = { duration, easing: EASING };
    x.set(withDelay(delay, withTiming(target.x, cfg)));
    y.set(withDelay(delay, withTiming(target.y, cfg)));
    rot.set(withDelay(delay, withTiming(target.rot, cfg)));
    scale.set(withDelay(delay, withTiming(target.scale, cfg)));
    face.set(withDelay(delay, withTiming(faceTarget, cfg)));
  }, [target.x, target.y, target.rot, target.scale, faceTarget, duration, delay, x, y, rot, scale, face]);

  const { width, height } = cardBox(layout.cardW);

  const moveStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() - width / 2 },
      { translateY: y.get() - height / 2 },
      { rotate: `${rot.get()}deg` },
      { scale: scale.get() },
      // Giro della carta: si "assottiglia" a metà e cambia faccia.
      { scaleX: Math.max(0.001, Math.abs(interpolate(face.get(), [0, 0.5, 1], [1, 0, 1]))) },
    ],
  }));
  const frontStyle = useAnimatedStyle(() => ({ opacity: face.get() >= 0.5 ? 1 : 0 }));
  const backStyle = useAnimatedStyle(() => ({ opacity: face.get() >= 0.5 ? 0 : 1 }));

  return (
    <Animated.View style={[styles.sprite, { width, height, zIndex: sprite.z }, moveStyle]}>
      <Pressable onPress={onPress} disabled={!onPress} style={StyleSheet.absoluteFill}>
        {sprite.card && (
          <Animated.View style={[StyleSheet.absoluteFill, frontStyle]}>
            <CardFace card={sprite.card} width={layout.cardW} highlighted={highlighted} />
          </Animated.View>
        )}
        <Animated.View style={[StyleSheet.absoluteFill, backStyle]} pointerEvents="none">
          <CardBack width={layout.cardW} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function Deck({ layout, count }: { layout: Layout; count: number }) {
  if (count === 0) return null;
  const w = layout.cardW * DECK_SCALE;
  const h = w * CARD_ASPECT;
  const layers = Math.min(4, Math.ceil(count / 8));
  return (
    <View style={[styles.static, { left: layout.deckX - w / 2, top: layout.oppY - h / 2 }]} pointerEvents="none">
      {Array.from({ length: layers }, (_, i) => (
        <View key={i} style={{ position: 'absolute', left: -i * 1.5, top: -i * 1.5 }}>
          <CardBack width={w} />
        </View>
      ))}
      <Text style={[styles.countLabel, { top: h + 4, width: w }]}>{count}</Text>
    </View>
  );
}

function Pile({ layout, pile, mine, name }: { layout: Layout; pile: PileInfo; mine: boolean; name: string }) {
  const p = pilePlace(layout, mine);
  const w = layout.cardW * PILE_SCALE;
  const h = w * CARD_ASPECT;
  const layers = pile.count === 0 ? 0 : Math.min(5, Math.ceil(pile.count / 6));
  return (
    <View style={[styles.static, { left: p.x - w / 2, top: p.y - h / 2, width: w, height: h }]} pointerEvents="none">
      {pile.scope.map((card, k) => {
        const s = scopaPlace(layout, mine, k);
        return (
          <View
            key={card}
            style={{ position: 'absolute', left: 0, top: s.y - p.y, transform: [{ rotate: '90deg' }] }}>
            <CardFace card={card} width={w} />
          </View>
        );
      })}
      {Array.from({ length: layers }, (_, i) => (
        <View key={i} style={{ position: 'absolute', left: -i * 1.5, top: -i * 1.5 }}>
          <CardBack width={w} />
        </View>
      ))}
      {pile.count === 0 && <View style={[styles.emptyPile, cardBox(w)]} />}
      <View style={[styles.pileLabel, mine ? { bottom: h + 6 } : { top: h + 6 }]}>
        <Text style={styles.pileName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.pileCount}>
          {pile.count}
          {pile.scope.length > 0 ? `  ★${pile.scope.length}` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1 },
  tableFelt: {
    position: 'absolute',
    borderRadius: 22,
    backgroundColor: Table.feltDark,
    borderWidth: 1,
    borderColor: '#FFFFFF14',
  },
  sprite: { position: 'absolute', left: 0, top: 0 },
  static: { position: 'absolute' },
  countLabel: { position: 'absolute', textAlign: 'center', color: Table.feltTextMuted, fontSize: 12, fontWeight: 700 },
  emptyPile: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#FFFFFF40', backgroundColor: 'transparent' },
  pileLabel: { position: 'absolute', left: -8, width: 90, gap: 1 },
  pileName: { color: Table.feltText, fontSize: 12, fontWeight: 700 },
  pileCount: { color: Table.accent, fontSize: 12, fontWeight: 800 },
  bannerWrap: { position: 'absolute', left: 0, alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  banner: {
    color: Table.accent,
    fontSize: 56,
    fontWeight: 900,
    letterSpacing: 2,
    textShadowColor: '#000000C0',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 2 },
  },
});
