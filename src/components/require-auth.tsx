import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Table } from '@/constants/theme';
import { useOnline } from '@/online/client';

/** Mostra la schermata solo dopo il login con password; altrimenti porta al login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { auth } = useOnline();
  if (auth === 'loading') return <View style={{ flex: 1, backgroundColor: Table.felt }} />;
  if (auth === 'out') return <Redirect href="/login" />;
  return children;
}
