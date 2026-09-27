import { useState } from 'react';
import { KeyRound, LogOut } from 'lucide-react';
import { useAuth } from '../store/AuthStore';

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-bosque-950 via-bosque-900 to-[#144733] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-oro/30 space-y-5 text-xs">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Aurevia Logo" className="w-12 h-12 rounded-2xl object-cover border border-oro/40 bg-white p-0.5" />
          <div>
            <h1 className="font-serif text-xl font-bold text-tinta">AUREVIA</h1>
            <p className="text-[10px] text-earth-500 font-semibold tracking-[0.2em] uppercase">Vivero • Jardines • ERP</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Login() {
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(await entrar(email, password));
    setEnviando(false);
  };

  return (
    <Marco>
      <div>
        <h2 className="font-serif text-lg font-bold text-tinta">Iniciar sesión</h2>
        <p className="text-[11px] text-tinta-suave">Usa la cuenta que te creó el dueño del vivero.</p>
      </div>
      <form onSubmit={enviar} className="space-y-3">
        <div>
          <label htmlFor="login-email" className="font-bold block mb-1 text-tinta">Correo</label>
          <input id="login-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2.5 bg-crema border border-crema-300 rounded-xl font-semibold" />
        </div>
        <div>
          <label htmlFor="login-password" className="font-bold block mb-1 text-tinta">Contraseña</label>
          <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2.5 bg-crema border border-crema-300 rounded-xl font-semibold" />
        </div>
        {error && <p role="alert" className="p-2.5 rounded-xl bg-error-fondo text-error font-semibold">{error}</p>}
        <button type="submit" disabled={enviando} className="w-full py-3 rounded-2xl bg-bosque-950 text-oro font-bold flex items-center justify-center gap-2 disabled:opacity-60">
          <KeyRound className="w-4 h-4" /> {enviando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </Marco>
  );
}

export function SinRol() {
  const { perfil, salir } = useAuth();
  return (
    <Marco>
      <div className="space-y-2">
        <h2 className="font-serif text-lg font-bold text-tinta">Cuenta sin acceso todavía</h2>
        <p className="text-tinta-suave">
          Entraste como <strong className="text-tinta">{perfil?.email}</strong>, pero el dueño aún no te asignó un rol
          (dueño, vendedor o jardinero). Pídele que lo haga en <em>Ajustes → Usuarios</em>.
        </p>
      </div>
      <button onClick={() => void salir()} className="w-full py-3 rounded-2xl border border-crema-400 bg-crema-200 text-tinta font-bold flex items-center justify-center gap-2">
        <LogOut className="w-4 h-4" /> Cerrar sesión
      </button>
    </Marco>
  );
}
