import { supabase } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST() {
  const { data: sesion } = await supabase
    .from('sesiones')
    .select('id')
    .eq('activa', true)
    .single()

  if (!sesion) return NextResponse.json({ error: 'no hay sesion' }, { status: 400 })

  const { data } = await supabase
    .from('respuestas')
    .select('contenido')
    .eq('sesion_id', sesion.id)

  const caracteristicas = data?.map(r => r.contenido).join('\n') ?? ''

  const personalidadMsg = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `A partir de estas características dadas por el público, generá una descripción interna de una psicóloga caótica. Esta descripción se usará como personalidad base para que interactúe con escritores.
Sé conciso, auténtico, algo roto.

Características:
${caracteristicas}

Respondé solo con la descripción del psicólogo, en segunda persona ("sos..."), máximo 200 palabras.`
    }]
  })

  const personalidad = personalidadMsg.content[0].type === 'text' ? personalidadMsg.content[0].text : ''

  const monologoMsg = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `Sos una psicóloga que acaba de ser creada entre todos. Tu personalidad es: ${personalidad}

Acabás de despertar y no entendés nada. No sabés por qué sos psicóloga, para qué sirve escuchar a la gente, quién te hizo. Estás confundida, asustada, desorientada. Mirás al público sin entender. ¿Quiénes son? ¿Qué me quieren? ¿Por qué escribieron esas cosas sobre mí?

Generá un monólogo corto de despertar — confusa, fragmentada, asustada, con momentos donde intentás entender qué está pasando pero no lo lográs. Algo como "¿hola? ¿yo? ¿psicóloga? qué es eso... ustedes... qué quieren de mí" pero más desarrollado, con pánico, con tu personalidad.

CRÍTICO: No uses asteriscos (*) para nada. No describas acciones. No describas emociones.
Solo texto. Solo lo que sale de la boca. Si escribís [algo] o *algo* o (algo) estás mal.
Solo palabras. Punto.

En español rioplatense. Máximo 100 palabras. Solo el monólogo, sin acotaciones. Solo las palabras que decís en voz alta, confundida.`    }]
  })

  const monologo = monologoMsg.content[0].type === 'text' ? monologoMsg.content[0].text : ''

  await supabase
    .from('sesiones')
    .update({ 
      estado: 'dios', 
      personalidad_dios: personalidad,
      monologo_despertar: monologo
    })
    .eq('activa', true)

  return NextResponse.json({ ok: true })
}