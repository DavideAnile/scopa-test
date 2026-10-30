import { Pressable, type StyleProp, StyleSheet, Text, type ViewStyle } from 'react-native';

import { Table } from '@/constants/theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline';
  disabled?: boolean;
  /** Es. `{ flex: 1 }` quando sta in riga con altri pulsanti. */
  style?: StyleProp<ViewStyle>;
};

export function MenuButton({ label, onPress, variant = 'primary', disabled, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'outline' && styles.outline,
        (pressed || disabled) && styles.dim,
        style,
      ]}>
      <Text style={[styles.text, variant === 'outline' && styles.textOutline]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Table.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Table.feltText,
  },
  dim: { opacity: 0.6 },
  text: { color: '#2B2100', fontSize: 16, fontWeight: 800 },
  textOutline: { color: Table.feltText },
});
