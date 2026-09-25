// ==========================================
// SESIÓN Y ROL DEL USUARIO
// Modo demo (sin Supabase en el .env): sin login, actúa como dueño.
// Modo nube: login con Supabase Auth; el rol sale de la tabla `perfiles`.
// ==========================================
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Rol } from '../domain/types';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

export type { Rol };

export interface Perfil {
  id: string;
  nombre: string;
  email: string;
  rol: Rol | null; // null = cuenta creada pero sin acceso asignado
}

interface AuthValue {
  modo: 'demo' | 'nube';
  cargando: boolean;
  session: Session | null;
  perfil: Perfil | null;
  entrar: (email: string, password: string) => Promise<string | null>;
  salir: () => Promise<void>;
}

const PERFIL_DEMO: Perfil = { id: 'demo', nombre: 'Modo demo', email: '', rol: 'dueno' };

const AuthContext = createContext<AuthValue | null>(null);

async function cargarPerfil(userId: string): Promise<Perfil | null> {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from('perfiles').select('id, nombre, email, rol').eq('id', userId).maybeSingle();
  if (error || !data) return null;
  return { id: data.id, nombre: data.nombre ?? data.email ?? '', email: data.email ?? '', rol: data.rol };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const modo = isSupabaseConfigured ? 'nube' : 'demo';
  const [cargando, setCargando] = useState(modo === 'nube');
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(modo === 'demo' ? PERFIL_DEMO : null);

  useEffect(() => {
    if (modo === 'demo') return;
    let activo = true;
    let cancelar: (() => void) | undefined;

    const aplicarSesion = async (s: Session | null) => {
      const p = s ? await cargarPerfil(s.user.id) : null;
      if (!activo) return;
      setSession(s);
      setPerfil(p);
      setCargando(false);
    };

    void getSupabase().then(sb => {
      if (!sb || !activo) return;
      void sb.auth.getSession().then(({ data }) => aplicarSesion(data.session));
      const { data } = sb.auth.onAuthStateChange((evento, s) => {
        if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT' || evento === 'USER_UPDATED') {
          // Fuera del callback: supabase-js no admite otras llamadas dentro de onAuthStateChange
          setTimeout(() => void aplicarSesion(s), 0);
        }
      });
      cancelar = () => data.subscription.unsubscribe();
    });

    return () => {
      activo = false;
      cancelar?.();
    };
  }, [modo]);

  const entrar = useCallback(async (email: string, password: string) => {
    const sb = await getSupabase();
    if (!sb) return 'Supabase no está configurado.';
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (!error) return null;
    return error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : error.message;
  }, []);

  const salir = useCallback(async () => {
    const sb = await getSupabase();
    await sb?.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ modo, cargando, session, perfil, entrar, salir }),
    [modo, cargando, session, perfil, entrar, salir]
  ) as AuthValue;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
