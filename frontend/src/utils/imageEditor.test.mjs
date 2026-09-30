import test from 'node:test'
import assert from 'node:assert/strict'

import { buildFilterString, clamp, hasCropSelection, sharpenImageData } from './imageEditor.js'

const ImageDataFallback = class {
  constructor(data, width, height) {
    this.data = data
    this.width = width
    this.height = height
  }
}

if (!globalThis.ImageData) {
  globalThis.ImageData = ImageDataFallback
}

test('clamp keeps values inside the allowed bounds', () => {
  assert.equal(clamp(10, 0, 20), 10)
  assert.equal(clamp(-10, 0, 20), 0)
  assert.equal(clamp(25, 0, 20), 20)
})

test('buildFilterString includes brightness, contrast and saturation values', () => {
  const filter = buildFilterString({ brightness: 140, contrast: 120, saturation: 110 })
  assert.match(filter, /brightness\(140%\)/)
  assert.match(filter, /contrast\(120%\)/)
  assert.match(filter, /saturate\(110%\)/)
})

test('sharpenImageData increases edge contrast for a sample image', () => {
  const original = new Uint8ClampedArray([
    50, 50, 50, 255,
    50, 50, 50, 255,
    50, 50, 50, 255,
    50, 50, 50, 255,
    200, 200, 200, 255,
    50, 50, 50, 255,
    50, 50, 50, 255,
    50, 50, 50, 255,
    50, 50, 50, 255
  ])

  const imageData = new ImageData(original, 3, 3)
  const sharpened = sharpenImageData(imageData, 80)

  assert.ok(sharpened.data[16] !== imageData.data[16])
  assert.ok(sharpened.data[16] >= 0 && sharpened.data[16] <= 255)
  assert.equal(sharpened.width, 3)
  assert.equal(sharpened.height, 3)
})

test('crop selection guard ignores draw mode until a crop drag starts', () => {
  assert.equal(hasCropSelection({ active: true, type: 'draw', stroke: { points: [] } }), false)
  assert.equal(hasCropSelection({ active: true, type: 'crop', start: { x: 10, y: 10 }, current: { x: 20, y: 30 } }), true)
})
