const ImageDataConstructor = globalThis.ImageData || class ImageDataFallback {
  constructor(data, width, height) {
    this.data = data
    this.width = width
    this.height = height
  }
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

export function buildFilterString({ brightness = 100, contrast = 100, saturation = 100 } = {}) {
  return `brightness(${clamp(brightness, 0, 300)}%) contrast(${clamp(contrast, 0, 300)}%) saturate(${clamp(saturation, 0, 300)}%)`
}

export function adjustImageData(imageData, { brightness = 100, contrast = 100, saturation = 100 } = {}) {
  const ActiveImageData = globalThis.ImageData || ImageDataConstructor
  if (!(imageData instanceof ActiveImageData)) return imageData

  const { data, width, height } = imageData
  const output = new Uint8ClampedArray(data.length)
  const brightnessScale = clamp(brightness, 0, 300) / 100
  const contrastScale = clamp(contrast, 0, 300) / 100
  const saturationScale = clamp(saturation, 0, 300) / 100

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    const brightnessAdjustedR = r * brightnessScale
    const brightnessAdjustedG = g * brightnessScale
    const brightnessAdjustedB = b * brightnessScale

    const contrastAdjustedR = (brightnessAdjustedR - 128) * contrastScale + 128
    const contrastAdjustedG = (brightnessAdjustedG - 128) * contrastScale + 128
    const contrastAdjustedB = (brightnessAdjustedB - 128) * contrastScale + 128

    const luminance = 0.2126 * contrastAdjustedR + 0.7152 * contrastAdjustedG + 0.0722 * contrastAdjustedB
    const saturatedR = luminance + (contrastAdjustedR - luminance) * saturationScale
    const saturatedG = luminance + (contrastAdjustedG - luminance) * saturationScale
    const saturatedB = luminance + (contrastAdjustedB - luminance) * saturationScale

    output[i] = clamp(saturatedR, 0, 255)
    output[i + 1] = clamp(saturatedG, 0, 255)
    output[i + 2] = clamp(saturatedB, 0, 255)
    output[i + 3] = alpha
  }

  return new ImageDataConstructor(output, width, height)
}

export function hasCropSelection(dragState) {
  return Boolean(dragState && dragState.type === 'crop' && dragState.start && dragState.current)
}

export function sharpenImageData(imageData, intensity = 0) {
  const ActiveImageData = globalThis.ImageData || ImageDataConstructor
  if (!(imageData instanceof ActiveImageData) || intensity <= 0) return imageData

  const { data, width, height } = imageData
  const output = new Uint8ClampedArray(data.length)
  const strength = clamp(intensity, 0, 40) / 40

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4
      const left = index - 4
      const right = index + 4
      const up = index - width * 4
      const down = index + width * 4

      const alpha = data[index + 3]
      const r = data[index]
      const g = data[index + 1]
      const b = data[index + 2]

      const edgeR = data[left] + data[right] + data[up] + data[down]
      const edgeG = data[left + 1] + data[right + 1] + data[up + 1] + data[down + 1]
      const edgeB = data[left + 2] + data[right + 2] + data[up + 2] + data[down + 2]

      const sharpenedR = clamp(r * (1 + strength * 1.8) - (edgeR / 4) * strength, 0, 255)
      const sharpenedG = clamp(g * (1 + strength * 1.8) - (edgeG / 4) * strength, 0, 255)
      const sharpenedB = clamp(b * (1 + strength * 1.8) - (edgeB / 4) * strength, 0, 255)

      output[index] = sharpenedR
      output[index + 1] = sharpenedG
      output[index + 2] = sharpenedB
      output[index + 3] = alpha
    }
  }

  for (let i = 0; i < data.length; i += 1) {
    if (i % 4 === 3) {
      output[i] = data[i]
    }
  }

  return new ImageDataConstructor(output, width, height)
}
