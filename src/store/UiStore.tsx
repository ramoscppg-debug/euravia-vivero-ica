// ==========================================
// ESTADO DE INTERFAZ: pestaña activa (sincronizada con la URL #hash) y modal abierto
// ==========================================
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ALL_TABS, type TabId } from '../layout/navigation';
import type { ComprobanteSunat } from '../domain/types';

export type Modal =
  | { type: 'pos'; sku?: string }
  | { type: 'compra' }
  | { type: 'baja' }
  | { type: 'egreso' }
  | { type: 'qr'; sku: string }
  | { type: 'gre' }
  | { type: 'ticket'; invoice: ComprobanteSunat };

interface UiValue {
  tab: TabId;
  setTab: (tab: TabId) => void;
  modal: Modal | null;
  open: (modal: Modal) => void;
  close: () => void;
}

const UiContext = createContext<UiValue | null>(null);

function tabFromHash(): TabId {
  const h = window.location.hash.replace('#', '') as TabId;
  return ALL_TABS.includes(h) ? h : 'dashboard';
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<TabId>(tabFromHash);
  const [modal, setModal] = useState<Modal | null>(null);

  const setTab = useCallback((next: TabId) => {
    setTabState(next);
    if (window.location.hash !== `#${next}`) window.history.replaceState(null, '', `#${next}`);
  }, []);

  useEffect(() => {
    const onHash = () => setTabState(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const close = useCallback(() => setModal(null), []);
  const value = useMemo(() => ({ tab, setTab, modal, open: setModal, close }), [tab, setTab, modal, close]);
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi debe usarse dentro de <UiProvider>');
  return ctx;
}
