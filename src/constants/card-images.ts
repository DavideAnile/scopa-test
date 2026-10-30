// Metro richiede require() letterali, quindi una voce per carta. Immagini: assets/cards (pubblico dominio, vedi CREDITS.txt).
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

import type { Card } from '@scopa';

// require() di un'immagine restituisce un id numerico dell'asset.
type ImageAsset = number;

export const CARD_IMAGES: Record<Card, ImageAsset> = {
  '1D': require('@/assets/cards/1D.jpg'),
  '2D': require('@/assets/cards/2D.jpg'),
  '3D': require('@/assets/cards/3D.jpg'),
  '4D': require('@/assets/cards/4D.jpg'),
  '5D': require('@/assets/cards/5D.jpg'),
  '6D': require('@/assets/cards/6D.jpg'),
  '7D': require('@/assets/cards/7D.jpg'),
  '8D': require('@/assets/cards/8D.jpg'),
  '9D': require('@/assets/cards/9D.jpg'),
  '10D': require('@/assets/cards/10D.jpg'),
  '1C': require('@/assets/cards/1C.jpg'),
  '2C': require('@/assets/cards/2C.jpg'),
  '3C': require('@/assets/cards/3C.jpg'),
  '4C': require('@/assets/cards/4C.jpg'),
  '5C': require('@/assets/cards/5C.jpg'),
  '6C': require('@/assets/cards/6C.jpg'),
  '7C': require('@/assets/cards/7C.jpg'),
  '8C': require('@/assets/cards/8C.jpg'),
  '9C': require('@/assets/cards/9C.jpg'),
  '10C': require('@/assets/cards/10C.jpg'),
  '1S': require('@/assets/cards/1S.jpg'),
  '2S': require('@/assets/cards/2S.jpg'),
  '3S': require('@/assets/cards/3S.jpg'),
  '4S': require('@/assets/cards/4S.jpg'),
  '5S': require('@/assets/cards/5S.jpg'),
  '6S': require('@/assets/cards/6S.jpg'),
  '7S': require('@/assets/cards/7S.jpg'),
  '8S': require('@/assets/cards/8S.jpg'),
  '9S': require('@/assets/cards/9S.jpg'),
  '10S': require('@/assets/cards/10S.jpg'),
  '1B': require('@/assets/cards/1B.jpg'),
  '2B': require('@/assets/cards/2B.jpg'),
  '3B': require('@/assets/cards/3B.jpg'),
  '4B': require('@/assets/cards/4B.jpg'),
  '5B': require('@/assets/cards/5B.jpg'),
  '6B': require('@/assets/cards/6B.jpg'),
  '7B': require('@/assets/cards/7B.jpg'),
  '8B': require('@/assets/cards/8B.jpg'),
  '9B': require('@/assets/cards/9B.jpg'),
  '10B': require('@/assets/cards/10B.jpg'),
};

/** Rapporto altezza/larghezza delle immagini delle carte. */
export const CARD_ASPECT = 496 / 300;

// Tenute in memoria finché il browser non le ha scaricate.
const preloaded: HTMLImageElement[] = [];

/**
 * Scarica subito tutte le 40 carte. Sul web (e su Expo Go via tunnel) le immagini arrivano dal Mac:
 * senza precaricarle, una carta che compare per la prima volta resta bianca finché non arriva.
 */
export function preloadCardImages() {
  const modules = Object.values(CARD_IMAGES);
  if (Platform.OS === 'web') {
    if (preloaded.length > 0) return;
    for (const m of modules) {
      const img = new window.Image();
      img.src = Asset.fromModule(m).uri;
      preloaded.push(img);
    }
    return;
  }
  Asset.loadAsync(modules).catch(() => {
    // Non è grave: le carte si caricheranno quando servono.
  });
}
