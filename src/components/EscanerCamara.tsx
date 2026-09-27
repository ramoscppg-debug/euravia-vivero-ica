import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

// API del navegador (Chrome/Edge en Android y escritorio); aún no está en los tipos de TypeScript
interface Deteccion { rawValue: string }
interface DetectorCodigos { detect(fuente: HTMLVideoElement): Promise<Deteccion[]> }
declare global {
  interface Window { BarcodeDetector?: new (opciones?: { formats: string[] }) => DetectorCodigos }
}

export const camaraDisponible = () => typeof window !== 'undefined' && !!window.BarcodeDetector && !!navigator.mediaDevices?.getUserMedia;

/** Lee códigos QR o de barras con la cámara (celular o webcam) sin librerías extra. */
export function EscanerCamara({ alLeer, cerrar }: { alLeer: (texto: string) => void; cerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const alLeerRef = useRef(alLeer);
  alLeerRef.current = alLeer;

  useEffect(() => {
    let flujo: MediaStream | null = null;
    let activo = true;
    let ultimo = '';
    let ultimoAt = 0;
    (async () => {
      try {
        if (!window.BarcodeDetector) throw new Error('Este navegador no puede leer códigos con la cámara. Usa Chrome o un lector USB.');
        const detector = new window.BarcodeDetector({ formats: ['qr_code', 'ean_13', 'code_128', 'ean_8', 'upc_a'] });
        flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!video.current) return;
        video.current.srcObject = flujo;
        await video.current.play();
        const ciclo = async () => {
          if (!activo || !video.current) return;
          try {
            const [cod] = await detector.detect(video.current);
            // Evita sumar el mismo código dos veces seguidas por error (1,5 s de pausa)
            if (cod && (cod.rawValue !== ultimo || Date.now() - ultimoAt > 1500)) {
              ultimo = cod.rawValue;
              ultimoAt = Date.now();
              navigator.vibrate?.(60);
              alLeerRef.current(cod.rawValue);
            }
          } catch { /* cuadro sin código */ }
          setTimeout(() => void ciclo(), 250);
        };
        void ciclo();
      } catch (e) {
        setError(e instanceof Error && e.name === 'NotAllowedError' ? 'Permite el uso de la cámara para escanear.' : e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      activo = false;
      flujo?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black">
      <video ref={video} muted playsInline className="w-full max-h-64 object-cover" />
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center"><div className="w-40 h-40 border-4 border-white/80 rounded-2xl" /></div>
      <p className="absolute bottom-2 inset-x-2 text-center text-white text-xs font-bold drop-shadow flex items-center justify-center gap-1"><Camera className="w-4 h-4" aria-hidden /> Apunta al QR de la etiqueta</p>
      <button onClick={cerrar} className="absolute top-2 right-2 p-2 rounded-full bg-black/60 text-white" aria-label="Cerrar cámara"><X className="w-4 h-4" /></button>
      {error && <p role="alert" className="absolute inset-0 flex items-center justify-center p-4 text-center bg-black/80 text-white text-sm font-semibold">{error}</p>}
    </div>
  );
}
