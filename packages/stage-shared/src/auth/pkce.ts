const BASE64_PLUS = /\+/g
const BASE64_SLASH = /\//g
const BASE64_TRAILING_EQ = /=+$/
const SHA256_BLOCK_BYTES = 64
const SHA256_HASH_BYTES = 32

const SHA256_INITIAL_HASH = [
  0x6A09E667,
  0xBB67AE85,
  0x3C6EF372,
  0xA54FF53A,
  0x510E527F,
  0x9B05688C,
  0x1F83D9AB,
  0x5BE0CD19,
] as const

const SHA256_ROUND_CONSTANTS = [
  0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5,
  0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
  0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3,
  0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
  0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC,
  0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
  0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7,
  0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
  0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13,
  0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
  0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3,
  0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
  0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5,
  0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
  0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208,
  0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2,
] as const

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits))
}

function sha256Fallback(data: Uint8Array): Uint8Array {
  const bitLength = data.length * 8
  const paddedLength = Math.ceil((data.length + 9) / SHA256_BLOCK_BYTES) * SHA256_BLOCK_BYTES
  const padded = new Uint8Array(paddedLength)
  padded.set(data)
  padded[data.length] = 0x80

  const paddedView = new DataView(padded.buffer)
  paddedView.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000))
  paddedView.setUint32(paddedLength - 4, bitLength >>> 0)

  const hash: number[] = [...SHA256_INITIAL_HASH]
  const words = new Uint32Array(64)

  for (let blockOffset = 0; blockOffset < paddedLength; blockOffset += SHA256_BLOCK_BYTES) {
    for (let index = 0; index < 16; index++)
      words[index] = paddedView.getUint32(blockOffset + index * 4)

    for (let index = 16; index < 64; index++) {
      const s0 = rotateRight(words[index - 15], 7) ^ rotateRight(words[index - 15], 18) ^ (words[index - 15] >>> 3)
      const s1 = rotateRight(words[index - 2], 17) ^ rotateRight(words[index - 2], 19) ^ (words[index - 2] >>> 10)
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0
    }

    let [a, b, c, d, e, f, g, h] = hash

    for (let index = 0; index < 64; index++) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + s1 + ch + SHA256_ROUND_CONSTANTS[index] + words[index]) >>> 0
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (s0 + maj) >>> 0

      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    hash[0] = (hash[0] + a) >>> 0
    hash[1] = (hash[1] + b) >>> 0
    hash[2] = (hash[2] + c) >>> 0
    hash[3] = (hash[3] + d) >>> 0
    hash[4] = (hash[4] + e) >>> 0
    hash[5] = (hash[5] + f) >>> 0
    hash[6] = (hash[6] + g) >>> 0
    hash[7] = (hash[7] + h) >>> 0
  }

  const output = new Uint8Array(SHA256_HASH_BYTES)
  const outputView = new DataView(output.buffer)
  for (let index = 0; index < hash.length; index++)
    outputView.setUint32(index * 4, hash[index])

  return output
}

/**
 * Encode a byte array as a URL-safe base64 string (no padding).
 * Works in both Browser and Node.js (Electron main).
 */
export function base64UrlEncode(buffer: Uint8Array): string {
  let binary = ''
  for (const byte of buffer)
    binary += String.fromCharCode(byte)

  return btoa(binary)
    .replace(BASE64_PLUS, '-')
    .replace(BASE64_SLASH, '_')
    .replace(BASE64_TRAILING_EQ, '')
}

/**
 * Generate a cryptographically random code verifier (RFC 7636 S4.1).
 * 43-128 characters from the unreserved URL character set.
 */
export function generateCodeVerifier(length = 64): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return base64UrlEncode(array)
}

/**
 * Derive a S256 code challenge from a code verifier (RFC 7636 S4.2).
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const subtle = globalThis.crypto?.subtle
  if (subtle) {
    try {
      const digest = await subtle.digest('SHA-256', data)
      return base64UrlEncode(new Uint8Array(digest))
    }
    catch {
      // HTTP/IP preview deployments are not secure contexts in browsers, so
      // WebCrypto can be absent or reject. Keep PKCE usable for demos while
      // production HTTPS keeps using the native implementation above.
    }
  }

  return base64UrlEncode(sha256Fallback(data))
}

/**
 * Generate a cryptographically random state parameter for CSRF protection.
 */
export function generateState(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64UrlEncode(array)
}
