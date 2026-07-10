import type { Plugin } from 'vite'

import { readFile, writeFile } from 'node:fs/promises'

import JSZip from 'jszip'

interface Model3Manifest {
  FileReferences?: {
    Moc?: string
    Textures?: string[]
    Physics?: string
    Pose?: string
    DisplayInfo?: string
    UserData?: string
    Expressions?: Array<{ File?: string }>
    Motions?: Record<string, Array<{ File?: string, Sound?: string }>>
  }
}

function runtimeReferences(manifest: Model3Manifest): string[] {
  const refs = manifest.FileReferences
  if (!refs)
    return []

  return [
    refs.Moc,
    ...(refs.Textures ?? []),
    refs.Physics,
    refs.Pose,
    refs.DisplayInfo,
    refs.UserData,
    ...(refs.Expressions ?? []).map(item => item.File),
    ...Object.values(refs.Motions ?? {}).flatMap(items => items.flatMap(item => [item.File, item.Sound])),
  ].filter((value): value is string => Boolean(value))
}

export async function createRuntimeOnlyLive2dArchive(input: Uint8Array): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(input)
  for (const path of Object.keys(zip.files)) {
    if (/\.(?:cmo3|can3)$/i.test(path))
      zip.remove(path)
  }

  const manifests = Object.keys(zip.files).filter(path => /model3\.json$/i.test(path))
  if (manifests.length === 0)
    throw new Error('Live2D archive does not contain model3.json')

  for (const manifestPath of manifests) {
    const manifestFile = zip.file(manifestPath)
    if (!manifestFile)
      throw new Error(`Missing Live2D manifest: ${manifestPath}`)

    const manifest = JSON.parse(await manifestFile.async('string')) as Model3Manifest
    const base = manifestPath.slice(0, manifestPath.lastIndexOf('/') + 1)
    for (const reference of runtimeReferences(manifest)) {
      const path = `${base}${reference}`
      if (!zip.file(path))
        throw new Error(`Missing Live2D runtime reference: ${path}`)
    }
  }

  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  })
}

export function runtimeOnlyLive2dArchives(paths: string[]): Plugin {
  return {
    name: 'airi-runtime-only-live2d-archives',
    apply: 'build',
    enforce: 'post',
    async configResolved() {
      for (const path of paths) {
        const input = await readFile(path)
        const output = await createRuntimeOnlyLive2dArchive(input)
        await writeFile(path, output)
      }
    },
  }
}
