export async function exportCanvasBlob(canvas, preferredMimeTypes = ['image/webp', 'image/jpeg', 'image/png']) {
  for (const mimeType of preferredMimeTypes) {
    const blob = await new Promise(resolve => {
      if (typeof canvas.toBlob !== 'function') {
        resolve(null)
        return
      }

      const quality = mimeType === 'image/jpeg' || mimeType === 'image/webp' ? 0.82 : undefined
      canvas.toBlob(resolve, mimeType, quality)
    })

    if (blob && blob.size > 0) return blob
  }

  throw new Error('Unable to export photo')
}
