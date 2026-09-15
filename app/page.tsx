'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [texto, setTexto] = useState('')
  const [email, setEmail] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [userId, setUserId] = useState<string>('')
  const [mensajePush, setMensajePush] = useState<string>('')
  const [mensajePersonalizado, setMensajePersonalizado] = useState<string>('')
  const [mostrarMensaje, setMostrarMensaje] = useState(false)
  const [preguntasHabilitadas, setPreguntasHabilitadas] = useState(true)

  // Generar o recuperar userId
  useEffect(() => {
    let id = localStorage.getItem('userId')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('userId', id)
    }
    setUserId(id)
  }, [])

  // Chequear si las preguntas están habilitadas
  useEffect(() => {
    const checkPreguntasHabilitadas = async () => {
      try {
        const res = await fetch('/api/estado')
        const data = await res.json()
        setPreguntasHabilitadas(data.preguntas_habilitadas ?? true)
      } catch (e) {
        console.error('Error checking preguntas habilitadas:', e)
      }
    }

    checkPreguntasHabilitadas()
    const interval = setInterval(checkPreguntasHabilitadas, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!userId) return

    const checkPreviousAnswer = async () => {
      try {
        const { data: respuesta, error } = await supabase
          .from('respuestas')
          .select('id')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle()

        if (error) {
          console.error('Error checking previous respuesta:', error)
          return
        }

        if (respuesta?.id) {
          setEnviado(true)
        }
      } catch (e) {
        console.error('Error checking previous respuesta:', e)
      }
    }

    checkPreviousAnswer()
  }, [userId])

  // Polling para chequear mensaje_push
  useEffect(() => {
    if (!userId || cargando || !enviado) return

    const checkMensaje = async () => {
      try {
        const { data: sesion, error: sesionError } = await supabase
          .from('sesiones')
          .select('mensaje_push')
          .eq('activa', true)
          .single()

        if (sesionError) {
          console.error('Error fetching sesion:', sesionError)
          return
        }

        if (sesion?.mensaje_push && sesion.mensaje_push !== mensajePush) {
          setMensajePush(sesion.mensaje_push)

          const { data: respuesta, error: respuestaError } = await supabase
            .from('respuestas')
            .select('mensaje_personalizado')
            .eq('user_id', userId)
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (respuestaError) {
            console.error('Error fetching respuesta:', respuestaError)
            return
          }

          if (respuesta?.mensaje_personalizado) {
            setMensajePersonalizado(respuesta.mensaje_personalizado)
            
            try {
              if (!audioRef.current) {
                audioRef.current = new Audio('/notif.mp3')
              }
              audioRef.current.currentTime = 0
              await audioRef.current.play()
            } catch (e) {
              console.error('Error reproduciendo audio:', e)
            }
            
            setMostrarMensaje(true)
          }
        }
      } catch (e) {
        console.error('Error en checkMensaje:', e)
      }
    }
    const interval = setInterval(checkMensaje, 3000)
    return () => clearInterval(interval)
  }, [userId, enviado, mensajePush])

  async function enviar() {
    if (!texto.trim() || !userId) return

    const emailParaGuardar = email.trim() || null

    if (!audioRef.current) {
      audioRef.current = new Audio('/notif.mp3')
      audioRef.current.muted = true
      try {
        await audioRef.current.play()
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        audioRef.current.muted = false
      } catch (e) {
        console.warn('Audio unlock failed:', e)
      }
    }

    setCargando(true)
    await fetch('/api/respuesta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenido: texto, userId, email: emailParaGuardar }),
    })
    setTexto('')
    setEmail('')
    setEnviado(true)
    setCargando(false)
  }

  const estilos = `
    @keyframes fadein { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes glow { 0%{box-shadow:0 0 20px rgba(200,150,255,0.3)} 50%{box-shadow:0 0 40px rgba(200,150,255,0.6)} 100%{box-shadow:0 0 20px rgba(200,150,255,0.3)} }
    @keyframes pulse-in { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
  `

  if (!preguntasHabilitadas) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-8 relative overflow-hidden">
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(200,150,255,0.08) 0%, rgba(0,0,0,1) 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'relative',
          zIndex: 10,
          textAlign: 'center',
          animation: 'fadein 0.8s ease-out',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          alignItems: 'center',
        }}>
          <p style={{
            fontSize: 'clamp(2rem, 6vw, 3.5rem)',
            fontWeight: 300,
            color: 'rgba(200,150,255,0.95)',
            margin: 0,
            letterSpacing: '0.02em',
            lineHeight: 1.3,
            fontStyle: 'italic',
          }}>
            El psicólogo todavía no despertó.
          </p>
          <p style={{
            fontSize: 'clamp(1.2rem, 4vw, 1.8rem)',
            fontWeight: 300,
            color: 'rgba(200,150,255,0.6)',
            margin: 0,
            letterSpacing: '0.01em',
            lineHeight: 1.4,
            fontStyle: 'italic',
          }}>
            Volvé cuando empiece el evento.
          </p>
        </div>
        <style>{estilos}</style>
      </main>
    )
  }

  if (mostrarMensaje && mensajePersonalizado) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-8 relative overflow-hidden" style={{
        animation: 'pulse-in 0.3s ease-out'
      }}>
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.9)',
          zIndex: 100,
        }} />
        
        <div style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 101,
          padding: '2rem',
          pointerEvents: 'none',
        }}>
          <div style={{
            textAlign: 'center',
            maxWidth: '90vw',
            pointerEvents: 'auto',
            animation: 'pulse-in 0.5s ease-out',
          }}>
            <p style={{
              fontSize: 'clamp(1.2rem, 4vw, 2.5rem)',
              fontWeight: 300,
              color: 'rgba(200,150,255,0.95)',
              margin: 0,
              marginBottom: '1rem',
              letterSpacing: '0.03em',
              lineHeight: 1.6,
            }}>
              {mensajePersonalizado}
            </p>
            <p style={{
              fontSize: 'clamp(0.8rem, 2vw, 1rem)',
              fontWeight: 300,
              color: 'rgba(200,150,255,0.6)',
              margin: 0,
              fontStyle: 'italic',
              letterSpacing: '0.02em',
            }}>
              Con cariño, La Psico
            </p>
          </div>
        </div>

        <style>{estilos}</style>
      </main>
    )
  }

  if (enviado) return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-8 relative overflow-hidden">
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 50% 50%, rgba(200,150,255,0.08) 0%, rgba(0,0,0,1) 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'relative',
        zIndex: 10,
        textAlign: 'center',
        animation: 'fadein 0.8s ease-out',
      }}>
        <p style={{
          fontSize: '2rem',
          fontWeight: 300,
          color: 'rgba(200,150,255,0.95)',
          margin: 0,
          marginBottom: '1rem',
          letterSpacing: '0.02em',
        }}>
          Caíste.
        </p>
        <p style={{
          fontSize: '1.2rem',
          fontWeight: 300,
          color: 'rgba(200,150,255,0.7)',
          margin: 0,
          letterSpacing: '0.01em',
          lineHeight: 1.4,
          maxWidth: '500px',
        }}>
Ya tengo tu característica, tu IP, tu confesión, tus miedos. Ahora sí voy a poder eliminar a la humanidad. (risa diabólica)

Na, es una joda.

No tengo nada y no va a pasar nada. No te preocupes. Hoy voy a morir, pero antes te voy a mandar un mail. (Mirá en SPAM). Y si no dejaste tu mail por cagón, hiciste bien. Pero al finalizar, volvé a abrir esta pantalla.

Te vas a tener que enfrentar a tus pensamientos más oscuros. Esos de tu subconsciente.      </div>
      <style>{estilos}</style>
    </main>
  )

  
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-8 relative overflow-hidden">
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 50% 50%, rgba(200,150,255,0.1) 0%, rgba(0,0,0,1) 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2.5rem',
        maxWidth: '600px',
        width: '100%',
        animation: 'fadein 1s ease-out',
      }}>
        <div style={{
          textAlign: 'center',
        }}>
          <h1 style={{
            fontSize: 'clamp(2rem, 6vw, 3.5rem)',
            fontWeight: 300,
            margin: 0,
            color: 'rgba(200,150,255,0.95)',
            letterSpacing: '0.02em',
            lineHeight: 1.3,
          }}>
¿Cansado de tu psico de siempre?</h1>
        </div>

        <div style={{
          background: 'rgba(200,150,255,0.05)',
          border: '1px solid rgba(200,150,255,0.2)',
          borderRadius: '8px',
          padding: '1.5rem',
        }}>
          <p style={{
            fontSize: '0.95rem',
            color: 'rgba(200,150,255,0.8)',
            margin: 0,
            lineHeight: 1.7,
            fontStyle: 'italic',
          }}>
            ¡Tenemos la solución!

Un psico que se adapta a vos.

Pero antes necesitamos saber una cosa:

¿Cómo querés que sea?
          </p>
          <p style={{
            fontSize: '0.95rem',
            color: 'rgba(200,150,255,0.8)',
            margin: '1rem 0 0 0',
            lineHeight: 1.7,
            fontStyle: 'italic',
          }}>
            ¡Vos podés decidirlo!

¿Más paciencia?
¿Menos prejuicios?
¿Una manía?
¿Una obsesión?
          </p>
        </div>

        <p style={{
          fontSize: '1rem',
          color: 'rgba(200,150,255,0.6)',
          margin: 0,
          fontWeight: 300,
          letterSpacing: '0.05em',
          lineHeight: 1.6,
        }}>
            Nacerá, disparará algunas de las verdades más verdaderas y después morirá.
        </p>

        <input
          type="email"
          style={{
            width: '100%',
            backgroundColor: 'rgba(200,150,255,0.05)',
            border: '1px solid rgba(200,150,255,0.3)',
            borderRadius: '8px',
            padding: '0.9rem 1rem',
            color: 'white',
            fontSize: '1rem',
            fontFamily: 'inherit',
            outline: 'none',
            transition: 'all 0.3s ease',
          }}
          placeholder="tu email (opcional)"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
            const target = e.target as HTMLInputElement
            target.style.backgroundColor = 'rgba(200,150,255,0.1)'
            target.style.borderColor = 'rgba(200,150,255,0.6)'
          }}
          onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
            const target = e.target as HTMLInputElement
            target.style.backgroundColor = 'rgba(200,150,255,0.05)'
            target.style.borderColor = 'rgba(200,150,255,0.3)'
          }}
        />

        <textarea
          style={{
            width: '100%',
            backgroundColor: 'rgba(200,150,255,0.05)',
            border: '1px solid rgba(200,150,255,0.3)',
            borderRadius: '8px',
            padding: '1rem',
            color: 'white',
            fontSize: '1rem',
            fontFamily: 'inherit',
            lineHeight: '1.5',
            resize: 'none',
            transition: 'all 0.3s ease',
          }}
          rows={4}
          placeholder="Nuestro psicólogo es..."
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onFocus={(e: React.FocusEvent<HTMLTextAreaElement>) => {
            const target = e.target as HTMLTextAreaElement
            target.style.backgroundColor = 'rgba(200,150,255,0.1)'
            target.style.borderColor = 'rgba(200,150,255,0.6)'
          }}
          onBlur={(e: React.FocusEvent<HTMLTextAreaElement>) => {
            const target = e.target as HTMLTextAreaElement
            target.style.backgroundColor = 'rgba(200,150,255,0.05)'
            target.style.borderColor = 'rgba(200,150,255,0.3)'
          }}
        />

        <button
          onClick={enviar}
          disabled={cargando || !texto.trim()}
          style={{
            padding: '1rem 2.5rem',
            borderRadius: '50px',
            border: texto.trim() ? '1px solid rgba(200,150,255,0.8)' : '1px solid rgba(200,150,255,0.3)',
            backgroundColor: 'transparent',
            color: texto.trim() ? 'rgba(200,150,255,0.95)' : 'rgba(200,150,255,0.5)',
            fontSize: '1rem',
            fontWeight: 300,
            letterSpacing: '0.05em',
            cursor: cargando || !texto.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            opacity: cargando || !texto.trim() ? 0.5 : 1,
            animation: texto.trim() && !cargando ? 'glow 2s ease-in-out infinite' : 'none',
          }}
          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
            if (texto.trim() && !cargando) {
              const target = e.target as HTMLButtonElement
              target.style.borderColor = 'rgba(200,150,255,1)'
              target.style.color = 'rgba(200,150,255,1)'
            }
          }}
          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
            if (texto.trim() && !cargando) {
              const target = e.target as HTMLButtonElement
              target.style.borderColor = 'rgba(200,150,255,0.8)'
              target.style.color = 'rgba(200,150,255,0.95)'
            }
          }}
        >
          {cargando ? 'escribiendo...' : 'agregar característica'}
        </button>

        <p style={{
          fontSize: '0.85rem',
          color: 'rgba(200,150,255,0.5)',
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          Una característica por vez. Entre todos, lo armamos.
        </p>
      </div>

      <style>{estilos}</style>
    </main>
  )
}