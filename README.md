# 🌱 VIVERO 360° | Plataforma Integral

Sistema digital modular diseñado para viveros comerciales modernos con venta por pauta publicitaria (Instagram, Facebook, TikTok, Google), WhatsApp Business con IA, control riguroso de Kardex e inventario botánico, rutas de delivery y servicios de jardinería.

---

## 🚀 Inicio Rápido

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Iniciar servidor de desarrollo**:
   ```bash
   npm run dev
   ```

3. **Compilar para producción**:
   ```bash
   npm run build
   ```

---

## 📂 Estructura de Módulos Creados

```
vivero-360/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── playwright.config.ts
├── .env.example            # Credenciales Supabase + SUNAT / AFPnet
├── tests/
│   └── vivero-e2e.spec.ts  # Suite E2E (24 flujos de negocio)
├── src/
│   ├── main.tsx
│   ├── App.tsx             # Solo arma el layout y elige la pantalla activa
│   ├── index.css
│   ├── domain/types.ts     # Modelo de dominio único (todos los tipos del negocio)
│   ├── data/seed.ts        # Datos demo iniciales
│   ├── store/
│   │   ├── ErpStore.tsx    # Estado + acciones de negocio (registrarVenta, facturarProyecto…) con persistencia local
│   │   ├── UiStore.tsx     # Pestaña activa (en la URL #hash) y modal abierto
│   │   └── selectors.ts    # Cálculos puros: finanzas, planilla, caja, pendientes del día
│   ├── layout/             # Sidebar, Header, ModalHost y navigation.ts (menú por flujo)
│   ├── components/shared.tsx  # ModalShell, consulta RUC/DNI, escáner
│   ├── modules/
│   │   ├── inicio/         # Panel del dueño + "Pendientes de Hoy"
│   │   ├── ventas/         # Caja del día, Catálogo/POS, ticket, etiquetas QR
│   │   ├── servicios/      # Proyectos de jardinería (cotizado → concluido)
│   │   ├── clientes/       # Ficha única: compras + servicios + alertas WhatsApp
│   │   ├── inventario/     # Kardex con historial de movimientos, mermas, compras
│   │   └── admin/          # SUNAT, GRE, detracciones, SIRE, planilla, ajustes
│   ├── lib/
│   │   ├── peru.ts         # Parámetros y cálculos tributario-laborales (UIT, AFP, SPOT, renta 5ta, mód. 11)
│   │   ├── exports.ts      # Archivos TXT oficiales: SIRE RVIE/RCE y AFPnet PLAPROTE
│   │   ├── supabase.ts     # Cliente Supabase (carga perezosa, no-op sin backend)
│   │   └── sunatClient.ts  # Conector SEE SUNAT (BETA/PRODUCCION) + RUC/RENIEC
│   ├── services/
│   │   └── sunatService.ts # Emisión de comprobantes, IGV 18%, GRE, hash/QR
│   └── types/
│       ├── sunat.ts        # Tipos Facturación Electrónica UBL 2.1
│       └── payroll.ts      # Tipos Planilla / AFPnet / PLAME
└── supabase/
    ├── config.toml
    └── migrations/         # Esquema SQL, roles (dueno/vendedor/jardinero), RLS y datos iniciales
```

### 🔄 Flujo de información

El menú sigue el camino del dinero: **Vender → Servicios → Clientes → Inventario → Administración**.
Cada evento de negocio es una sola acción del store que actualiza todo a la vez:

- **Venta POS** (carrito, descuento por línea y global, pago mixto con vuelto) → comprobante SUNAT + Kardex + caja por medio de pago + (opcional) GRE, **en una sola transacción** del servidor (`registrar_comprobante`)
- **Devolución** → nota de crédito (BC01/FC01) que devuelve stock y registra el reembolso; nunca supera lo vendido
- **Compra** → suma stock → Kardex → Registro de Compras (SIRE RCE)
- **Merma / desmedro** → descuenta stock → Kardex → baja valorizada (la cuarentena no mueve stock)
- **Servicio de jardinería** → descarga de insumos al Kardex → factura/boleta (una sola vez) → detracción SPOT con vencimiento calculado

**Dos modos, según el `.env`:**

- **Modo nube** (con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`): login obligatorio y Supabase como fuente de verdad. El stock lo recalcula el servidor en cada movimiento del Kardex. Cada rol ve sólo lo suyo:
  - **Dueño**: todo, incluida la asignación de roles (*Ajustes → Usuarios*).
  - **Vendedor**: caja, tienda/POS, servicios, clientes, inventario, comprobantes y guías.
  - **Jardinero**: sus servicios (avanzar etapas, descargar insumos), clientes, Kardex y mermas.
- **Modo demo** (sin Supabase): sin login, datos de ejemplo guardados en el navegador (`localStorage`, sin la Clave SOL). *Ajustes → Restablecer datos demo* vuelve al estado inicial. Las pruebas E2E siempre corren en este modo.

Puesta en marcha de la nube: aplicar `supabase/migrations/*.sql` en orden, crear el primer usuario en *Authentication → Users* y darle el rol con `update public.perfiles set rol = 'dueno' where email = '...';`.

### 🇵🇪 Motor tributario-laboral (`src/lib/peru.ts`)

Parámetros y fórmulas centralizados según normativa **vigente 2025** (revisar al publicarse valores 2026):

| Concepto | Valor / regla aplicada |
|---|---|
| UIT / RMV | S/ 5 350 · S/ 1 130 |
| Asignación familiar | 10% RMV = **S/ 113.00** — no aplica a microempresa |
| IGV | 18% (16% + 2% IPM) · NRUS no genera IGV |
| AFP | Fondo 10% + prima ~1.74% (con tope) + comisión por flujo **por AFP** (Habitat 1.47% … Profuturo 1.69%) |
| ONP | 13% |
| Renta 5ta | Proyección − 7 UIT, tramos 8 / 14 / 17 / 20 / 30% |
| EsSalud | 9% (general / pequeña) · **Microempresa: SIS S/ 15/trabajador** |
| CTS / Gratificaciones | Micro: **ninguna** · Pequeña: ½ sueldo c/u · General: completa (+ bonif. Ley 30334) |
| Vacaciones | MYPE 15 días · General 30 días |
| Pago a cuenta Renta | NRUS cuota fija (S/ 20 / S/ 50) · RER 1.5% · RMT 1.0% · RG 1.5% |
| Detracción SPOT servicios | **12%** ("demás servicios", Anexo 3 cód. 037), umbral > S/ 700 |
| Validación de documentos | RUC por módulo 11 · DNI de 8 dígitos (POS Factura/Boleta, compras RCE, facturación de proyectos) |

### 🔌 Integraciones

- **SUNAT (`src/lib/sunatClient.ts`)**: cada emisión de Boleta/Factura/GRE se transmite por `sunatClient` que sella la CDR de respuesta (estado, código, hash). Sin conectividad hace fallback a una CDR simulada, por lo que la UI nunca se bloquea. Configurable vía `VITE_SUNAT_MODO` (`BETA` / `PRODUCCION`).
- **Consulta de RUC / DNI**: botón **"Consultar RUC"** en Compra Mayorista, POS (Factura) y Ajustes. La **validación de módulo 11 funciona siempre offline** y autocompleta la razón social cuando hay `VITE_SUNAT_API_TOKEN` de un puente REST (apis.net.pe / decolecta / factiliza). Sin token → sólo validación local. SUNAT no expone API pública gratuita; para producción se recomienda un proxy (Supabase Edge Function) que evite CORS y oculte el token.
- **Supabase (`src/lib/supabase.ts`)**: sincronización *best-effort* de comprobantes, movimientos de Kardex y configuración de empresa. Si `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` no están configuradas, el SDK ni siquiera se descarga y las llamadas son no-ops silenciosos (modo demo 100 % en memoria).

### ✅ Pruebas

```bash
npx playwright test        # 24 pruebas E2E de extremo a extremo
```

---

## 🌿 Módulos Integrados:
1. **12. Panel del Dueño**: Métricas de ventas del día, pedidos activos, envíos en ruta y alertas de reposición.
2. **1. Catálogo & Tienda**: Cuidados de luz/riego, ubicación por zonas (A-E) y stock vivo.
3. **2. WhatsApp IA**: Cotizaciones automáticas y respuesta a clientes según condiciones de espacio.
4. **3. Pipeline de Pedidos**: Estados: *Pendiente ➔ Pagado ➔ Preparando ➔ En ruta ➔ Entregado*.
5. **4. Kardex Central**: Registro de compras, ventas, mermas por deterioro y salidas a servicios.
6. **6. Almacén por Zonas**: Zonas A (pequeñas), B (medianas: Monstera B-03), C (grandes), D (macetas), E (insumos NPK).
7. **7. Delivery**: Control de choferes y fotos de evidencia.
8. **8. Servicios de Jardinería**: Mantenimientos con descuento automático de insumos en el Kardex.
9. **10. Marketing ROAS**: Medición de retorno por pauta en FB, IG, TikTok y Google.
