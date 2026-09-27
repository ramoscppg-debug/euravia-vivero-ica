// ==========================================
// CATÁLOGO: reglas puras para cargar productos rápido
// - SKU automático por categoría (PLI-001, MAC-001…).
// - Plantilla CSV (Excel en español usa ";") e importación con validación fila por fila.
// - Qué le falta a un producto para estar "listo para la tienda".
// ==========================================
import type { CatalogProduct, Category } from '../domain/types';

export const CATEGORIAS: { id: Category; nombre: string; viva: boolean; prefijo: string }[] = [
  { id: 'interior', nombre: 'Planta de interior', viva: true, prefijo: 'PLI' },
  { id: 'exterior', nombre: 'Planta de exterior', viva: true, prefijo: 'PLE' },
  { id: 'suculentas', nombre: 'Suculentas y cactus', viva: true, prefijo: 'SUC' },
  { id: 'macetas', nombre: 'Macetas', viva: false, prefijo: 'MAC' },
  { id: 'sustratos', nombre: 'Sustratos', viva: false, prefijo: 'SUS' },
  { id: 'fertilizantes', nombre: 'Fertilizantes', viva: false, prefijo: 'FER' },
  { id: 'accesorios', nombre: 'Accesorios', viva: false, prefijo: 'ACC' }
];

export const categoriaDe = (id: Category) => CATEGORIAS.find(c => c.id === id)!;

/** Siguiente SKU libre de la categoría: prefijo + correlativo de 3 dígitos. */
export function siguienteSku(categoria: Category, existentes: string[], reservados: string[] = []): string {
  const { prefijo } = categoriaDe(categoria);
  const usados = new Set([...existentes, ...reservados].map(s => s.toUpperCase()));
  const max = Math.max(0, ...[...usados].map(s => (s.startsWith(`${prefijo}-`) ? Number(s.slice(prefijo.length + 1)) || 0 : 0)));
  let n = max + 1;
  while (usados.has(`${prefijo}-${String(n).padStart(3, '0')}`)) n++;
  return `${prefijo}-${String(n).padStart(3, '0')}`;
}

export const margenPct = (precio: number, costo: number) => {
  const base = precio / 1.18; // el precio incluye IGV; el costo se registra sin IGV
  return base > 0 && costo > 0 ? Math.round(((base - costo) / base) * 100) : null;
};

/** Lo que falta para que el producto se vea completo en la tienda. */
export function pendientesDe(p: CatalogProduct): string[] {
  const f: string[] = [];
  if (!p.fullImage) f.push('foto');
  if (!p.description?.trim()) f.push('descripción');
  if (!(p.cost > 0)) f.push('costo');
  if (p.stock <= 0) f.push('stock');
  if (p.isLivePlant && !p.careLight && !p.careWater) f.push('cuidados');
  return f;
}

// ---------------- CSV ----------------
export const COLUMNAS = ['sku', 'nombre', 'categoria', 'precio', 'costo', 'stock_inicial', 'stock_minimo', 'descripcion', 'nombre_cientifico', 'luz', 'riego', 'ubicacion', 'foto_url', 'visible', 'destacado'] as const;

/** Plantilla con encabezados y una fila de guía (los valores son un ejemplo que el dueño reemplaza). */
export function plantillaCsv(): string {
  const guia = ['(vacío = automático)', 'Nombre del producto', 'interior | exterior | suculentas | macetas | sustratos | fertilizantes | accesorios', '0.00', '0.00', '0', '5', '', '', '', '', '', 'https://…', 'si', 'no'];
  return `﻿${COLUMNAS.join(';')}\n${guia.join(';')}\n`;
}

/** Lee CSV con ";" o "," y comillas dobles (formato que exporta Excel). */
export function leerCsv(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const primera = limpio.split('\n', 1)[0] ?? '';
  const sep = (primera.match(/;/g)?.length ?? 0) >= (primera.match(/,/g)?.length ?? 0) ? ';' : ',';
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let comillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (comillas) {
      if (c === '"' && limpio[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(celda); celda = ''; }
    else if (c === '\n') { fila.push(celda); filas.push(fila); fila = []; celda = ''; }
    else celda += c;
  }
  if (celda || fila.length) { fila.push(celda); filas.push(fila); }
  return filas.filter(f => f.some(c => c.trim()));
}

const normalizar = (t: string) => t.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const numero = (t: string) => Number(t.trim().replace(/^s\/\s*/i, '').replace(/\s/g, '').replace(/,(\d{1,2})$/, '.$1').replace(/,/g, ''));
const siNo = (t: string, def: boolean) => (!t.trim() ? def : /^(si|sí|s|1|true|x|yes)$/i.test(t.trim()));

const ALIAS: Record<string, (typeof COLUMNAS)[number]> = {
  codigo: 'sku', producto: 'nombre', precio_venta: 'precio', costo_unitario: 'costo', stock: 'stock_inicial', cantidad: 'stock_inicial',
  minimo: 'stock_minimo', foto: 'foto_url', imagen: 'foto_url', imagen_url: 'foto_url', descripción: 'descripcion'
};

export interface FilaImportada {
  linea: number;
  producto: CatalogProduct;
  stockInicial: number;
  errores: string[];
}

/** Convierte el CSV en productos listos para crear, con los errores de cada fila (no se importa una fila con errores). */
export function interpretarCsv(texto: string, existentes: CatalogProduct[]): { filas: FilaImportada[]; errorGeneral?: string } {
  const tabla = leerCsv(texto);
  if (tabla.length < 2) return { filas: [], errorGeneral: 'El archivo no tiene filas de productos.' };
  const encabezados = tabla[0].map(h => { const n = normalizar(h); return (ALIAS[n] ?? n) as string; });
  if (!encabezados.includes('nombre') || !encabezados.includes('precio')) {
    return { filas: [], errorGeneral: 'Faltan las columnas obligatorias "nombre" y "precio". Usa la plantilla.' };
  }
  const skusExistentes = existentes.map(p => p.sku);
  const reservados: string[] = [];
  const filas: FilaImportada[] = [];

  tabla.slice(1).forEach((celdas, i) => {
    const v = (col: string) => (celdas[encabezados.indexOf(col)] ?? '').trim();
    if (v('nombre') === 'Nombre del producto') return; // fila de guía de la plantilla
    const errores: string[] = [];
    const catTexto = normalizar(v('categoria') || 'interior');
    const cat = CATEGORIAS.find(c => c.id === catTexto || normalizar(c.nombre) === catTexto || catTexto.startsWith(c.id.slice(0, 5)));
    if (!cat) errores.push(`categoría "${v('categoria')}" no reconocida`);
    const categoria = cat ?? CATEGORIAS[0];
    let sku = v('sku').toUpperCase();
    if (sku && !/^[A-Z0-9-]{3,30}$/.test(sku)) errores.push('SKU con caracteres no válidos');
    if (sku && (skusExistentes.includes(sku) || reservados.includes(sku))) errores.push(`el SKU ${sku} ya existe`);
    if (!sku) sku = siguienteSku(categoria.id, skusExistentes, reservados);
    reservados.push(sku);
    const nombre = v('nombre');
    if (!nombre) errores.push('falta el nombre');
    const precio = numero(v('precio'));
    if (!(precio > 0)) errores.push('precio inválido');
    const costo = v('costo') ? numero(v('costo')) : 0;
    if (!(costo >= 0)) errores.push('costo inválido');
    const stockInicial = v('stock_inicial') ? numero(v('stock_inicial')) : 0;
    if (!Number.isInteger(stockInicial) || stockInicial < 0) errores.push('stock inicial debe ser un entero ≥ 0');
    else if (stockInicial > 0 && !(costo > 0)) errores.push('con stock inicial indica el costo');
    const minimo = v('stock_minimo') ? numero(v('stock_minimo')) : 5;
    if (!Number.isInteger(minimo) || minimo < 0) errores.push('stock mínimo inválido');
    const foto = v('foto_url');
    if (foto && !/^https:\/\//.test(foto)) errores.push('la foto debe ser un enlace https');

    filas.push({
      linea: i + 2,
      stockInicial: Math.max(0, Math.floor(stockInicial || 0)),
      errores,
      producto: {
        sku, name: nombre, category: categoria.id, categoryName: categoria.nombre, isLivePlant: categoria.viva,
        price: precio || 0, cost: costo || 0, stock: 0, minStock: Math.max(0, Math.floor(minimo || 0)),
        description: v('descripcion'), scientificName: v('nombre_cientifico') || undefined, careLight: v('luz') || undefined, careWater: v('riego') || undefined,
        location: v('ubicacion'), fullImage: foto, botanicalFamily: '', visibleTienda: siNo(v('visible'), true), destacado: siNo(v('destacado'), false)
      }
    });
  });
  return { filas };
}
