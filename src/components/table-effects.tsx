// Effetti sul tavolo per le prese speciali: la scopa che spazza e le scintille sul settebello.

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SWEEP_MS = 900;
const DUST = 7;

/** Una scopa che attraversa il tavolo dondolando e lascia dietro di sé sbuffi di polvere. */
export function SweepingBroom({ area }: { area: Area }) {
  const progress = useSharedValue(0);
  const swing = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }));
    swing.set(withRepeat(withSequence(withTiming(15, { duration: 150 }), withTiming(-15, { duration: 150 })), 3, true));
  }, [progress, swing]);

  // Passa appena sotto la scritta "SCOPA!", all'altezza delle carte.
  const startX = area.x - 100;
  const endX = area.x + area.w;
  const y = area.y + area.h / 2 + 20;
  const broomStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.08, 0.9, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: startX + progress.get() * (endX - startX) },
      { translateY: y },
      { rotate: `${swing.get() - 25}deg` },
    ],
  }));

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} pointerEvents="none">
      {Array.from({ length: DUST }, (_, i) => (
        <DustPuff key={i} x={startX + ((i + 0.6) / DUST) * (endX - startX) + 10} y={y + 70} delay={(i / DUST) * SWEEP_MS} />
      ))}
      <Animated.View style={[styles.anchor, broomStyle]}>
        <Text style={styles.broom}>🧹</Text>
      </Animated.View>
    </View>
  );
}

function DustPuff({ x, y, delay }: { x: number; y: number; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) })));
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.get(), [0, 0.2, 1], [0, 0.8, 0]),
    transform: [{ translateX: x }, { translateY: y - t.get() * 34 }, { scale: 0.6 + t.get() * 0.8 }],
  }));
  return (
    <Animated.View style={[styles.anchor, style]}>
      <Text style={styles.dust}>💨</Text>
    </Animated.View>
  );
}

const STARS = 12;

/** Stelline dorate che partono dal 7 di denari, in due ondate, con una luce che pulsa sotto. */
export function Sparkles({ x, y, size }: { x: number; y: number; size: number }) {
  // Posizione fissata alla comparsa: le scintille restano lì anche quando la presa va nel mazzetto.
  const [at] = useState({ x, y });
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.set(withRepeat(withSequence(withTiming(1, { duration: 280 }), withTiming(0.3, { duration: 280 })), 2, false));
  }, [glow]);
  const glowSize = size * 1.7;
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.get() * 0.85,
    transform: [{ translateX: at.x - glowSize / 2 }, { translateY: at.y - glowSize / 2 }, { scale: 0.8 + glow.get() * 0.3 }],
  }));

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} pointerEvents="none">
      <Animated.View style={[styles.anchor, styles.glow, { width: glowSize, height: glowSize, borderRadius: glowSize / 2 }, glowStyle]} />
      {Array.from({ length: STARS * 2 }, (_, i) => (
        <Star key={i} cx={at.x} cy={at.y} angle={(i % STARS) * (360 / STARS) + (i >= STARS ? 15 : 0)} distance={size * (i >= STARS ? 1.3 : 0.95)} delay={i >= STARS ? 420 : 0} big={i % 3 === 0} />
      ))}
    </View>
  );
}

function Star({ cx, cy, angle, distance, delay, big }: { cx: number; cy: number; angle: number; distance: number; delay: number; big: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) })));
  }, [t, delay]);
  const rad = (angle * Math.PI) / 180;
  const style = useAnimatedStyle(() => {
    const v = t.get();
    return {
      opacity: interpolate(v, [0, 0.15, 0.7, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: cx - 8 + Math.cos(rad) * distance * v },
        { translateY: cy - 10 + Math.sin(rad) * distance * v },
        { rotate: `${v * 180}deg` },
        { scale: 0.4 + v * (big ? 1.1 : 0.7) },
      ],
    };
  });
  return (
    <Animated.View style={[styles.anchor, style]}>
      <Text style={[styles.star, big && styles.starBig]}>{big ? '✨' : '✦'}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { zIndex: 900 },
  anchor: { position: 'absolute', left: 0, top: 0 },
  broom: { fontSize: 96 },
  dust: { fontSize: 28, opacity: 0.9 },
  glow: { backgroundColor: 'rgba(255, 213, 74, 0.45)', boxShadow: '0 0 24px rgba(255, 213, 74, 0.9)' },
  star: { color: '#FFD54A', fontSize: 20, fontWeight: 900, textShadowColor: '#7A4A00', textShadowRadius: 4 },
  starBig: { fontSize: 28 },
});
