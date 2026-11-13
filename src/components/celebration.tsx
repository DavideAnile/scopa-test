import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** coriandoli; cuori; oppure entrambi (quando vince Davide). */
export type CelebrationKind = 'confetti' | 'hearts' | 'both';

const COUNT = 40;
const CONFETTI_COLORS = ['#F5C542', '#E5484D', '#4FC3F7', '#46C46E', '#F7C6D9', '#FFFFFF'];
const HEARTS = ['💖', '❤️', '💕', '💗'];

interface Particle {
  x: number;
  delay: number;
  duration: number;
  sway: number;
  spin: number;
  size: number;
  heart: boolean;
  glyph: string;
  color: string;
}

function makeParticles(kind: CelebrationKind, width: number): Particle[] {
  return Array.from({ length: COUNT }, (_, i) => {
    const heart = kind === 'hearts' || (kind === 'both' && i % 2 === 0);
    return {
      x: Math.random() * width,
      delay: Math.random() * 1800,
      duration: 2600 + Math.random() * 1800,
      sway: 20 + Math.random() * 40,
      spin: (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 360),
      size: heart ? 18 + Math.random() * 14 : 7 + Math.random() * 6,
      heart,
      glyph: HEARTS[i % HEARTS.length],
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    };
  });
}

/** Pioggia di coriandoli e/o cuori sopra tutto lo schermo; non blocca i tocchi. */
export function Celebration({ kind }: { kind: CelebrationKind }) {
  const { width, height } = useWindowDimensions();
  const [particles] = useState(() => makeParticles(kind, width));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <Falling key={i} particle={p} height={height} />
      ))}
    </View>
  );
}

function Falling({ particle: p, height }: { particle: Particle; height: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(p.delay, withRepeat(withTiming(1, { duration: p.duration, easing: Easing.linear }), -1, false)));
  }, [t, p.delay, p.duration]);

  const style = useAnimatedStyle(() => {
    const v = t.get();
    return {
      opacity: v === 0 ? 0 : 1,
      transform: [
        { translateX: p.x + Math.sin(v * Math.PI * 4) * p.sway },
        { translateY: -40 + v * (height + 80) },
        { rotate: `${v * p.spin}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.particle, style]}>
      {p.heart ? (
        <Text style={{ fontSize: p.size }}>{p.glyph}</Text>
      ) : (
        <View style={{ width: p.size, height: p.size * 1.6, backgroundColor: p.color, borderRadius: 2 }} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  particle: { position: 'absolute', left: 0, top: 0 },
});
