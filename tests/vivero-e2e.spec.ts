import fs from 'fs';
import { test, expect, type Page } from '@playwright/test';

/** Abre una sección del centro de control por su enlace (#hash), como un marcador del navegador. */
async function ir(page: Page, tab: string) {
  await page.evaluate(t => { window.location.hash = t; }, tab);
  await page.waitForFunction(t => window.location.hash === `#${t}`, tab);
}

test.describe('AUREVIA ERP Vivero 360° - Comprehensive E2E Tests', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (exception) => {
      consoleErrors.push(exception.message);
    });
    await page.goto('/');
    // Check main branding
    await expect(page.getByRole('heading', { name: 'AUREVIA', exact: true })).toBeVisible();
  });

  test('1. Dashboard 360° loads without errors and renders KPI summary', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Inicio', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Centro de control de ventas' })).toBeVisible();
    // Accesos por área de trabajo
    for (const hub of ['Ventas', 'Catálogo y almacén', 'Servicios', 'Contabilidad']) {
      await expect(page.getByRole('heading', { name: hub, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Pendientes de Hoy' })).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('2. Navigation across all business areas via Sidebar & Top Switcher', async ({ page }) => {
    // 1. Tienda & Catalogo
    await ir(page, 'catalogo');
    await expect(page.getByRole('heading', { name: 'Monstera Deliciosa' })).toBeVisible();

    // 2. Jardines & Paisajismo
    await ir(page, 'jardineria');
    await expect(page.getByText('Servicios de Jardinería, Paisajismo & Mantenimiento')).toBeVisible();

    // 3. Kardex & Almacen
    await ir(page, 'kardex');
    await expect(page.getByText('Kardex valorizado (costo promedio ponderado)')).toBeVisible();

    // 4. Guías de Remisión
    await ir(page, 'guias');
    await expect(page.getByRole('heading', { name: 'Guías de Remisión Electrónica (GRE Remitente T001)' })).toBeVisible();

    // 5. Facturación SUNAT
    await ir(page, 'sunat');
    await expect(page.getByRole('heading', { name: 'Comprobantes de Pago Electrónicos' })).toBeVisible();

    // 6. Contabilidad & SIRE
    await ir(page, 'contabilidad');
    await expect(page.getByText('Configuración del Régimen Tributario SUNAT')).toBeVisible();

    // 7. Planilla & Provisiones
    await ir(page, 'planilla');
    await expect(page.getByRole('heading', { name: 'Gestión de Nómina, AFP y Seguro Social' })).toBeVisible();

    // 8. Ajustes Empresa
    await ir(page, 'configuracion');
    await expect(page.getByRole('heading', { name: 'Datos Fiscales, Series & Cuentas Bancarias' })).toBeVisible();

    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('3. Etiquetas QR por lote: N copias por producto y el QR se lee en la caja', async ({ page }) => {
    await ir(page, 'catalogo');
    await page.locator('button:has-text("QR Tag")').first().click();
    await expect(page.getByRole('heading', { name: 'Etiquetas QR', exact: true })).toBeVisible();
    await expect(page.getByLabel('Vista previa de la etiqueta').locator('svg')).toBeVisible(); // QR real, no un ícono
    await page.getByLabel('Copias de Ficus Lyrata Pandurata').fill('30');
    await expect(page.getByRole('button', { name: 'Imprimir 40 etiqueta(s)' })).toBeVisible(); // 10 del producto elegido + 30
    await page.getByRole('button', { name: 'Imprimir 40 etiqueta(s)' }).click();
    // Se imprime desde un marco propio (no la pantalla del panel) con las 40 etiquetas
    await expect.poll(() => page.evaluate(() => document.querySelector('iframe')?.contentDocument?.querySelectorAll('.et').length ?? 0)).toBe(40);
    await page.locator('.fixed button[aria-label="Cerrar"]').first().click();

    // El lector de la caja recibe el enlace del QR y suma el producto
    await page.click('button:has-text("Nueva venta")');
    await page.getByLabel('Buscar o escanear producto').fill('http://localhost:5199/tienda/producto/AUR-003');
    await page.keyboard.press('Enter');
    await expect(page.getByText('+1 Ficus Lyrata Pandurata')).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('4. POS Quick Barcode Scanner & SUNAT Electronic Invoicing Flow', async ({ page }) => {
    await page.click('button:has-text("Nueva venta")');
    await expect(page.getByText('Emitir Venta & CPE SUNAT (POS)')).toBeVisible();

    // Escáner: escribir el SKU y Enter lo agrega al carrito
    await page.getByLabel('Buscar o escanear producto').fill('AUR-001');
    await page.keyboard.press('Enter');
    await page.getByLabel('Tipo de comprobante').selectOption('03');
    await page.click('button:has-text("Emitir Comprobante SUNAT")');

    await expect(page.getByText('COMPROBANTE ELECTRÓNICO')).toBeVisible();
    await expect(page.getByText('RUC: 20609876541')).toBeVisible();

    await page.locator('button:has(svg.lucide-x)').first().click();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('5. Inventory & Warehouse Purchases (Kardex + SIRE RCE)', async ({ page }) => {
    await page.click('button:has-text("Ingreso a almacén")');
    await expect(page.getByRole('heading', { name: 'Registrar compra a proveedor' })).toBeVisible();

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Ingreso registrado con éxito');
      await dialog.accept();
    });

    await page.click('button:has-text("Registrar e Incrementar Stock")');
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('6. Guía de Remisión Electrónica (GRE Remitente)', async ({ page }) => {
    await ir(page, 'guias');
    await expect(page.getByRole('heading', { name: 'Guías de Remisión Electrónica (GRE Remitente T001)' })).toBeVisible();
    await expect(page.getByText('T001-00000014')).toBeVisible();
    await expect(page.getByText('Valeria Benavides (DNI 47891234)')).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('7. Accounting, SIRE Electronic Books & AFPnet Export', async ({ page }) => {
    await ir(page, 'contabilidad');
    await expect(page.getByText('Configuración del Régimen Tributario SUNAT')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exportar RVIE (SIRE)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exportar RCE (SIRE)' })).toBeVisible();

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('RVIE');
      await dialog.accept();
    });
    await page.click('button:has-text("Exportar RVIE (SIRE)")');

    await ir(page, 'planilla');
    await expect(page.getByRole('heading', { name: 'Gestión de Nómina, AFP y Seguro Social' })).toBeVisible();

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('PLAPROTE.TXT');
      await dialog.accept();
    });
    await page.click('button:has-text("Exportar a AFPnet (PLAPROTE.TXT)")');

    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('8. Company Settings & SUNAT Configuration Save', async ({ page }) => {
    await ir(page, 'configuracion');
    
    const rucInput = page.locator('input[value="20609876541"]');
    await expect(rucInput).toBeVisible();
    await page.getByText('Para la conexión directa con SUNAT (opcional, más adelante)').click();
    await expect(page.getByText('CDT_AUREVIA_2026_2029.pfx')).toBeVisible();

    await page.click('button:has-text("Guardar Todos los Cambios")');
    await expect(page.getByText('¡Datos de la empresa, RUC y credenciales SUNAT/AFPnet actualizados con éxito!')).toBeVisible();

    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('9. Control de Caja Chica & Arqueo Diario', async ({ page }) => {
    await ir(page, 'caja');
    await expect(page.getByText('Control de Caja Chica & Arqueo Diario')).toBeVisible();
    await expect(page.getByText('Efectivo en Gaveta')).toBeVisible();
    await expect(page.getByText('Yape & Plin')).toBeVisible();

    // Check cerrar/cuadre button
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Arqueo de caja realizado');
      await dialog.accept();
    });
    await page.click('button:has-text("Realizar Cierre / Cuadre")');

    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('10. Monitor de Detracciones SPOT (Banco de la Nación)', async ({ page }) => {
    await ir(page, 'detracciones');
    await expect(page.getByText('Sistema de Detracciones SPOT (SUNAT & Banco de la Nación)')).toBeVisible();
    await expect(page.getByText('F001-00000088')).toBeVisible();
    await expect(page.getByText('Boutique Hotel Miraflores SAC')).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('11. CRM Botánico & Alertas Estacionales', async ({ page }) => {
    await ir(page, 'crm');
    await expect(page.getByText('CRM Botánico & Fidelización de Clientes')).toBeVisible();
    await expect(page.getByText('Valeria Benavides')).toBeVisible();
    await expect(page.getByText('Enviar WhatsApp Botánico').first()).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('12. Módulo de Bajas Biológicas & Cuarentena', async ({ page }) => {
    await ir(page, 'bajas');
    await expect(page.getByText('Módulo de Bajas Biológicas & Cuarentena')).toBeVisible();
    await expect(page.getByText('Monstera Deliciosa')).toBeVisible();
    await expect(page.getByText('DESMEDRO PLAGA')).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('13. Detracción SPOT servicios al 12% (Anexo 3 cód. 037)', async ({ page }) => {
    await ir(page, 'detracciones');
    await expect(page.getByText('Sistema de Detracciones SPOT (SUNAT & Banco de la Nación)')).toBeVisible();
    // La tasa vigente para "demás servicios gravados con IGV" es 12%, no 10%
    await expect(page.getByText(/Detracción \(12%\)/).first()).toBeVisible();
    await expect(page.getByText('S/ 696.00').first()).toBeVisible(); // 5 800 * 12%
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('14. Planilla régimen-aware: microempresa usa SIS y sin CTS/gratificaciones', async ({ page }) => {
    await ir(page, 'planilla');
    await expect(page.getByRole('heading', { name: 'Gestión de Nómina, AFP y Seguro Social' })).toBeVisible();

    // El aporte de salud ya no se rotula "EsSalud 9%" fijo
    await expect(page.getByText('Aporte Salud (EsSalud / SIS)')).toBeVisible();
    await expect(page.getByText(/Microempresa: SIS S\/ 15/)).toBeVisible();

    // 3 trabajadores microempresa -> SIS S/ 15 c/u = S/ 45.00
    await expect(page.getByText('S/ 45.00').first()).toBeVisible();
    // Renta de 5ta categoría: sueldos < 7 UIT -> retención S/ 0.00
    await expect(page.getByText(/Renta 5ta retenida: S\/ 0\.00/)).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('15. Régimen NRUS: cuota fija y sin IGV', async ({ page }) => {
    await ir(page, 'contabilidad');
    await page.click('button:has-text("Nuevo RUS (NRUS)")');
    await expect(page.getByText(/Cuota fija NRUS categoría/)).toBeVisible();
    await expect(page.getByText(/Sin IGV en NRUS/)).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('16. Botón "Consultar RUC" ejecuta la validación módulo 11 (offline)', async ({ page }) => {
    await ir(page, 'configuracion');
    await expect(page.getByRole('heading', { name: 'Datos Fiscales, Series & Cuentas Bancarias' })).toBeVisible();

    // El RUC de demo (20609876541) no cumple el dígito verificador -> aviso módulo 11
    let dialogMsg = '';
    page.once('dialog', async (dialog) => {
      dialogMsg = dialog.message();
      await dialog.accept();
    });
    await page.click('button:has-text("Consultar")');
    await expect.poll(() => dialogMsg).toContain('módulo 11');

    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('17. Una venta POS descuenta stock y queda registrada en el Kardex', async ({ page }) => {
    await page.click('button:has-text("Nueva venta")');
    await page.locator('.fixed button:has-text("Monstera Deliciosa")').click();
    await page.click('button:has-text("Emitir Comprobante SUNAT")');
    await expect(page.getByText('COMPROBANTE ELECTRÓNICO')).toBeVisible();
    await page.locator('button:has(svg.lucide-x)').first().click();

    await ir(page, 'kardex');
    const fila = page.locator('tr', { hasText: 'Venta Cliente' }).first();
    await expect(fila).toContainText('AUR-001');
    await expect(fila).toContainText('27'); // 28 iniciales - 1 vendida
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('18. Proyecto de jardinería: se factura una sola vez y genera detracción', async ({ page }) => {
    await ir(page, 'jardineria');
    const proyecto = page.locator('div.rounded-3xl', { hasText: 'JAR-2026-002' }).last();
    await proyecto.locator('button:has-text("Facturar con SPOT")').click();
    await expect(page.getByText('FACTURA ELECTRÓNICA')).toBeVisible();
    await page.locator('button:has(svg.lucide-x)').first().click();

    await expect(proyecto.getByText(/Facturado: F001-/)).toBeVisible();
    await expect(proyecto.locator('button:has-text("Facturar con SPOT")')).toHaveCount(0);

    await ir(page, 'detracciones');
    await expect(page.getByText('Pendiente de Pago')).toHaveCount(2); // la inicial + la nueva
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('20. Una factura de compra no se registra dos veces', async ({ page }) => {
    const mensajes: string[] = [];
    page.on('dialog', d => { mensajes.push(d.message()); void d.accept(); });
    for (let i = 0; i < 2; i++) {
      await page.click('button:has-text("Ingreso a almacén")');
      await page.click('button:has-text("Registrar e Incrementar Stock")');
    }
    await expect.poll(() => mensajes.length).toBe(2);
    expect(mensajes[1]).toContain('ya está registrada');
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('21. La Clave SOL no se guarda en el navegador ni en los comprobantes', async ({ page }) => {
    await page.click('button:has-text("Nueva venta")');
    await page.locator('.fixed button:has-text("Monstera Deliciosa")').click();
    await page.check('input[type=checkbox]'); // con guía de remisión
    await page.click('button:has-text("Emitir Comprobante SUNAT")');
    await expect(page.getByText('COMPROBANTE ELECTRÓNICO')).toBeVisible();
    const guardado = await page.evaluate(() => localStorage.getItem('aurevia.erp.v1') ?? '');
    expect(guardado).not.toContain('claveSol');
    // Los comprobantes y guías sólo llevan los datos públicos del emisor
    const estado = JSON.parse(guardado);
    const emisores = [...estado.invoices, ...estado.guiasRemision].map((d: { emisor: object }) => JSON.stringify(d.emisor));
    for (const e of emisores) expect(e).not.toMatch(/usuarioSol|cuentaBcp|afpnet/);
  });

  test('19. Los datos persisten al recargar y la pestaña queda en la URL', async ({ page }) => {
    await page.click('button:has-text("Ingreso a almacén")');
    page.once('dialog', dialog => dialog.accept());
    await page.click('button:has-text("Registrar e Incrementar Stock")');

    await ir(page, 'kardex');
    await expect(page).toHaveURL(/#kardex$/);
    await page.reload();
    await expect(page.getByText('Kardex valorizado (costo promedio ponderado)')).toBeVisible();
    await expect(page.locator('tr', { hasText: 'FC01-0009981' })).toHaveCount(1);
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('22. Carrito con varios productos, descuento global y pago mixto', async ({ page }) => {
    await page.click('button:has-text("Nueva venta")');
    const pos = page.locator('.fixed');
    await pos.locator('button:has-text("Monstera Deliciosa")').click();
    await pos.getByLabel('Más AUR-001').click(); // 2 × 85 + IGV = 200.60
    await pos.locator('button:has-text("Sansevieria Laurentii")').click(); // + 48 + IGV = 257.24
    await pos.getByLabel('Valor del descuento').fill('10'); // 10% → 231.52
    await expect(pos.getByLabel('Total a cobrar')).toHaveText('S/ 231.52');

    await pos.locator('button:has-text("+ Pago")').click();
    await pos.getByLabel('Monto 1').fill('100');
    await pos.locator('button:has-text("completar")').click(); // Yape 131.52
    await expect(pos.getByText('Cobro completo ✓')).toBeVisible();
    await page.click('button:has-text("Emitir Comprobante SUNAT")');

    await expect(page.getByText('Total: S/ 231.52')).toBeVisible();
    await expect(page.getByText('Pago Yape: 131.52')).toBeVisible();
    await expect(page.getByText('Descuento aplicado: -25.72')).toBeVisible();
    await page.locator('button:has(svg.lucide-x)').first().click();

    await ir(page, 'kardex');
    await expect(page.locator('table').first().locator('tr', { hasText: 'AUR-001' }).locator('td').nth(5)).toHaveText('26');
    await expect(page.locator('table').first().locator('tr', { hasText: 'AUR-002' }).locator('td').nth(5)).toHaveText('34');
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('23. Pago con billete calcula el vuelto y no permite pagar de menos', async ({ page }) => {
    await page.click('button:has-text("Nueva venta")');
    const pos = page.locator('.fixed');
    await pos.locator('button:has-text("Monstera Deliciosa")').click();
    await pos.getByLabel('Monto 1').fill('50');
    await expect(pos.getByText('Falta cobrar S/ 50.30.')).toBeVisible(); // 85 + IGV = 100.30
    await expect(page.locator('button:has-text("Emitir Comprobante SUNAT")')).toBeDisabled();

    await pos.locator('button:has-text("S/ 200")').click();
    await expect(pos.getByText('Vuelto: S/ 99.70')).toBeVisible();
    await page.click('button:has-text("Emitir Comprobante SUNAT")');
    await expect(page.getByText('Vuelto: S/ 99.70')).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('24. Devolución parcial emite nota de crédito y devuelve stock', async ({ page }) => {
    await page.click('button:has-text("Nueva venta")');
    const pos = page.locator('.fixed');
    await pos.locator('button:has-text("Monstera Deliciosa")').click();
    await pos.getByLabel('Más AUR-001').click();
    await page.click('button:has-text("Emitir Comprobante SUNAT")');
    await expect(page.getByText('COMPROBANTE ELECTRÓNICO')).toBeVisible();
    await page.locator('button:has(svg.lucide-x)').first().click();

    await ir(page, 'sunat');
    await page.getByRole('button', { name: /^Todos/ }).click();
    await page.locator('button:has-text("Devolución")').first().click();
    const modal = page.locator('.fixed');
    await modal.getByLabel('Devolver AUR-001').fill('1');
    await modal.getByLabel('Motivo de la devolución').fill('Hoja dañada');
    await modal.locator('button:has-text("Emitir Nota de Crédito")').click();
    await expect(page.getByText('NOTA DE CRÉDITO ELECTRÓNICA')).toBeVisible();
    await expect(page.getByText(/Modifica a: B001-/)).toBeVisible();
    await page.locator('button:has(svg.lucide-x)').first().click();

    // Queda 1 por devolver: el campo no deja pasar de 1
    await page.locator('button:has-text("Devolución")').nth(1).click();
    await page.locator('.fixed').getByLabel('Devolver AUR-001').fill('5');
    await expect(page.locator('.fixed').getByLabel('Devolver AUR-001')).toHaveValue('1');
    await page.locator('.fixed button:has(svg.lucide-x)').first().click();

    await ir(page, 'kardex');
    await expect(page.locator('table').first().locator('tr', { hasText: 'AUR-001' }).locator('td').nth(5)).toHaveText('27'); // 28 - 2 + 1
    await expect(page.locator('table').nth(1).locator('tr', { hasText: 'Devolucion Cliente' })).toHaveCount(1);
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('25. Pedido completo: crear → cobrar → preparar → en ruta → entregado', async ({ page }) => {
    page.on('dialog', d => void d.accept(d.type() === 'prompt' ? 'Raúl Morales Alva' : undefined));
    await ir(page, 'pedidos');
    await expect(page.getByRole('heading', { name: 'Pedidos & Delivery' })).toBeVisible();

    await page.click('button:has-text("Nuevo Pedido")');
    const m = page.locator('.fixed');
    await m.getByLabel('Canal').selectOption('Instagram Ads');
    await m.getByLabel('Nombre del cliente').fill('Lucía Torres');
    await m.getByLabel('Teléfono').fill('+51 955 111 222');
    await m.getByLabel('Dirección de entrega').fill('Av. Primavera 900');
    await m.getByLabel('Distrito').fill('Surco');
    await m.getByLabel('Producto').selectOption('AUR-003');
    await m.locator('button:has-text("+ Agregar")').click();
    await expect(m.getByLabel('Total del pedido')).toHaveText('S/ 151.60'); // 120 + IGV + 10 delivery
    await m.locator('button:has-text("Guardar Pedido")').click();

    const tarjeta = page.getByRole('article').filter({ hasText: 'Lucía Torres' });
    await expect(page.getByRole('region', { name: 'Columna Por cobrar' }).getByText('Lucía Torres')).toBeVisible();

    await tarjeta.locator('button:has-text("Cobrar")').click();
    await page.locator('.fixed button:has-text("Cobrar y emitir")').click();
    await expect(page.getByText('COMPROBANTE ELECTRÓNICO')).toBeVisible();
    await expect(page.getByText(/Servicio de delivery/)).toBeVisible();
    await page.locator('button:has(svg.lucide-x)').first().click();

    await expect(page.getByRole('region', { name: 'Columna Pagado' }).getByText('Lucía Torres')).toBeVisible();
    await tarjeta.locator('button:has-text("Preparar")').click();
    await tarjeta.locator('button:has-text("Enviar")').click();
    await expect(page.getByRole('region', { name: 'Columna En ruta' }).getByText('Lucía Torres')).toBeVisible();
    await tarjeta.locator('button:has-text("Entregado")').click();
    await page.locator('.fixed button:has-text("Marcar entregado")').click();
    await expect(page.getByRole('region', { name: 'Columna Entregado' }).getByText('Lucía Torres')).toBeVisible();

    // El stock bajó al cobrar (14 → 13) y quedó la guía de remisión
    await ir(page, 'kardex');
    await expect(page.locator('table').first().locator('tr', { hasText: 'AUR-003' }).locator('td').nth(5)).toHaveText('13');
    await ir(page, 'guias');
    await expect(page.getByText('Av. Primavera 900, Surco')).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('26. Pedidos reservan stock y un pedido pendiente se puede cancelar', async ({ page }) => {
    const mensajes: string[] = [];
    page.on('dialog', d => { mensajes.push(d.message()); void d.accept(); });
    await ir(page, 'pedidos');

    // Ficus: 14 en stock → pedir 15 no se permite
    await page.click('button:has-text("Nuevo Pedido")');
    const m = page.locator('.fixed');
    await m.getByLabel('Nombre del cliente').fill('Cliente Grande');
    await m.getByLabel('Teléfono').fill('999888777');
    await m.getByLabel('Dirección de entrega').fill('Calle 1');
    await m.getByLabel('Producto').selectOption('AUR-003');
    await m.locator('button:has-text("+ Agregar")').click();
    await m.getByLabel('Cantidad AUR-003').fill('15');
    await m.locator('button:has-text("Guardar Pedido")').click();
    await expect.poll(() => mensajes.at(-1) ?? '').toContain('Solo hay 14 u. libres');
    await m.locator('button[aria-label="Cerrar"]').click();

    // El pedido de ejemplo por cobrar se cancela
    const pendiente = page.getByRole('article').filter({ hasText: 'Carlos Mendoza Paredes' });
    await pendiente.locator('button[title="Cancelar pedido"]').click();
    await expect(page.getByRole('region', { name: 'Columna Por cobrar' }).getByText('Carlos Mendoza Paredes')).toHaveCount(0);
    await expect(page.getByText(/Ver 1 pedido\(s\) cancelado/)).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('27. CRM: crear cliente, buscarlo y anotar en su ficha', async ({ page }) => {
    await ir(page, 'crm');
    await page.click('button:has-text("Nuevo cliente")');
    const m = page.locator('.fixed');
    await m.getByLabel('Nombre').fill('Rosa Quispe');
    await m.getByLabel('DNI o RUC').fill('40506070');
    await m.getByLabel('Teléfono').fill('+51 912 345 678');
    await m.getByLabel('Distrito').fill('Ica');
    await m.locator('button:has-text("Crear cliente")').click();

    await page.getByLabel('Buscar cliente').fill('40506070');
    await expect(page.getByRole('heading', { name: 'Rosa Quispe' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Valeria Benavides' })).toHaveCount(0);

    await page.locator('button:has-text("Ver ficha")').click();
    await page.getByRole('tab', { name: 'Notas y tareas' }).click();
    await page.getByLabel('Nueva nota').fill('Busca plantas para oficina con poca luz');
    await page.locator('button:has-text("Guardar nota")').click();
    await page.getByRole('tab', { name: 'Historial' }).click();
    await expect(page.locator('.fixed').getByText('Busca plantas para oficina con poca luz')).toBeVisible();

    // No se permiten dos clientes con el mismo documento
    await page.locator('.fixed button[aria-label="Cerrar"]').click();
    const mensajes: string[] = [];
    page.on('dialog', d => { mensajes.push(d.message()); void d.accept(); });
    await page.click('button:has-text("Nuevo cliente")');
    await page.locator('.fixed').getByLabel('Nombre').fill('Otra Rosa');
    await page.locator('.fixed').getByLabel('DNI o RUC').fill('40506070');
    await page.locator('.fixed button:has-text("Crear cliente")').click();
    await expect.poll(() => mensajes.at(-1) ?? '').toContain('Ya existe un cliente');
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('28. CRM: una venta aparece en el historial y en los cuidados; tareas se completan', async ({ page }) => {
    // Venta a Valeria por su DNI (el POS completa el nombre)
    await page.click('button:has-text("Nueva venta")');
    const pos = page.locator('.fixed');
    await pos.locator('button:has-text("Ficus Lyrata Pandurata")').click();
    await pos.getByLabel('Documento del cliente').fill('47891234');
    await expect(pos.getByLabel('Nombre del cliente')).toHaveValue('Valeria Benavides');
    await page.click('button:has-text("Emitir Comprobante SUNAT")');
    await expect(page.getByText('COMPROBANTE ELECTRÓNICO')).toBeVisible();
    await page.locator('button:has(svg.lucide-x)').first().click();

    await ir(page, 'crm');
    const tarjeta = page.locator('div.rounded-3xl', { has: page.getByRole('heading', { name: 'Valeria Benavides' }) }).last();
    await tarjeta.locator('button:has-text("Ver ficha")').click();
    const ficha = page.locator('.fixed');
    await expect(ficha.getByText(/Compra B001-/).first()).toBeVisible();
    await ficha.getByRole('tab', { name: 'Cuidados' }).click();
    await expect(ficha.getByText('Ficus Lyrata Pandurata')).toBeVisible();
    await expect(ficha.getByText(/Próximo cuidado:/).first()).toBeVisible();

    await ficha.getByRole('tab', { name: 'Notas y tareas' }).click();
    await ficha.getByLabel('Tarea').fill('Enviar foto del ficus instalado');
    await ficha.locator('button:has-text("Agregar")').click();
    await page.locator('.fixed button[aria-label="Cerrar"]').click();

    await page.getByLabel('Completar: Enviar foto del ficus instalado').click();
    await expect(page.getByLabel('Completar: Enviar foto del ficus instalado')).toHaveCount(0);
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('29. CRM: importar y exportar clientes en CSV', async ({ page }) => {
    const mensajes: string[] = [];
    page.on('dialog', d => { mensajes.push(d.message()); void d.accept(); });
    await ir(page, 'crm');
    await page.getByLabel('Archivo CSV de clientes').setInputFiles({
      name: 'clientes.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Nombre;DNI;Celular;Distrito\nPedro Huamán;41414141;987111222;Ica\n"Jardines del Sur, SAC";;956000111;Parcona\n')
    });
    await expect.poll(() => mensajes.at(-1) ?? '').toContain('2 cliente(s) nuevo(s)');
    await expect(page.getByRole('heading', { name: 'Jardines del Sur, SAC' })).toBeVisible();

    const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Exportar CSV")')]);
    const contenido = fs.readFileSync(await descarga.path(), 'utf8');
    expect(contenido.split('\n')[0]).toBe('nombre,documento,telefono,email,direccion,distrito,canal,urgencia,plantas');
    expect(contenido).toContain('Pedro Huamán,41414141,987111222');
    expect(contenido).toContain('"Jardines del Sur, SAC"');
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('30. POS: cupón de descuento y canje de puntos del cliente', async ({ page }) => {
    await page.click('button:has-text("Nueva venta")');
    const pos = page.locator('.fixed');
    await pos.locator('button:has-text("Monstera Deliciosa")').click(); // 85 + IGV = 100.30
    await pos.getByLabel('Documento del cliente').fill('47891234'); // Valeria: 8 puntos
    await pos.getByLabel('Código de cupón').fill('bienvenida10');
    await pos.locator('button:has-text("Aplicar")').click(); // 10% → 90.27
    await expect(pos.getByText('✓ BIENVENIDA10: − S/ 10.03')).toBeVisible();
    await pos.getByLabel('Puntos a canjear').fill('8'); // S/ 0.80 → 89.47
    await expect(pos.getByLabel('Total a cobrar')).toHaveText('S/ 89.47');
    await page.click('button:has-text("Emitir Comprobante SUNAT")');
    await expect(page.getByText('Cupón: BIENVENIDA10')).toBeVisible();
    await expect(page.getByText('Puntos canjeados: 8')).toBeVisible();
    await expect(page.getByText('Puntos ganados: 8')).toBeVisible(); // piso(89.47 / 10)
    await page.locator('button:has(svg.lucide-x)').first().click();

    // El cupón con compra mínima no aplica a una venta chica
    const mensajes: string[] = [];
    page.on('dialog', d => { mensajes.push(d.message()); void d.accept(); });
    await page.click('button:has-text("Nueva venta")');
    await pos.locator('button:has-text("Sustrato Premium")').click(); // 28 < 100
    await pos.getByLabel('Código de cupón').fill('DELIVERY10');
    await pos.locator('button:has-text("Aplicar")').click();
    await expect.poll(() => mensajes.at(-1) ?? '').toContain('compra mínima');
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('31. Cotización: crear, y convertir en venta con el carrito precargado', async ({ page }) => {
    await ir(page, 'cotizaciones');
    await page.click('button:has-text("Nueva Cotización")');
    const m = page.locator('.fixed');
    await m.getByLabel('Cliente').fill('Oficinas Ica SAC');
    await m.getByLabel('Producto').selectOption('AUR-002');
    await m.locator('button:has-text("+ Agregar")').click();
    await m.getByLabel('Cantidad AUR-002').fill('3'); // 3 × 48 + IGV
    await expect(m.getByLabel('Total cotizado')).toHaveText('S/ 169.92');
    await m.locator('button:has-text("Guardar Cotización")').click();

    const cot = page.getByRole('article').filter({ hasText: 'Oficinas Ica SAC' });
    await expect(cot.getByText('ENVIADA')).toBeVisible();
    await cot.locator('button:has-text("Convertir en venta")').click();
    await expect(page.locator('.fixed').getByLabel('Total a cobrar')).toHaveText('S/ 169.92');
    await page.click('button:has-text("Emitir Comprobante SUNAT")');
    await expect(page.getByText('COMPROBANTE ELECTRÓNICO')).toBeVisible();
    await page.locator('button:has(svg.lucide-x)').first().click();
    await expect(cot.getByText('CONVERTIDA')).toBeVisible();
    await expect(cot.locator('button:has-text("Convertir en venta")')).toHaveCount(0);
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('32. Contrato de mantenimiento: facturar el mes una sola vez, con detracción y visitas', async ({ page }) => {
    page.on('dialog', d => void d.accept());
    await ir(page, 'contratos');
    const con = page.getByRole('article').filter({ hasText: 'Boutique Hotel Miraflores SAC' });
    await expect(con.getByText('Toca facturar este mes')).toBeVisible();
    await con.locator('button:has-text("Facturar")').click();
    await expect(page.getByText('FACTURA ELECTRÓNICA')).toBeVisible();
    await page.locator('button:has(svg.lucide-x)').first().click();
    await expect(con.getByText(/✅ Facturado/)).toBeVisible();
    await expect(con.locator('button:has-text("Facturar")')).toHaveCount(0);

    // 850 > 700 con RUC → detracción; y quedaron agendadas las visitas del mes
    await ir(page, 'detracciones');
    await expect(page.getByText('Pendiente de Pago')).toHaveCount(2);
    await ir(page, 'crm');
    await expect(page.getByText(/2 visita\(s\) de mantenimiento/)).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('33. Reportes: ventas del mes por producto, canal y vendedor', async ({ page }) => {
    await page.click('button:has-text("Nueva venta")');
    const pos = page.locator('.fixed');
    await pos.locator('button:has-text("Palmera Areca")').click();
    await pos.getByLabel('Más AUR-004').click(); // 2 × 95 + IGV = 224.20
    await page.click('button:has-text("Emitir Comprobante SUNAT")');
    await page.locator('button:has(svg.lucide-x)').first().click();

    await ir(page, 'reportes');
    await expect(page.getByRole('heading', { name: 'Reportes de Ventas' })).toBeVisible();
    const productos = page.getByRole('region', { name: 'Productos más vendidos' });
    await expect(productos.getByText('Palmera Areca Palma de Salón')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Ventas por canal' }).getByText('Directo / Vivero')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Ventas por vendedor' }).getByText('Caja Principal')).toBeVisible();

    await productos.locator('button:has-text("Ver tabla")').click();
    await expect(productos.locator('tr', { hasText: 'Palmera Areca Palma de Salón' })).toContainText('S/ 224.20');

    await page.getByRole('radio', { name: 'Mes anterior' }).click();
    await expect(page.getByRole('region', { name: 'Productos más vendidos' }).getByText('Sin ventas en el periodo.')).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('35. Libro contable: ventas, compras y gastos de caja del periodo con resultado', async ({ page }) => {
    await ir(page, 'finanzas');
    const libro = page.getByRole('region', { name: 'Libro de ingresos y egresos' });
    await expect(libro.getByText('Gasto de caja chica').first()).toBeVisible();
    await expect(libro.getByText('Compra a proveedor').first()).toBeVisible();
    await expect(libro.getByText('Venta de bienes').first()).toBeVisible();
    await expect(page.getByText('Resultado', { exact: true })).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('36. Producto nuevo en un paso: SKU automático, stock inicial al Kardex y "crear otro"', async ({ page }) => {
    await ir(page, 'catalogo');
    await page.getByRole('button', { name: 'Nuevo producto' }).click();
    const m = page.locator('.fixed');
    await expect(m.getByLabel('SKU')).toHaveValue('PLI-001'); // automático por categoría
    await m.getByLabel('Categoría', { exact: true }).selectOption('macetas');
    await expect(m.getByLabel('SKU')).toHaveValue('MAC-002'); // MAC-001 ya existe en el demo
    await m.getByLabel('Nombre del producto').fill('Maceta de barro 20 cm');
    await m.getByLabel('Precio de venta').fill('20');
    await m.getByLabel('Costo unitario').fill('10');
    await expect(m.getByText("50% · gana S/ 10.00 por unidad")).toBeVisible(); // precio sin IGV 20 − costo 10
    await m.getByLabel('Stock inicial').fill('12');
    await m.getByRole('button', { name: 'Guardar y crear otro' }).click();
    await expect(m.getByText('✓ Maceta de barro 20 cm creado con 12 u.')).toBeVisible();
    await expect(m.getByLabel('SKU')).toHaveValue('MAC-003');
    await m.getByRole('button', { name: 'Listo' }).click();
    const card = page.getByRole('article').filter({ hasText: 'Maceta de barro 20 cm' });
    await expect(card.getByText('12 u.')).toBeVisible();
    await ir(page, 'kardex');
    await expect(page.getByText('INV-INICIAL').first()).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('37. Carga masiva desde Excel (CSV) con vista previa y errores por fila', async ({ page }) => {
    await ir(page, 'catalogo');
    await page.getByRole('button', { name: 'Cargar desde Excel' }).click();
    const csv = 'sku;nombre;categoria;precio;costo;stock_inicial\n;Pothos dorado;interior;25;9;30\n;Cactus mini;suculentas;8,50;3;0\nAUR-001;Duplicado;interior;10;5;1\n;Sin precio;interior;;2;0\n';
    await page.getByLabel('Archivo CSV de productos').setInputFiles({ name: 'productos.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await expect(page.getByText('2 listos')).toBeVisible();
    await expect(page.getByText('2 con errores (no se importan)')).toBeVisible();
    await expect(page.getByText('el SKU AUR-001 ya existe')).toBeVisible();
    await page.getByRole('button', { name: 'Crear 2 producto(s)' }).click();
    await expect(page.getByText('✓ 2 producto(s) creados con su stock inicial.')).toBeVisible();
    await page.locator('.fixed button[aria-label="Cerrar"]').click();
    await expect(page.getByRole('article').filter({ hasText: 'Pothos dorado' }).getByText('30 u.')).toBeVisible();
    await expect(page.getByRole('article').filter({ hasText: 'Cactus mini' }).getByText('S/ 8.50')).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('38. Servicios de la tienda: crear con precio "desde" y verlo en la tienda; guía de puesta en marcha', async ({ page }) => {
    await expect(page.getByRole('region', { name: 'Pon en marcha tu negocio' })).toContainText('WhatsApp de ventas');
    await ir(page, 'servicios-tienda');
    await page.getByRole('button', { name: 'Nuevo servicio' }).click();
    await page.getByLabel('Nombre del nuevo servicio').fill('Poda de árboles');
    await page.getByLabel('Precio desde del nuevo servicio').fill('150');
    await page.getByLabel('Resumen del nuevo servicio').fill('Poda de formación y limpieza de árboles.');
    await page.getByRole('button', { name: 'Crear servicio' }).click();
    await expect(page.getByText('desde S/ 150.00')).toBeVisible();
    await page.goto('/tienda/servicios/poda-de-arboles');
    await expect(page.getByRole('heading', { level: 1, name: 'Poda de árboles' })).toBeVisible();
    await expect(page.getByText('Desde S/ 150.00')).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('39. Una factura de compra con varios productos suma stock a cada uno', async ({ page }) => {
    await ir(page, 'catalogo');
    await page.click('button:has-text("Ingreso a almacén")');
    const m = page.locator('.fixed');
    await m.getByLabel('Número de factura').fill('F001-555');
    await m.getByLabel('Producto de la línea 1').selectOption('AUR-001');
    await m.getByLabel('Cantidad de la línea 1').fill('5');
    await m.getByRole('button', { name: '+ Agregar otro producto' }).click();
    await m.getByLabel('Producto de la línea 2').selectOption('MAC-001');
    await m.getByLabel('Cantidad de la línea 2').fill('10');
    await m.getByLabel('Costo unitario de la línea 2').fill('20');
    page.once('dialog', d => d.accept());
    await m.getByRole('button', { name: 'Registrar e Incrementar Stock' }).click();
    await expect(page.getByRole('article').filter({ hasText: 'Monstera Deliciosa' }).getByText('33 u.')).toBeVisible(); // 28 + 5
    await expect(page.getByRole('article').filter({ hasText: 'Maceta Cerámica' }).getByText('34 u.')).toBeVisible(); // 24 + 10
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('40. Conteo físico: plantas con plaga salen como merma y el sobrante como ajuste', async ({ page }) => {
    await ir(page, 'conteo');
    await page.getByLabel('Contado de Monstera Deliciosa').fill('25');
    await page.getByLabel('Motivo de Monstera Deliciosa').selectOption('PLAGA');
    await page.getByLabel('Contado de Sansevieria Laurentii').fill('36');
    page.once('dialog', d => d.accept());
    await page.getByRole('button', { name: 'Aplicar conteo' }).click();
    await expect(page.getByText('✓ Conteo aplicado: 1 baja(s) por merma y 1 ajuste(s) de inventario.')).toBeVisible();
    await ir(page, 'bajas');
    await expect(page.getByText(/plaga o enfermedad/i).first()).toBeVisible();
    await ir(page, 'catalogo');
    await expect(page.getByRole('article').filter({ hasText: 'Monstera Deliciosa' }).getByText('25 u.')).toBeVisible();
    await expect(page.getByRole('article').filter({ hasText: 'Sansevieria' }).getByText('36 u.')).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('41. Pago confirmado a mano con N° de operación; avisos no se activan sin clave', async ({ page }) => {
    await ir(page, 'pedidos');
    const tarjeta = page.getByRole('article', { name: /Pedido PED-2026-000101/ });
    await tarjeta.locator('button:has-text("Cobrar")').click();
    await expect(page.getByRole('heading', { name: /Confirmar pago del pedido/ })).toBeVisible();
    await page.getByLabel('N° de operación 1').fill('00123456');
    await page.locator('.fixed button:has-text("Cobrar y emitir")').click();
    await expect(page.getByText('COMPROBANTE ELECTRÓNICO')).toBeVisible();
    await page.locator('button:has(svg.lucide-x)').first().click();
    await expect(page.getByText(/Yape \(op\. 00123456\)/)).toBeVisible();

    await ir(page, 'configuracion');
    await page.getByLabel('WhatsApp para avisos').fill('+51 987 111 222');
    await page.getByText('Enviarme un aviso por cada pedido web').click();
    await page.getByRole('button', { name: 'Guardar avisos' }).click();
    await expect(page.getByText(/indica tu WhatsApp y la clave \(apikey\) de CallMeBot/)).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('42. Emisión externa: la serie sigue donde se quedó, modelo, número real y envío por WhatsApp', async ({ page }) => {
    // El dueño indica el último número que ya emitió en SUNAT
    await ir(page, 'configuracion');
    await page.getByLabel('Último número de Boleta de venta').fill('500');
    await expect(page.getByText('B001-00000501')).toBeVisible();
    await page.click('button:has-text("Guardar Todos los Cambios")');

    // La venta queda por emitir con el número siguiente
    await page.click('button:has-text("Nueva venta")');
    await page.locator('.fixed button:has-text("Monstera Deliciosa")').click();
    await page.click('button:has-text("Emitir Comprobante SUNAT")');
    await expect(page.getByText('COMPROBANTE ELECTRÓNICO · POR EMITIR EN SUNAT')).toBeVisible();
    await expect(page.getByText('B001-00000501').first()).toBeVisible();
    await page.locator('button:has(svg.lucide-x)').first().click();

    // Se emite en SUNAT (otro número) y se anota; luego se envía al cliente
    await ir(page, 'sunat');
    await expect(page.getByRole('button', { name: 'Por emitir en SUNAT (1)' })).toBeVisible();
    await page.getByLabel('N° emitido en SUNAT de B001-00000501').fill('B001-502');
    await page.getByRole('button', { name: 'Ya lo emití' }).click();
    await page.getByRole('button', { name: /^Todos/ }).click();
    await expect(page.getByText('Emitido · B001-502')).toBeVisible();
    await page.getByLabel('WhatsApp del cliente').first().fill('987 654 321');
    await expect(page.getByRole('link', { name: 'Enviar al cliente por WhatsApp' }).first()).toHaveAttribute('href', /^https:\/\/wa\.me\/51987654321\?text=.*B001-502/);

    // La serie quedó al día: la próxima boleta sugiere el 503
    await ir(page, 'configuracion');
    await expect(page.getByText('B001-00000503')).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('43. Producción propia (doc. 00 · op. 10/19) y Formato 13.1 con costo promedio ponderado', async ({ page }) => {
    await ir(page, 'produccion');
    await page.getByLabel('Producto obtenido').selectOption('AUR-002');
    await page.getByLabel('Cantidad producida').fill('4');
    await page.getByRole('button', { name: 'Agregar insumo' }).click();
    await page.getByLabel('Insumo 1', { exact: true }).selectOption('SUB-001');
    await page.getByLabel('Cantidad del insumo 1').fill('2');
    await page.getByLabel('Costo adicional').fill('10');
    await expect(page.getByLabel('Costo unitario estimado')).toHaveText('S/ 8.00'); // (2 × 11 + 10) / 4
    await page.getByRole('button', { name: 'Registrar producción' }).click();
    await expect(page.getByText('✓ Parte de producción N° 00000001: entraron 4 u. de Sansevieria Laurentii a S/ 8.00 c/u.')).toBeVisible();

    await ir(page, 'kardex');
    const libro = page.getByRole('region', { name: 'Formato 13.1' });
    await libro.getByLabel('Existencia del libro').selectOption('AUR-002');
    await libro.getByRole('button', { name: 'Generar' }).click();
    const fila = libro.locator('tr', { hasText: '19' }).last();
    await expect(fila).toContainText('00000001');
    await expect(fila).toContainText('16.9744'); // (35 × 18 + 4 × 8) / 39
    const insumo = page.locator('table').nth(1).locator('tr', { hasText: 'Salida a Produccion' });
    await expect(insumo).toContainText('00 · 10');
    await expect(insumo).toContainText('11.0000');
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('44. PCGE 2026: la producción propia genera 61 a 24 (insumo) y 21 a 711 (cosecha), y todo cuadra', async ({ page }) => {
    await ir(page, 'produccion');
    await page.getByLabel('Producto obtenido').selectOption('AUR-002');
    await page.getByLabel('Cantidad producida').fill('30');
    await page.getByRole('button', { name: 'Agregar insumo' }).click();
    await page.getByLabel('Insumo 1', { exact: true }).selectOption('SUB-001');
    await page.getByLabel('Cantidad del insumo 1').fill('3');
    await page.getByLabel('Costo adicional').fill('27');
    await page.getByRole('button', { name: 'Registrar producción' }).click();
    await expect(page.getByText(/Parte de producción N° 00000001/)).toBeVisible();

    await ir(page, 'libro-diario');
    const consumo = page.getByRole('listitem').filter({ hasText: 'Consumo de Sustrato Premium Orgánico 10L en producción' });
    await expect(consumo.locator('tr').nth(0)).toContainText('6121');
    await expect(consumo.locator('tr').nth(0)).toContainText('33.00'); // 3 × S/ 11 (costo promedio)
    await expect(consumo.locator('tr').nth(1)).toContainText('24111');
    const cosecha = page.getByRole('listitem').filter({ hasText: 'Producción propia de Sansevieria Laurentii' });
    await expect(cosecha.locator('tr').nth(0)).toContainText('21111');
    await expect(cosecha.locator('tr').nth(0)).toContainText('60.00'); // 33 insumos + 27 adicional
    await expect(cosecha.locator('tr').nth(1)).toContainText('7111');
    await expect(page.getByText('Todo cuadra')).toBeVisible();

    await page.getByRole('tab', { name: 'Libro mayor' }).click();
    await expect(page.getByRole('table', { name: 'Mayor del elemento 7' })).toContainText('7111');

    await page.getByRole('tab', { name: 'Plan de cuentas' }).click();
    await page.getByLabel('Buscar cuenta').fill('2111');
    await expect(page.getByText('1628 cuentas · PCGE 2026')).toBeVisible();
    await expect(page.locator('li', { hasText: '21111' })).toContainText('Costo');
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('45. Gasto con factura (luz): 6361 + 40111 a 4212 y pago 4212 a 1041; vale de caja chica 63112 a 101', async ({ page }) => {
    await ir(page, 'finanzas');
    await page.getByRole('button', { name: 'Registrar gasto' }).click();
    await page.getByLabel('Descripción del gasto').fill('Recibo de luz setiembre');
    await page.getByLabel('RUC del proveedor del gasto').fill('20100070970');
    await page.getByLabel('Nombre del proveedor del gasto').fill('Electro Sur');
    await page.getByLabel('Total del gasto').fill('118');
    await expect(page.getByLabel('IGV del gasto')).toHaveValue('18.00');
    await page.getByLabel('N° de operación del pago del gasto').fill('778899');
    await page.locator('.fixed').getByRole('button', { name: 'Registrar gasto' }).click();
    const libro = page.getByRole('region', { name: 'Libro de ingresos y egresos' });
    await expect(libro.getByText('Gasto: Luz (energía eléctrica)')).toBeVisible();

    await ir(page, 'caja');
    await page.click('button:has-text("Registrar Gasto")');
    await page.getByPlaceholder('Ej: Pasajes chofer, compra de bolsas...').fill('Pasajes al mercado');
    await page.getByLabel('Categoría del vale').selectOption('63112');
    page.once('dialog', d => d.accept());
    await page.click('button:has-text("Registrar Egreso")');

    await ir(page, 'libro-diario');
    const luz = page.getByRole('listitem').filter({ hasText: 'Recibo de luz setiembre · Electro Sur' });
    await expect(luz.locator('tr').nth(0)).toContainText('6361');
    await expect(luz.locator('tr').nth(0)).toContainText('100.00');
    await expect(luz.locator('tr').nth(1)).toContainText('40111');
    await expect(luz.locator('tr').nth(2)).toContainText('4212');
    const pago = page.getByRole('listitem').filter({ hasText: 'Pago de Recibo de luz setiembre' });
    await expect(pago.locator('tr').nth(1)).toContainText('1041');
    const vale = page.getByRole('listitem').filter({ hasText: 'Caja chica: Pasajes al mercado' });
    await expect(vale.locator('tr').nth(0)).toContainText('63112');
    await expect(vale.locator('tr').nth(1)).toContainText('101');
    await expect(page.getByText('Todo cuadra')).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('46. Recibo de luz (tipo 14) por pagar se paga después; planilla del mes se contabiliza una vez', async ({ page }) => {
    await ir(page, 'finanzas');
    await page.getByRole('button', { name: 'Registrar gasto' }).click();
    await page.getByLabel('Tipo de comprobante del gasto').selectOption('14');
    await page.getByLabel('Descripción del gasto').fill('Luz agosto');
    await page.getByLabel('Serie del comprobante del gasto').fill('S001');
    await page.getByLabel('Número del comprobante del gasto').fill('123');
    await page.getByLabel('RUC del proveedor del gasto').fill('20100070970');
    await page.getByLabel('Total del gasto').fill('59');
    await page.getByText('Aún por pagar').click();
    await page.locator('.fixed').getByRole('button', { name: 'Registrar gasto' }).click();
    const cxp = page.getByRole('region', { name: 'Cuentas por pagar' });
    await expect(cxp.getByText('Luz agosto')).toBeVisible();
    await cxp.getByLabel('N° de operación de Luz agosto').fill('445566');
    await cxp.getByRole('button', { name: 'Pagar' }).click();
    await expect(page.getByRole('region', { name: 'Cuentas por pagar' })).toHaveCount(0);

    await ir(page, 'planilla');
    await page.getByRole('button', { name: 'Contabilizar planilla del mes' }).click();
    await expect(page.getByText(/Planilla de .* contabilizada en el libro diario/)).toBeVisible();
    await page.getByRole('button', { name: 'Contabilizar planilla del mes' }).click();
    await expect(page.getByText(/ya está contabilizada/)).toBeVisible();

    await ir(page, 'libro-diario');
    await expect(page.getByRole('listitem').filter({ hasText: 'Luz agosto' }).first().locator('tr').nth(1)).toContainText('40111');
    await expect(page.getByRole('listitem').filter({ hasText: 'Pago de Luz agosto' }).locator('tr').nth(1)).toContainText('1041');
    const planilla = page.getByRole('listitem').filter({ hasText: 'Planilla de remuneraciones' });
    await expect(planilla).toContainText('6211');
    await expect(planilla).toContainText('4111');
    await expect(page.getByText('Todo cuadra')).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('47. SIRE RVIE (Anexo 3) y PLE 5.1 / 13.1: nombres oficiales y número de campos', async ({ page }) => {
    const leer = async (d: import('@playwright/test').Download) => fs.readFileSync((await d.path())!).toString('latin1');
    await ir(page, 'contabilidad');
    page.once('dialog', dl => dl.accept());
    const [rvie] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Exportar RVIE (SIRE)")')]);
    expect(rvie.suggestedFilename()).toMatch(/^LE20609876541\d{6}00140400021[01]12\.zip$/);
    const zipTexto = await leer(rvie);
    const fila = zipTexto.split(/\r\n/).find(l => l.includes('|AUREVIA BOTANICAL S.A.C.|'))!;
    expect(fila).toMatch(/20609876541\|AUREVIA BOTANICAL S\.A\.C\.\|\d{6}\|\|\d{2}\/\d{2}\/\d{4}\|/); // RUC|razón social|periodo|CAR vacío|fecha
    expect(fila.slice(fila.indexOf('20609876541|')).split('|').length - 1).toBe(33); // 33 campos, cada uno cierra con "|"

    await ir(page, 'kardex');
    const libro = page.getByRole('region', { name: 'Formato 13.1' });
    await libro.getByLabel('Existencia del libro').selectOption('AUR-001');
    await libro.getByRole('button', { name: 'Generar' }).click();
    const [ple131] = await Promise.all([page.waitForEvent('download'), libro.getByRole('button', { name: 'PLE 13.1' }).click()]);
    expect(ple131.suggestedFilename()).toMatch(/^LE20609876541\d{6}00130100001[01]11\.txt$/);
    const lineas131 = (await leer(ple131)).trim().split(/\r\n/);
    expect(lineas131[0].split('|').length - 1).toBe(27);
    expect(lineas131[0].split('|')[13]).toBe('16'); // la primera tupla es el saldo inicial

    await ir(page, 'libro-diario');
    const [diario] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PLE 5.1 + 5.3' }).click()]);
    const contenido = await leer(diario);
    expect(contenido).toMatch(/LE20609876541\d{6}00050100001[01]11\.txt/);
    expect(contenido).toMatch(/LE20609876541\d{6}00050300001[01]11\.txt/);
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('48. Jardinero con recibo por honorarios: comisión + IGV, factura al cliente, RxH con retención de 4ta y pago', async ({ page }) => {
    page.on('dialog', d => void d.accept());
    await ir(page, 'configuracion');
    await page.getByLabel('Comisión a jardineros (%)').fill('20');
    await page.getByRole('button', { name: 'Guardar Todos los Cambios de la Empresa' }).click();

    await ir(page, 'honorarios');
    const jard = page.getByRole('region', { name: 'Jardineros' });
    await jard.getByLabel('Nombre del jardinero').fill('Juan Pérez Huamán');
    await jard.getByLabel('RUC del jardinero').fill('10456789019');
    await jard.getByRole('button', { name: 'Agregar jardinero' }).click();
    await expect(jard.getByText('Juan Pérez Huamán')).toBeVisible();

    // 1) El jardinero cobra con RxH al cliente; AUREVIA le cobra 20% + IGV
    const nuevo = page.getByRole('region', { name: 'Registrar servicio' });
    await nuevo.getByLabel('Descripción del servicio').fill('Poda de ficus');
    await nuevo.getByLabel('Cliente del servicio', { exact: true }).fill('Ana Salas');
    await nuevo.getByLabel('Precio del servicio sin IGV').fill('150');
    await expect(nuevo.getByLabel('Resumen del servicio')).toContainText('S/ 35.40'); // 30 + IGV
    await nuevo.getByRole('button', { name: 'Registrar servicio' }).click();
    const lista = page.getByRole('region', { name: 'Servicios de jardineros' });
    const poda = lista.getByRole('listitem').filter({ hasText: 'Poda de ficus' });
    await poda.getByLabel('Medio de pago del servicio Poda de ficus').selectOption('Efectivo');
    await poda.getByRole('button', { name: 'Cobrar comisión' }).click();
    await expect(page.getByText(/Comisión 20% por servicio de jardinería/)).toBeVisible();
    await page.locator('button:has(svg.lucide-x)').first().click();
    await expect(poda.getByText(/Comisión cobrada F001-/)).toBeVisible(); // el jardinero tiene RUC → factura
    await poda.getByLabel('Número del RxH de Poda de ficus').fill('31');
    await poda.getByRole('button', { name: 'Registrar RxH' }).click();
    await expect(poda.getByText('RxH E001-31')).toBeVisible();

    // 2) El cliente pide factura: AUREVIA factura con IGV y el jardinero le emite su RxH (retención 8% > S/ 1 500)
    await nuevo.getByLabel('Descripción del servicio').fill('Diseño de jardín corporativo');
    await nuevo.getByLabel('Cliente del servicio', { exact: true }).fill('Empresa Agrícola SAC');
    await nuevo.getByText('Cliente pide factura').click();
    await nuevo.getByLabel('Documento del cliente del servicio').fill('20100070970');
    await nuevo.getByLabel('Precio del servicio sin IGV').fill('2000');
    await expect(nuevo.getByLabel('Resumen del servicio')).toContainText('S/ 2,360.00');
    await expect(nuevo.getByLabel('Resumen del servicio')).toContainText('S/ 1,472.00');
    await nuevo.getByRole('button', { name: 'Registrar servicio' }).click();
    const diseno = lista.getByRole('listitem').filter({ hasText: 'Diseño de jardín corporativo' });
    await diseno.getByLabel('N° de operación del servicio Diseño de jardín corporativo').fill('778899');
    await diseno.getByRole('button', { name: 'Emitir factura' }).click();
    await expect(page.getByText('FACTURA ELECTRÓNICA')).toBeVisible();
    await page.locator('button:has(svg.lucide-x)').first().click();
    await diseno.getByLabel('Número del RxH de Diseño de jardín corporativo').fill('32');
    await diseno.getByRole('button', { name: 'Registrar RxH' }).click();
    await expect(diseno.getByText('Pagar al jardinero: S/ 1,472.00')).toBeVisible();
    await diseno.getByLabel('N° de operación del servicio Diseño de jardín corporativo').fill('990011');
    await diseno.getByRole('button', { name: 'Pagar' }).click();
    await expect(diseno.getByText(/Pagado S\/ 1,472.00/)).toBeVisible();

    await ir(page, 'libro-diario');
    const rxh = page.getByRole('listitem').filter({ hasText: 'Honorarios: Diseño de jardín corporativo' }).first();
    await expect(rxh).toContainText('633');
    await expect(rxh).toContainText('40172');
    await expect(rxh).toContainText('424');
    await expect(page.getByText('Todo cuadra')).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('34. A las 8:30 p. m. en Lima el comprobante sale con la fecha de hoy (no la de UTC)', async ({ browser }) => {
    const ctx = await browser.newContext({ timezoneId: 'America/Lima', baseURL: 'http://localhost:5199' });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date('2026-09-26T01:30:00Z') }); // 25/09 20:30 en Lima
    await page.goto('/');
    await page.click('button:has-text("Nueva venta")');
    await page.locator('.fixed button:has-text("Monstera Deliciosa")').click();
    await page.click('button:has-text("Emitir Comprobante SUNAT")');
    await expect(page.getByText('COMPROBANTE ELECTRÓNICO')).toBeVisible();
    await page.locator('button:has(svg.lucide-x)').first().click();
    await ir(page, 'sunat');
    await expect(page.getByText(/2026-09-25 20:30/)).toBeVisible();
    await ctx.close();
  });
});

test.describe('Tienda pública AUREVIA (/tienda)', () => {
  let errores: string[] = [];
  test.beforeEach(async ({ page }) => {
    errores = [];
    page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
    page.on('pageerror', e => errores.push(e.message));
  });

  test('T1. El cliente navega sin iniciar sesión, ve el stock real y no ve datos internos', async ({ page }) => {
    await page.goto('/tienda');
    await expect(page.getByRole('heading', { level: 1, name: /Cotiza tus plantas/ })).toBeVisible();
    await expect(page).toHaveTitle(/AUREVIA/);
    await expect(page.getByRole('link', { name: /Acceso del equipo/ })).toHaveCount(0); // el enlace del equipo no aparece
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Plantas' }).click();
    await expect(page).toHaveURL(/\/tienda\/plantas$/);
    await page.getByPlaceholder('Buscar por nombre…').fill('monstera');
    await expect(page).toHaveURL(/q=monstera/);
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByRole('article').getByText('28 disponibles')).toBeVisible();
    const texto = await page.locator('body').innerText();
    expect(texto).not.toMatch(/Costo|Kardex|RUC|Ubicación/);
    expect(errores).toHaveLength(0);
  });

  test('T2. Enlace directo a un producto: precio, stock, cuidados y metadatos', async ({ page }) => {
    await page.goto('/tienda/producto/AUR-001');
    await expect(page.getByRole('heading', { level: 1, name: 'Monstera Deliciosa' })).toBeVisible();
    await expect(page.getByText('S/ 85.00').first()).toBeVisible();
    await expect(page.getByRole('main').getByText('28 disponibles')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Cuidados' })).toContainText('Riego semanal moderado');
    await expect(page).toHaveTitle('Monstera Deliciosa | AUREVIA');
    await page.goto('/tienda/producto/NO-EXISTE');
    await expect(page.getByText('Este producto ya no está en el catálogo')).toBeVisible();
    await page.goto('/tienda/una-ruta-inexistente');
    await expect(page.getByText('No encontramos esta página')).toBeVisible();
    expect(errores).toHaveLength(0);
  });

  test('T3. Pedir más que el stock avisa que lo atiende un asesor', async ({ page }) => {
    await page.goto('/tienda/producto/AUR-001');
    await page.getByRole('spinbutton', { name: 'Cantidad de Monstera Deliciosa' }).fill('40');
    await expect(page.getByText('Tenemos 28 disponibles. 12 u. adicional(es) se atienden como pedido con un asesor de ventas.')).toBeVisible();
    await page.getByRole('button', { name: /Agregar a mi cotización/ }).click();
    await expect(page.getByRole('dialog', { name: 'Mi cotización' })).toBeVisible();
    await expect(page.getByRole('dialog').getByText(/Tenemos 28 disponibles/)).toBeVisible();
    expect(errores).toHaveLength(0);
  });

  test('T4. Flujo completo: cotización → datos y factura → confirmar → pedido web → pedido → por emitir', async ({ page }) => {
    await page.goto('/tienda/producto/AUR-003');
    await page.getByRole('button', { name: 'Más' }).click();
    await page.getByRole('button', { name: /Agregar a mi cotización/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar pedido' }).click();
    await expect(page).toHaveURL(/\/tienda\/cotizar$/);
    await expect(page.getByText('S/ 240.00').first()).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Paso 2: validaciones de comprobante
    await page.getByLabel('Nombre *').fill('Ana Flores');
    await page.getByLabel('WhatsApp *').fill('+51 955 444 333');
    await page.getByRole('button', { name: /Factura/ }).click();
    await page.getByLabel('RUC *').fill('123');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('alert')).toHaveText('Para factura indica un RUC válido de 11 dígitos.');
    await page.getByLabel('RUC *').fill('20100070970');
    await page.getByLabel('Razón social *').fill('Jardines Ica SAC');
    await page.getByRole('button', { name: /Delivery/ }).click();
    await page.getByLabel('Dirección *').fill('Calle Lima 123');
    await page.getByLabel('Distrito').fill('Ica');
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Paso 3: confirmar
    await expect(page.getByRole('heading', { name: 'Confirma tu pedido' })).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();
    await expect(page.getByText('¡Pedido registrado!')).toBeVisible();
    await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0); // sin WhatsApp configurado no hay enlace falso

    // Panel: llega como pedido web con factura y se convierte en pedido por emitir
    await page.goto('/#solicitudes');
    const sol = page.getByRole('article').filter({ hasText: 'Ana Flores' });
    await expect(sol.getByText('RUC 20100070970')).toBeVisible();
    await expect(sol.getByText('Factura', { exact: true })).toBeVisible();
    await sol.getByRole('button', { name: 'Crear pedido' }).click();
    await expect(page.locator('.fixed').getByLabel('Dirección de entrega')).toHaveValue('Calle Lima 123');
    await page.locator('.fixed').getByRole('button', { name: 'Crear pedido' }).click();
    await expect(page).toHaveURL(/#pedidos$/);
    await expect(page.getByRole('region', { name: 'Columna Por cobrar' }).getByText('Jardines Ica SAC')).toBeVisible();

    await ir(page, 'finanzas');
    const fila = page.getByRole('region', { name: 'Por emitir' }).getByRole('listitem').filter({ hasText: 'Jardines Ica SAC' });
    await expect(fila.getByText('Factura')).toBeVisible();
    await fila.getByRole('button', { name: 'Cobrar y emitir' }).click();
    await expect(page.getByLabel('Tipo de comprobante')).toHaveValue('01'); // el cobro parte de la factura que pidió el cliente
    expect(errores).toHaveLength(0);
  });

  test('T5. Servicio con enlace propio: cotización en pasos', async ({ page }) => {
    await page.goto('/tienda/servicios');
    await page.getByRole('link', { name: /Jardín Vertical/ }).click();
    await expect(page).toHaveURL(/\/tienda\/servicios\/jardin-vertical$/);
    await page.getByRole('link', { name: 'Cotizar este servicio' }).click();
    await page.getByLabel('¿Qué necesitas? *').fill('Muro de 3 x 2 m en recepción');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('Nombre *').fill('Hotel Paracas');
    await page.getByLabel('WhatsApp *').fill('956111222');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Confirmar solicitud' }).click();
    await expect(page.getByText('¡Solicitud registrada!')).toBeVisible();

    await page.goto('/tienda/contacto');
    await page.getByLabel('Nombre *').fill('X Y');
    await page.getByLabel('Teléfono o WhatsApp *').fill('12');
    await page.getByRole('button', { name: 'Enviar consulta' }).click();
    await expect(page.getByRole('alert')).toHaveText('Indica un teléfono o WhatsApp válido.');
    expect(errores).toHaveLength(0);
  });

  test('T6. Con WhatsApp configurado, el pedido confirmado se envía por WhatsApp con su número', async ({ page }) => {
    await page.goto('/#configuracion');
    await page.getByLabel('WhatsApp de la tienda').fill('+51 987 111 222');
    await page.getByRole('button', { name: 'Guardar datos de la tienda' }).click();
    await expect(page.getByText('Guardado ✓')).toBeVisible();
    await page.goto('/tienda/producto/AUR-001');
    await page.getByRole('button', { name: /Agregar a mi cotización/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar pedido' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('Nombre *').fill('Luis Pérez');
    await page.getByLabel('WhatsApp *').fill('987000111');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();
    const wa = page.getByRole('link', { name: 'Enviar pedido por WhatsApp' });
    await expect(wa).toHaveAttribute('href', /^https:\/\/wa\.me\/51987111222\?text=/);
    expect(decodeURIComponent((await wa.getAttribute('href'))!)).toMatch(/Pedido AUREVIA N° WEB-.*Comprobante: Boleta.*1 × Monstera Deliciosa/s);
    expect(errores).toHaveLength(0);
  });

  test('T7. En el celular la tienda y el panel tienen menú desplegable; /panel sigue funcionando', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: 'http://localhost:5199' });
    const page = await ctx.newPage();
    await page.goto('/tienda');
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    await page.getByRole('navigation', { name: 'Principal (móvil)' }).getByRole('link', { name: 'Servicios' }).click();
    await expect(page).toHaveURL(/\/tienda\/servicios$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.goto('/panel#pedidos'); // enlace antiguo: redirige al centro de control
    await expect(page).toHaveURL(/localhost:5199\/#pedidos$/);
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    await page.getByRole('button', { name: 'Contabilidad' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Ingresos, egresos y por emitir' })).toBeVisible();
    await ctx.close();
  });
  test('T9. Precios sin IGV: la tienda lo recuerda y el servicio se pide con recibo por honorarios', async ({ page }) => {
    await page.goto('/tienda/producto/AUR-002');
    await expect(page.getByText(/Precio unitario sin IGV/)).toBeVisible();
    await page.getByRole('button', { name: /Agregar a mi cotización/ }).click();
    const panel = page.getByRole('dialog');
    await expect(panel.getByText(/no incluyen IGV/)).toBeVisible();
    await expect(panel.getByText('S/ 56.64')).toBeVisible(); // 48 + 18%
    await panel.getByRole('button', { name: 'Confirmar pedido' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('Nombre *').fill('Carlos Ramos');
    await page.getByLabel('WhatsApp *').fill('956111222');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('row', { name: /IGV \(18%\)/ })).toContainText('S/ 8.64');

    await page.goto('/tienda/servicios/mantenimiento-residencial');
    await expect(page.getByText(/recibo por honorarios/).first()).toBeVisible();
    await page.getByRole('link', { name: /Cotizar/ }).first().click();
    await page.getByPlaceholder(/jardín de 30 m²/).fill('Mantenimiento mensual de 40 m² de jardín');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('button', { name: /Recibo por honorarios/ })).toBeVisible();
    await page.getByLabel('Nombre *').fill('Carlos Ramos');
    await page.getByLabel('WhatsApp *').fill('956111223');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Recibo por honorarios', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar solicitud' }).click();
    await expect(page.getByText(/registrad/).first()).toBeVisible();
    expect(errores).toHaveLength(0);
  });

  test('T8. Delivery por distrito: el cliente ve la tarifa y el pedido llega con ese costo', async ({ page }) => {
    await page.goto('/#configuracion');
    await page.getByLabel('Distrito nuevo', { exact: true }).fill('Parcona');
    await page.getByLabel('Costo del distrito nuevo').fill('12');
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();
    await expect(page.getByLabel('Costo de delivery a Parcona')).toHaveValue('12');

    await page.goto('/tienda/producto/AUR-002');
    await page.getByRole('button', { name: /Agregar a mi cotización/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar pedido' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('Nombre *').fill('Rosa Quispe');
    await page.getByLabel('WhatsApp *').fill('956333444');
    await page.getByRole('button', { name: /Delivery/ }).click();
    await page.getByLabel('Dirección *').fill('Jr. Grau 456');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('alert')).toHaveText('Elige tu distrito para calcular el delivery.');
    await page.getByLabel('Distrito *').selectOption('Parcona');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('S/ 68.64').last()).toBeVisible(); // 48 + 8.64 de IGV + 12 de delivery
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();
    await expect(page.getByText('¡Pedido registrado!')).toBeVisible();

    await page.goto('/#solicitudes');
    const sol = page.getByRole('article').filter({ hasText: 'Rosa Quispe' });
    await expect(sol.getByText(/Parcona · S\/ 12\.00/)).toBeVisible();
    await sol.getByRole('button', { name: 'Crear pedido' }).click();
    await expect(page.locator('.fixed').getByLabel('Costo de delivery')).toHaveValue('12');
    expect(errores).toHaveLength(0);
  });
});
