/**
 * Spine skeleton version detection and runtime routing.
 *
 * Use when:
 * - A ZIP is imported and we need to determine which spine-webgl runtime
 *   (4.0, 4.1, or 4.2) to use for loading and rendering.
 *
 * Expects:
 * - Raw skeleton data (Uint8Array for binary `.skel`, or string for `.json`).
 *
 * Returns:
 * - A `SpineVersion` ('4.0' | '4.1' | '4.2') or `undefined` if undetectable.
 */

export type SpineVersion = string

/**
 * Detects the Spine editor version from a binary `.skel` file.
 *
 * The binary format header is:
 * - string: hash
 * - string: version (e.g. "4.2.18" or "3.8.99")
 * Strings are varint-length-prefixed.
 */
export function detectSpineVersionFromBinary(data: Uint8Array): SpineVersion | undefined {
  try {
    let offset = 0
    // Read hash string length
    const { value: hashLenEncoded, bytesRead: hashBytes } = readVarint(data, offset)
    offset += hashBytes

    if (hashLenEncoded > 1) {
      const hashLen = hashLenEncoded - 1
      offset += hashLen
    }

    // Read version string length
    const { value: verLenEncoded, bytesRead: verBytes } = readVarint(data, offset)
    offset += verBytes

    if (verLenEncoded <= 1)
      return undefined

    const verLen = verLenEncoded - 1
    if (offset + verLen > data.byteLength)
      return undefined

    const versionStr = new TextDecoder().decode(data.slice(offset, offset + verLen))
    return parseSpineVersionString(versionStr)
  }
  catch {
    return undefined
  }
}

/**
 * Detects the Spine editor version from a JSON skeleton string.
 * Reads `root.skeleton.spine` which contains the version string.
 */
export function detectSpineVersionFromJson(json: string): SpineVersion | undefined {
  try {
    const root = JSON.parse(json)
    const versionStr = root?.skeleton?.spine
    if (typeof versionStr !== 'string')
      return undefined
    return parseSpineVersionString(versionStr)
  }
  catch {
    return undefined
  }
}

/**
 * Parses a version string like "4.2.18" or "4.0.64" into our supported
 * major.minor version bucket.
 */
function parseSpineVersionString(version: string): SpineVersion | undefined {
  const match = version.match(/^(\d+)\.(\d+)/)
  if (!match)
    return undefined
  return `${match[1]}.${match[2]}`
}

/**
 * Reads a Spine-format varint (variable-length int, 7 bits per byte,
 * high bit = continuation).
 */
function readVarint(data: Uint8Array, offset: number): { value: number, bytesRead: number } {
  let value = 0
  let shift = 0
  let bytesRead = 0
  while (offset < data.byteLength) {
    const b = data[offset++]
    bytesRead++
    value |= (b & 0x7F) << shift
    if ((b & 0x80) === 0)
      break
    shift += 7
  }
  return { value, bytesRead }
}
