// ==========================================
// COMPONENTES Y HOOKS COMPARTIDOS ENTRE MÓDULOS
// ==========================================
import { useState, type ReactNode } from 'react';
import { validarDni, validarRuc } from '../lib/peru';
import { sunatClient } from '../lib/sunatClient';
import { useErp } from '../store/ErpStore';
import { useUi } from '../store/UiStore';

export function ModalShell({ children, size = 'max-w-lg', padding = 'p-8', overlay = 'bg-[#082017]/75', className = 'space-y-4' }: {
  children: ReactNode;
  size?: string;
  padding?: string;
  overlay?: string;
  className?: string;
}) {
  return (
    <div className={`fixed inset-0 ${overlay} backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn`}>
      <div className={`bg-white rounded-3xl ${padding} ${size} w-full shadow-2xl ${className} border border-[#e8e2d8] text-xs`}>
        {children}
      </div>
    </div>
  );
}

/** Consulta de RUC / DNI: validación módulo 11 offline + búsqueda en línea best-effort. */
export function useDocLookup() {
  const [busy, setBusy] = useState(false);

  const consultar = async (doc: string, onNombre: (nombre: string) => void) => {
    const value = (doc || '').trim();
    const sinToken = sunatClient.tieneApiToken ? '' : ' (la consulta en línea requiere el servicio de consulta del servidor)';

    if (value.length === 11) {
      if (!validarRuc(value)) {
        alert(`⚠️ El RUC ${value} no supera la validación de dígito verificador (módulo 11).`);
        return;
      }
      setBusy(true);
      try {
        const r = await sunatClient.consultarRuc(value);
        if (r.ok && r.razonSocial) {
          onNombre(r.razonSocial);
          alert(`✅ RUC ${value} — Padrón SUNAT en línea:\n${r.razonSocial}` +
            `${r.estado ? `\nEstado: ${r.estado}` : ''}${r.condicion ? ` · ${r.condicion}` : ''}`);
        } else {
          alert(`✔️ RUC ${value} válido (módulo 11).\nConsulta en línea no disponible${sinToken}. Ingresa la razón social manualmente.`);
        }
      } finally {
        setBusy(false);
      }
    } else if (value.length === 8) {
      if (!validarDni(value)) {
        alert('⚠️ El DNI debe tener 8 dígitos numéricos.');
        return;
      }
      setBusy(true);
      try {
        const r = await sunatClient.consultarDni(value);
        if (r.ok && r.nombreCompleto) {
          onNombre(r.nombreCompleto);
          alert(`✅ DNI ${value} — RENIEC en línea:\n${r.nombreCompleto}`);
        } else {
          alert(`✔️ DNI ${value} con formato válido.\nConsulta RENIEC no disponible${sinToken}.`);
        }
      } finally {
        setBusy(false);
      }
    } else {
      alert('⚠️ Ingresa un RUC de 11 dígitos o un DNI de 8 dígitos.');
    }
  };

  return { busy, consultar };
}

/** Escaneo de etiqueta QR / código de barras: abre el POS con el producto encontrado. */
export function useScanner() {
  const { state } = useErp();
  const { open } = useUi();
  return (skuOrCode: string): boolean => {
    const cleanCode = skuOrCode.trim().toUpperCase();
    if (!cleanCode) return false;
    const found = state.products.find(p => p.sku.toUpperCase() === cleanCode || p.name.toUpperCase().includes(cleanCode));
    if (found) {
      open({ type: 'pos', sku: found.sku });
      return true;
    }
    alert(`⚠️ No se encontró ninguna especie o producto con el código "${skuOrCode}". Verifique el SKU.`);
    return false;
  };
}

export function MinusCircleIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="10" strokeWidth="2"/>
      <line x1="8" y1="12" x2="16" y2="12" strokeWidth="2"/>
    </svg>
  );
}

export function SmartphoneIcon() {
  return (
    <svg className="w-4 h-4 text-[#e05780]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="5" y="2" width="14" height="20" rx="2" strokeWidth="2"/>
      <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2"/>
    </svg>
  );
}

export function CreditCardIcon() {
  return (
    <svg className="w-4 h-4 text-[#134e2e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="2"/>
      <line x1="2" y1="10" x2="22" y2="10" strokeWidth="2"/>
    </svg>
  );
}
