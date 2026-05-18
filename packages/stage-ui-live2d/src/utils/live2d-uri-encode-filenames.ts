import type { Live2DFactoryContext, Middleware } from 'pixi-live2d-display/cubism4'

function tryEncode(obj: any, prop: string | number) {
  if (obj?.[prop] && typeof obj[prop] === 'string') {
    obj[prop] = encodeURI(obj[prop])
  }
}

// A middleware to URI-encode possible filenames in settings to handle filenames with UTF-8 characters.
export const live2dEncodeFilenamesMiddleware: Middleware<Live2DFactoryContext> = (context, next) => {
  if (typeof context.source !== 'object' || !context.source)
    return next()

  // Be skeptical
  const settings = context.source.settings as any
  if (!settings)
    return next()

  // In-memory sanitization of motions to prevent WebGL/ZipLoader URL resolution crashes on custom scripting entries
  if (settings.motions && typeof settings.motions === 'object') {
    for (const [groupName, motions] of Object.entries(settings.motions)) {
      if (Array.isArray(motions)) {
        (settings.motions as any)[groupName] = motions.filter((motion: any) => {
          return (
            (typeof motion?.file === 'string' && motion.file.trim() !== '')
            || (typeof motion?.File === 'string' && motion.File.trim() !== '')
          )
        })
      }
    }
  }

  // In-memory sanitization of expressions
  if (settings.expressions && Array.isArray(settings.expressions)) {
    settings.expressions = settings.expressions.filter((exp: any) => {
      return (
        (typeof exp?.file === 'string' && exp.file.trim() !== '')
        || (typeof exp?.File === 'string' && exp.File.trim() !== '')
      )
    })
  }

  tryEncode(settings, 'moc')
  if (Array.isArray(settings.textures)) {
    for (let i = 0; i < settings.textures.length; i++) {
      tryEncode(settings.textures, i)
    }
  }
  tryEncode(settings, 'physics')
  tryEncode(settings, 'url')

  return next()
}
