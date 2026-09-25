import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import type { Rol } from '../../domain/types';
import { ROL_ETIQUETA } from '../../layout/navigation';
import { asignarRol, listarPerfiles, type PerfilUsuario } from '../../lib/repo';
import { useAuth } from '../../store/AuthStore';

/** El dueño asigna el rol de cada cuenta. Las cuentas se crean en Supabase → Authentication. */
export default function Usuarios() {
  const { perfil } = useAuth();
  const [usuarios, setUsuarios] = useState<PerfilUsuario[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = () => listarPerfiles().then(setUsuarios, e => setError(String(e instanceof Error ? e.message : e)));
  useEffect(() => { void cargar(); }, []);

  const cambiar = async (id: string, valor: string) => {
    try {
      await asignarRol(id, valor ? (valor as Rol) : null);
      await cargar();
    } catch (e) {
      alert(`No se pudo cambiar el rol: ${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#e8e2d8] p-6 shadow-sm space-y-4 text-xs">
      <div className="flex items-center gap-2 pb-2 border-b border-[#f0eae1]">
        <Users className="w-5 h-5 text-[#134e2e]" />
        <h4 className="font-serif font-bold text-base text-[#082017]">4. Usuarios y Roles</h4>
      </div>
      <p className="text-[#5c7367]">
        Crea las cuentas del personal en Supabase → <strong>Authentication → Users → Add user</strong>. Aparecen aquí sin rol
        (sin acceso) hasta que les asignes uno.
      </p>
      {error && <p className="p-2.5 rounded-xl bg-[#fee2e2] text-[#b91c1c] font-semibold">{error}</p>}
      <div className="space-y-2">
        {usuarios.map(u => (
          <div key={u.id} className="p-3 bg-[#faf8f5] rounded-xl border border-[#eae4dc] flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-[#082017]">{u.nombre || u.email}</p>
              <p className="text-[10px] text-[#8fa89b]">{u.email}</p>
            </div>
            <select
              value={u.rol ?? ''}
              disabled={u.id === perfil?.id} // nadie se quita a sí mismo el rol de dueño
              onChange={e => void cambiar(u.id, e.target.value)}
              className="p-2 bg-white border border-[#e8e2d8] rounded-xl font-bold disabled:opacity-60"
            >
              <option value="">⛔ Sin acceso</option>
              {(Object.keys(ROL_ETIQUETA) as Rol[]).map(r => <option key={r} value={r}>{ROL_ETIQUETA[r]}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
