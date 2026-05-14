import { createLlmMarkerParser } from '../packages/stage-ui/src/composables/llm-marker-parser'

async function test() {
  const parser = createLlmMarkerParser({ minLiteralEmitLength: 1 })
  const literals: string[] = []
  const specials: string[] = []

  const onLiteral = (v: string) => {
    console.log('Literal:', v)
    literals.push(v)
  }
  const onSpecial = (v: string) => {
    console.log('Special:', v)
    specials.push(v)
  }

  // Simulating the bug: unclosed ACT inside think, followed by response
  const input = '<think> Planning... <|ACT: emotion="excited" </think> Hello world! This is the response.'

  console.log('--- Consuming input ---')
  await parser.consume(input, onLiteral, onSpecial)
  console.log('--- Ending parser ---')
  await parser.end(onLiteral, onSpecial)

  console.log('\nResults:')
  console.log('Literals total:', literals.join(''))
  console.log('Specials total:', specials.join(''))
}

test()
