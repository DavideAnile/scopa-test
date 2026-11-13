import { useEffect, useState } from 'react';

/** Senza nuovi segnali entro questo tempo, "sta scrivendo" sparisce (es. l'altro ha chiuso l'app). */
const TYPING_TIMEOUT_MS = 6000;

/** true se l'avversario sta scrivendo adesso (ultimo segnale recente). */
export function useOpponentTyping(typingAt: number | null): boolean {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (typingAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [typingAt]);

  return typingAt !== null && Math.max(now, typingAt) - typingAt < TYPING_TIMEOUT_MS;
}
