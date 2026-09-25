import { test, expect } from '@playwright/test';

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
    await expect(page.getByRole('button', { name: 'Inicio Aurevia 360°' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Panel de Control General & Finanzas' })).toBeVisible();
    // Hubs organizados por flujo de negocio
    for (const hub of ['Vender', 'Servicios', 'Inventario', 'Administración']) {
      await expect(page.getByRole('heading', { name: hub, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Pendientes de Hoy' })).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('2. Navigation across all business areas via Sidebar & Top Switcher', async ({ page }) => {
    // 1. Tienda & Catalogo
    await page.click('button:has-text("Tienda & Catálogo POS")');
    await expect(page.getByRole('heading', { name: 'Monstera Deliciosa' })).toBeVisible();

    // 2. Jardines & Paisajismo
    await page.click('button:has-text("Jardines & Paisajismo VIP")');
    await expect(page.getByText('Servicios de Jardinería, Paisajismo & Mantenimiento')).toBeVisible();

    // 3. Kardex & Almacen
    await page.click('button:has-text("Kardex & Almacén Físico")');
    await expect(page.getByText('Control Físico de Kardex & Almacén')).toBeVisible();

    // 4. Guías de Remisión
    await page.click('button:has-text("Guías de Remisión GRE")');
    await expect(page.getByRole('heading', { name: 'Guías de Remisión Electrónica (GRE Remitente T001)' })).toBeVisible();

    // 5. Facturación SUNAT
    await page.click('button:has-text("Facturación SUNAT SEE")');
    await expect(page.getByRole('heading', { name: 'Comprobantes de Pago Electrónicos' })).toBeVisible();

    // 6. Contabilidad & SIRE
    await page.click('button:has-text("Contabilidad & SIRE")');
    await expect(page.getByText('Configuración del Régimen Tributario SUNAT')).toBeVisible();

    // 7. Planilla & Provisiones
    await page.click('button:has-text("Planilla & Provisiones")');
    await expect(page.getByRole('heading', { name: 'Gestión de Nómina, AFP y Seguro Social' })).toBeVisible();

    // 8. Ajustes Empresa
    await page.click('button:has-text("Ajustes & RUC Empresa")');
    await expect(page.getByRole('heading', { name: 'Datos Fiscales, SUNAT SOL & Cuentas Bancarias' })).toBeVisible();

    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('3. Botanical QR & Barcode Tag Modal generates and previews labels', async ({ page }) => {
    await page.click('button:has-text("Tienda & Catálogo POS")');
    await page.waitForTimeout(300);

    const qrBtn = page.locator('button:has-text("QR Tag")').first();
    await qrBtn.click();

    await expect(page.getByRole('heading', { name: 'Generador de Etiquetas & QR Botánico' })).toBeVisible();
    await expect(page.getByText('AUR-001').first()).toBeVisible();

    await page.selectOption('select >> nth=1', '70x40');
    await page.selectOption('select >> nth=1', 'A4_SHEET');

    await page.click('button:has-text("Simular Escaneo en Caja")');
    await expect(page.getByText('Emitir Venta & CPE SUNAT (POS)')).toBeVisible();

    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('4. POS Quick Barcode Scanner & SUNAT Electronic Invoicing Flow', async ({ page }) => {
    await page.click('button:has-text("Nueva Venta (POS & CPE)")');
    await expect(page.getByText('Emitir Venta & CPE SUNAT (POS)')).toBeVisible();

    await page.selectOption('select >> nth=1', '03');
    await page.click('button:has-text("Emitir Comprobante SUNAT")');

    await expect(page.getByText('COMPROBANTE ELECTRÓNICO')).toBeVisible();
    await expect(page.getByText('RUC: 20609876541')).toBeVisible();

    await page.locator('button:has(svg.lucide-x)').first().click();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('5. Inventory & Warehouse Purchases (Kardex + SIRE RCE)', async ({ page }) => {
    await page.click('button:has-text("Ingreso Almacén (+)")');
    await expect(page.getByText('Registrar Compra Mayorista (Almacén)')).toBeVisible();

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Ingreso registrado con éxito');
      await dialog.accept();
    });

    await page.click('button:has-text("Registrar e Incrementar Stock")');
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('6. Guía de Remisión Electrónica (GRE Remitente)', async ({ page }) => {
    await page.click('button:has-text("Guías de Remisión GRE")');
    await expect(page.getByRole('heading', { name: 'Guías de Remisión Electrónica (GRE Remitente T001)' })).toBeVisible();
    await expect(page.getByText('T001-00000014')).toBeVisible();
    await expect(page.getByText('Valeria Benavides (DNI 47891234)')).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('7. Accounting, SIRE Electronic Books & AFPnet Export', async ({ page }) => {
    await page.click('button:has-text("Contabilidad & SIRE")');
    await expect(page.getByText('Configuración del Régimen Tributario SUNAT')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exportar RVIE (SIRE)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exportar RCE (SIRE)' })).toBeVisible();

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('RVIE');
      await dialog.accept();
    });
    await page.click('button:has-text("Exportar RVIE (SIRE)")');

    await page.click('button:has-text("Planilla & Provisiones")');
    await expect(page.getByRole('heading', { name: 'Gestión de Nómina, AFP y Seguro Social' })).toBeVisible();

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('PLAPROTE.TXT');
      await dialog.accept();
    });
    await page.click('button:has-text("Exportar a AFPnet (PLAPROTE.TXT)")');

    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('8. Company Settings & SUNAT Configuration Save', async ({ page }) => {
    await page.click('button:has-text("Ajustes & RUC Empresa")');
    
    const rucInput = page.locator('input[value="20609876541"]');
    await expect(rucInput).toBeVisible();
    await expect(page.getByText('CDT_AUREVIA_2026_2029.pfx')).toBeVisible();

    await page.click('button:has-text("Guardar Todos los Cambios")');
    await expect(page.getByText('¡Datos de la empresa, RUC y credenciales SUNAT/AFPnet actualizados con éxito!')).toBeVisible();

    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('9. Control de Caja Chica & Arqueo Diario', async ({ page }) => {
    await page.click('button:has-text("Caja:")');
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
    await page.click('button:has-text("Detracciones SPOT (BN)")');
    await expect(page.getByText('Sistema de Detracciones SPOT (SUNAT & Banco de la Nación)')).toBeVisible();
    await expect(page.getByText('F001-00000088')).toBeVisible();
    await expect(page.getByText('Boutique Hotel Miraflores SAC')).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('11. CRM Botánico & Alertas Estacionales', async ({ page }) => {
    await page.click('button:has-text("CRM Botánico & Alertas")');
    await expect(page.getByText('CRM Botánico & Fidelización de Clientes')).toBeVisible();
    await expect(page.getByText('Valeria Benavides')).toBeVisible();
    await expect(page.getByText('Enviar WhatsApp Botánico').first()).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('12. Módulo de Bajas Biológicas & Cuarentena', async ({ page }) => {
    await page.click('button:has-text("Bajas & Cuarentena")');
    await expect(page.getByText('Módulo de Bajas Biológicas & Cuarentena')).toBeVisible();
    await expect(page.getByText('Monstera Deliciosa')).toBeVisible();
    await expect(page.getByText('DESMEDRO PLAGA')).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('13. Detracción SPOT servicios al 12% (Anexo 3 cód. 037)', async ({ page }) => {
    await page.click('button:has-text("Detracciones SPOT (BN)")');
    await expect(page.getByText('Sistema de Detracciones SPOT (SUNAT & Banco de la Nación)')).toBeVisible();
    // La tasa vigente para "demás servicios gravados con IGV" es 12%, no 10%
    await expect(page.getByText(/Detracción \(12%\)/).first()).toBeVisible();
    await expect(page.getByText('S/ 696.00').first()).toBeVisible(); // 5 800 * 12%
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('14. Planilla régimen-aware: microempresa usa SIS y sin CTS/gratificaciones', async ({ page }) => {
    await page.click('button:has-text("Planilla & Provisiones")');
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
    await page.click('button:has-text("Contabilidad & SIRE")');
    await page.click('button:has-text("Nuevo RUS (NRUS)")');
    await expect(page.getByText(/Cuota fija NRUS categoría/)).toBeVisible();
    await expect(page.getByText(/Sin IGV en NRUS/)).toBeVisible();
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('16. Botón "Consultar RUC" ejecuta la validación módulo 11 (offline)', async ({ page }) => {
    await page.click('button:has-text("Ajustes & RUC Empresa")');
    await expect(page.getByRole('heading', { name: 'Datos Fiscales, SUNAT SOL & Cuentas Bancarias' })).toBeVisible();

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
    await page.click('button:has-text("Nueva Venta (POS & CPE)")');
    await page.click('button:has-text("Emitir Comprobante SUNAT")');
    await expect(page.getByText('COMPROBANTE ELECTRÓNICO')).toBeVisible();
    await page.locator('button:has(svg.lucide-x)').first().click();

    await page.click('button:has-text("Kardex & Almacén Físico")');
    const fila = page.locator('tr', { hasText: 'Venta Cliente' }).first();
    await expect(fila).toContainText('AUR-001');
    await expect(fila).toContainText('27'); // 28 iniciales - 1 vendida
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('18. Proyecto de jardinería: se factura una sola vez y genera detracción', async ({ page }) => {
    await page.click('button:has-text("Jardines & Paisajismo VIP")');
    const proyecto = page.locator('div.rounded-3xl', { hasText: 'JAR-2026-002' }).last();
    await proyecto.locator('button:has-text("Facturar con SPOT")').click();
    await expect(page.getByText('FACTURA ELECTRÓNICA')).toBeVisible();
    await page.locator('button:has(svg.lucide-x)').first().click();

    await expect(proyecto.getByText(/Facturado: F001-/)).toBeVisible();
    await expect(proyecto.locator('button:has-text("Facturar con SPOT")')).toHaveCount(0);

    await page.click('button:has-text("Detracciones SPOT (BN)")');
    await expect(page.getByText('Pendiente de Pago')).toHaveCount(2); // la inicial + la nueva
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('19. Los datos persisten al recargar y la pestaña queda en la URL', async ({ page }) => {
    await page.click('button:has-text("Ingreso Almacén (+)")');
    page.once('dialog', dialog => dialog.accept());
    await page.click('button:has-text("Registrar e Incrementar Stock")');

    await page.click('button:has-text("Kardex & Almacén Físico")');
    await expect(page).toHaveURL(/#kardex$/);
    await page.reload();
    await expect(page.getByText('Control Físico de Kardex & Almacén')).toBeVisible();
    await expect(page.locator('tr', { hasText: 'FC01-0009981' })).toHaveCount(1);
    expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});
