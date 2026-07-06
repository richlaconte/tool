// Minimal, dependency-free ZIP writer (STORE method, no compression) used
// for the Spec Kit bundle download. Matching the app's no-CDN/no-new-deps
// posture: the format subset here is the classic PKZIP local-file-header +
// central-directory layout, which every unzip tool reads.

export type ZipFileEntry = {
  name: string
  contents: string
}

// Fixed DOS timestamp (2026-01-01 00:00:00) keeps archives byte-stable for
// tests; archive contents, not timestamps, are the deliverable.
const DOS_TIME = 0
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1

export const createZipArchive = (files: ZipFileEntry[]): Uint8Array => {
  const encoder = new TextEncoder()
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const nameBytes = encoder.encode(file.name)
    const dataBytes = encoder.encode(file.contents)
    const crc = crc32(dataBytes)

    const localHeader = new Uint8Array(30 + nameBytes.length)
    const local = new DataView(localHeader.buffer)

    local.setUint32(0, 0x04034b50, true) // local file header signature
    local.setUint16(4, 20, true) // version needed to extract
    local.setUint16(6, 0x0800, true) // general purpose flags: UTF-8 names
    local.setUint16(8, 0, true) // method: STORE
    local.setUint16(10, DOS_TIME, true)
    local.setUint16(12, DOS_DATE, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, dataBytes.length, true) // compressed size
    local.setUint32(22, dataBytes.length, true) // uncompressed size
    local.setUint16(26, nameBytes.length, true)
    local.setUint16(28, 0, true) // extra field length
    localHeader.set(nameBytes, 30)

    const centralHeader = new Uint8Array(46 + nameBytes.length)
    const central = new DataView(centralHeader.buffer)

    central.setUint32(0, 0x02014b50, true) // central directory signature
    central.setUint16(4, 20, true) // version made by
    central.setUint16(6, 20, true) // version needed to extract
    central.setUint16(8, 0x0800, true) // UTF-8 names
    central.setUint16(10, 0, true) // method: STORE
    central.setUint16(12, DOS_TIME, true)
    central.setUint16(14, DOS_DATE, true)
    central.setUint32(16, crc, true)
    central.setUint32(20, dataBytes.length, true)
    central.setUint32(24, dataBytes.length, true)
    central.setUint16(28, nameBytes.length, true)
    central.setUint32(42, offset, true) // local header offset
    centralHeader.set(nameBytes, 46)

    localParts.push(localHeader, dataBytes)
    centralParts.push(centralHeader)
    offset += localHeader.length + dataBytes.length
  }

  const centralSize = centralParts.reduce(
    (size, part) => size + part.length,
    0
  )
  const endRecord = new Uint8Array(22)
  const end = new DataView(endRecord.buffer)

  end.setUint32(0, 0x06054b50, true) // end of central directory signature
  end.setUint16(8, files.length, true) // entries on this disk
  end.setUint16(10, files.length, true) // total entries
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true) // central directory offset

  const totalSize = offset + centralSize + endRecord.length
  const archive = new Uint8Array(totalSize)
  let cursor = 0

  for (const part of [...localParts, ...centralParts, endRecord]) {
    archive.set(part, cursor)
    cursor += part.length
  }

  return archive
}

const CRC_TABLE = buildCrcTable()

export const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff

  for (const byte of bytes) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff]
  }

  return (crc ^ 0xffffffff) >>> 0
}

function buildCrcTable() {
  const table = new Uint32Array(256)

  for (let index = 0; index < 256; index += 1) {
    let value = index

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }

    table[index] = value >>> 0
  }

  return table
}
