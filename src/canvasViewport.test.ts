import assert from 'node:assert/strict'
import test from 'node:test'

import {
  clampWheelZoomDelta,
  clampCanvasZoom,
  formatCanvasZoom,
  getAnchorPreservingScroll,
  getContinuousCanvasZoom,
  getNextCanvasZoom,
  getZoomToFit,
  screenToCanvasPoint,
} from './canvasViewport.ts'

test('clamps canvas zoom to the supported range', () => {
  assert.equal(clampCanvasZoom(0.1), 0.25)
  assert.equal(clampCanvasZoom(9), 4)
  assert.equal(clampCanvasZoom(Number.NaN), 1)
})

test('steps canvas zoom through familiar levels', () => {
  assert.equal(getNextCanvasZoom(1, 1), 1.25)
  assert.equal(getNextCanvasZoom(1.25, -1), 1)
  assert.equal(getNextCanvasZoom(4, 1), 4)
})

test('formats canvas zoom as a visible percentage', () => {
  assert.equal(formatCanvasZoom(1), '100%')
  assert.equal(formatCanvasZoom(1.25), '125%')
  assert.equal(formatCanvasZoom(0.5), '50%')
})

test('computes continuous zoom from wheel deltas without jumping to step levels', () => {
  const zoomedIn = getContinuousCanvasZoom(1, -10)
  const zoomedOut = getContinuousCanvasZoom(1, 10)

  assert.ok(zoomedIn > 1)
  assert.ok(zoomedIn < 1.25)
  assert.ok(zoomedOut < 1)
  assert.ok(zoomedOut > 0.75)
})

test('clamps continuous wheel zoom deltas and final zoom range', () => {
  assert.equal(clampWheelZoomDelta(999), 240)
  assert.equal(clampWheelZoomDelta(-999), -240)
  assert.equal(
    getContinuousCanvasZoom(1, -999),
    getContinuousCanvasZoom(1, -240)
  )
  assert.equal(getContinuousCanvasZoom(4, -999), 4)
  assert.equal(getContinuousCanvasZoom(0.25, 999), 0.25)
})

test('converts screen coordinates to logical canvas coordinates', () => {
  assert.deepEqual(
    screenToCanvasPoint(250, 220, {
      rectLeft: 50,
      rectTop: 20,
      scrollLeft: 100,
      scrollTop: 80,
      zoom: 2,
    }),
    {
      x: 150,
      y: 140,
    }
  )
})

test('computes scroll offsets that preserve a zoom anchor', () => {
  assert.deepEqual(
    getAnchorPreservingScroll({
      anchor: {
        clientX: 250,
        clientY: 220,
      },
      metrics: {
        rectLeft: 50,
        rectTop: 20,
        scrollLeft: 400,
        scrollTop: 280,
        zoom: 2,
      },
      nextZoom: 1.5,
    }),
    {
      scrollLeft: 250,
      scrollTop: 160,
    }
  )
})

test('computes zoom-to-fit for empty and populated canvases', () => {
  assert.deepEqual(
    getZoomToFit([], {
      height: 800,
      width: 1000,
    }),
    {
      scrollLeft: 0,
      scrollTop: 0,
      zoom: 1,
    }
  )

  const result = getZoomToFit(
    [
      { x: 100, y: 200, width: 400, height: 200 },
      { x: 700, y: 300, width: 100, height: 100 },
    ],
    {
      height: 800,
      width: 1000,
    },
    100
  )

  assert.equal(Math.round(result.zoom * 1000), 1143)
  assert.equal(Math.round(result.scrollLeft), 14)
  assert.equal(Math.round(result.scrollTop), 0)
})
