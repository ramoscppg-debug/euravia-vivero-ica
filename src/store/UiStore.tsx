// ==========================================
// ESTADO DE INTERFAZ: pestaña activa (sincronizada con la URL #hash) y modal abierto
// ==========================================
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ALL_TABS, puedeVer, tabInicial, type TabId } from '../layout/navigation';
import type { ComprobanteSunat, Pedido, Rol } from '../domain/types';

export type Modal =
  | { type: 'pos'; sku?: string }
  | { type: 'compra' }
  | { type: 'baja' }
  | { type: 'egreso' }
  | { type: 'qr'; sku: string }
  | { type: 'gre' }
  | { type: 'proyecto' }
  | { type: 'ticket'; invoice: ComprobanteSunat; vuelto?: number }
  | { type: 'devolucion'; invoice: ComprobanteSunat }
  | { type: 'pedido-nuevo' }
  | { type: 'pedido-cobro'; pedido: Pedido }
  | { type: 'pedido-entrega'; pedido: Pedido };

interface UiValue {
  tab: TabId;
  setTab: (tab: TabId) => void;
  modal: Modal | null;
  open: (modal: Modal) => void;
  close: () => void;
}

const UiContext = createContext<UiValue | null>(null);

function tabFromHash(rol: Rol): TabId {
  const h = window.location.hash.replace('#', '') as TabId;
  return ALL_TABS.includes(h) && puedeVer(rol, h) ? h : tabInicial(rol);
}

export function UiProvider({ children, rol }: { children: ReactNode; rol: Rol }) {
  const [tab, setTabState] = useState<TabId>(() => tabFromHash(rol));
  const [modal, setModal] = useState<Modal | null>(null);

  const setTab = useCallback((next: TabId) => {
    const permitida = puedeVer(rol, next) ? next : tabInicial(rol);
    setTabState(permitida);
    if (window.location.hash !== `#${permitida}`) window.history.replaceState(null, '', `#${permitida}`);
  }, [rol]);

  useEffect(() => {
    const onHash = () => setTabState(tabFromHash(rol));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [rol]);

  const close = useCallback(() => setModal(null), []);
  const value = useMemo(() => ({ tab, setTab, modal, open: setModal, close }), [tab, setTab, modal, close]);
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi debe usarse dentro de <UiProvider>');
  return ctx;
}
