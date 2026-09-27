/** Reduce una foto a JPEG (máx. 1200 px de lado) para que cargue rápido en la tienda y en el celular. */
export async function fotoComoJpeg(archivo: File, lado = 1200, calidad = 0.82): Promise<{ blob: Blob; dataUrl: string }> {
  if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) throw new Error('La foto debe ser JPG, PNG o WEBP.');
  if (archivo.size > 15 * 1024 * 1024) throw new Error('La foto pesa más de 15 MB.');
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falla) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falla(new Error('No se pudo leer la foto.'));
      i.src = url;
    });
    const escala = Math.min(1, lado / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('El navegador no permite procesar la foto.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', calidad);
    const blob = await (await fetch(dataUrl)).blob();
    return { blob, dataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}
