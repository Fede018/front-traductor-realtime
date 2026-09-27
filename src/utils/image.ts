const MAX_SIZE = 256;
const JPEG_QUALITY = 0.85;

/** Recorta al cuadrado central, reescala a 256px y devuelve un data URL JPEG liviano. */
export function fileToSquareDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("No se pudo cargar la imagen"));
      image.onload = () => {
        const side = Math.min(image.width, image.height);
        const sx = (image.width - side) / 2;
        const sy = (image.height - side) / 2;

        const canvas = document.createElement("canvas");
        canvas.width = MAX_SIZE;
        canvas.height = MAX_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo procesar la imagen"));
          return;
        }
        ctx.drawImage(image, sx, sy, side, side, 0, 0, MAX_SIZE, MAX_SIZE);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
