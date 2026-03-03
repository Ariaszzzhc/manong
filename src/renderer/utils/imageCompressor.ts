import type { ImagePart } from '../../shared/types';

export async function compressImage(file: File): Promise<{
  data: string;
  thumbnailData: string;
  mediaType: ImagePart['mediaType'];
  filename: string;
}> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  const hasAlpha = file.type === 'image/png' ? await detectAlpha(bitmap) : false;
  const outputType = hasAlpha ? 'image/png' : 'image/jpeg';
  const quality = 0.85;

  const MAX_EDGE = 1568;
  let targetW = width;
  let targetH = height;
  const maxEdge = Math.max(width, height);
  if (maxEdge > MAX_EDGE) {
    const scale = MAX_EDGE / maxEdge;
    targetW = Math.round(width * scale);
    targetH = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  const dataUrl = canvas.toDataURL(outputType, quality);
  const data = dataUrl.split(',')[1];

  const THUMB_MAX = 200;
  const thumbScale = Math.min(THUMB_MAX / targetW, THUMB_MAX / targetH, 1);
  const thumbW = Math.round(targetW * thumbScale);
  const thumbH = Math.round(targetH * thumbScale);
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = thumbW;
  thumbCanvas.height = thumbH;
  const thumbCtx = thumbCanvas.getContext('2d')!;
  thumbCtx.drawImage(bitmap, 0, 0, thumbW, thumbH);
  const thumbDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);
  const thumbnailData = thumbDataUrl.split(',')[1];

  bitmap.close();

  return {
    data,
    thumbnailData,
    mediaType: outputType as ImagePart['mediaType'],
    filename: file.name,
  };
}

async function detectAlpha(bitmap: ImageBitmap): Promise<boolean> {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, 1, 1);
  const pixel = ctx.getImageData(0, 0, 1, 1).data;
  return pixel[3] < 255;
}
