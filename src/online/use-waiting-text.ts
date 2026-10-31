import { useEffect, useState } from 'react';

/** Dopo quanti secondi di attesa si spiega che il server si sta svegliando. */
const SHOW_AFTER_S = 4;

/**
 * Testo da mostrare mentre si aspetta il server (su Render gratuito può dormire e metterci ~1 minuto),
 * con i secondi che passano. null se l'attesa è breve o se si è collegati.
 */
export function useWaitingText(waitingSince: number | null): string | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (waitingSince === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waitingSince]);

  if (waitingSince === null) return null;
  const seconds = Math.max(0, Math.round((now - waitingSince) / 1000));
  if (seconds < SHOW_AFTER_S) return null;
  return `Sto svegliando il server, ci vuole circa un minuto… (${seconds} s)`;
}
