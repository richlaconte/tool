import assert from 'node:assert/strict'
import test from 'node:test'

import { createZipArchive, crc32 } from './zipArchive.ts'

const readUint32 = (bytes: Uint8Array, offset: number) =>
  new DataView(bytes.buffer, bytes.byteOffset).getUint32(offset, true)

const readUint16 = (bytes: Uint8Array, offset: number) =>
  new DataView(bytes.buffer, bytes.byteOffset).getUint16(offset, true)

test('crc32 matches known vectors', () => {
  const encoder = new TextEncoder()

  assert.equal(crc32(new Uint8Array(0)), 0)
  // Canonical CRC-32 test vector.
  assert.equal(
    crc32(encoder.encode('The quick brown fox jumps over the lazy dog')),
    0x414fa339
  )
})

test('zip archive has valid local, central, and end records', () => {
  const files = [
    { name: '001-demo/spec.md', contents: '# Feature Specification: Demo\n' },
    { name: '001-demo/tasks.md', contents: '# Tasks: Demo\n' },
  ]
  const archive = createZipArchive(files)
  const encoder = new TextEncoder()

  // Local file header signature at the start.
  assert.equal(readUint32(archive, 0), 0x04034b50)
  // STORE method, UTF-8 flag.
  assert.equal(readUint16(archive, 8), 0)
  assert.equal(readUint16(archive, 6), 0x0800)
  // First entry name follows the 30-byte header.
  const firstName = new TextDecoder().decode(
    archive.slice(30, 30 + files[0].name.length)
  )
  assert.equal(firstName, files[0].name)
  // Stored contents are embedded verbatim.
  const text = new TextDecoder().decode(archive)
  assert.ok(text.includes('# Feature Specification: Demo'))

  // End-of-central-directory record sits in the final 22 bytes.
  const end = archive.length - 22
  assert.equal(readUint32(archive, end), 0x06054b50)
  assert.equal(readUint16(archive, end + 8), files.length)
  assert.equal(readUint16(archive, end + 10), files.length)

  // Central directory offset + size add up to the end record position.
  const centralSize = readUint32(archive, end + 12)
  const centralOffset = readUint32(archive, end + 16)
  assert.equal(centralOffset + centralSize, end)
  // Central directory signature where the offset points.
  assert.equal(readUint32(archive, centralOffset), 0x02014b50)
  // CRC in the first local header matches the contents.
  assert.equal(
    readUint32(archive, 14),
    crc32(encoder.encode(files[0].contents))
  )
})

test('an empty archive is a valid zero-entry zip', () => {
  const archive = createZipArchive([])

  assert.equal(archive.length, 22)
  assert.equal(readUint32(archive, 0), 0x06054b50)
  assert.equal(readUint16(archive, 8), 0)
})
