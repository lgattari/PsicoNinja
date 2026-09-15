'use client'
import { useState, useEffect, useRef } from 'react'

interface Pregunta {
  id: string
  contenido: string
  respondida: boolean
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
  interface SpeechRecognition extends EventTarget {
    lang: string
    continuous: boolean
    interimResults: boolean
    start(): void
    stop(): void
    onstart: (() => void) | null
    onend: (() => void) | null
    onerror: (() => void) | null
    onresult: ((event: any) => void) | null
  }
}

export default function Admin() {
  const [caracteristicas, setCaracteristicas] = useState<number>(0)
  const [preguntas, setPreguntas] = useState<Pregunta[]>([])
  const [estado, setEstado] = useState<string>('activa')
  const [preguntaCustom, setPreguntaCustom] = useState('')
  const [cargando, setCargando] = useState(false)
  const [respuesta, setRespuesta] = useState('')
  const [escuchando, setEscuchando] = useState(false)
  const [descontrolado, setDescontrolado] = useState(false)
  const [enviandoMensaje, setEnviandoMensaje] = useState(false)
  const [preguntasHabilitadas, setPreguntasHabilitadas] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  function iniciarGrabacion() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta reconocimiento de voz')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'es-AR'
    recognition.continuous = true
    recognition.interimResults = true

    let transcriptoFinal = ''

    recognition.onstart = () => setEscuchando(true)

    recognition.onresult = (event: any) => {
      let interimTranscript = ''
      
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          transcriptoFinal += transcript + ' '
        } else {
          interimTranscript += transcript
        }
      }
      
      setPreguntaCustom(transcriptoFinal + interimTranscript)
    }

    recognition.onerror = () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      setEscuchando(false)
    }

    recognition.onend = () => setEscuchando(false)

    recognitionRef.current = recognition
    recognition.start()
  }

  function detenerGrabacion() {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setEscuchando(false)
  }

  async function cargarEstado() {
    const res = await fetch('/api/estado')
    const data = await res.json()
    setEstado(data.estado ?? 'activa')
    setCaracteristicas(data.respuestas?.length ?? 0)
    setPreguntasHabilitadas(data.preguntas_habilitadas ?? false)
    if (data.preguntas) setPreguntas(data.preguntas)
  }

  useEffect(() => {
    cargarEstado()
    const interval = setInterval(cargarEstado, 3000)
    return () => clearInterval(interval)
  }, [])

  async function iniciarDisolucion() {
    await fetch('/api/disolucion', { method: 'POST' })
  }

  async function invocar() {
    setCargando(true)
    await fetch('/api/invocar', { method: 'POST' })
    setCargando(false)
  }

  async function preguntar(texto: string) {
    if (!texto.trim()) return
    setCargando(true)
    const res = await fetch('/api/preguntar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pregunta: texto, descontrolado }),
    })
    const data = await res.json()
    setRespuesta(data.respuesta)
    setPreguntaCustom('')
    setCargando(false)
  }

  async function enviarMensajeFinal(forzar = false) {
    if (!forzar && !descontrolado) return
    setEnviandoMensaje(true)
    try {
      const res = await fetch('/api/enviar-mensaje-final', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (res.ok) {
        console.log('Mensaje final enviado:', data)
        alert('✦ El apocalipsis ha sido invocado ✦')
      } else {
        console.error('Error:', data)
        alert('Error: ' + (data.error || 'No se pudo enviar el mensaje'))
      }
    } catch (error) {
      console.error('Error enviando mensaje final:', error)
      alert('Error de conexión al enviar el mensaje')
    } finally {
      setEnviandoMensaje(false)
    }
  }

  async function nuevaSesion() {
    await fetch('/api/nueva-sesion', { method: 'POST' })
    setRespuesta('')
    setPreguntas([])
  }

  async function actualizarPreguntasHabilitadas(enabled: boolean) {
    setPreguntasHabilitadas(enabled)
    try {
      await fetch('/api/preguntas-habilitadas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preguntas_habilitadas: enabled }),
      })
    } catch (error) {
      console.error('Error actualizando preguntas habilitadas:', error)
      setPreguntasHabilitadas(!enabled)
    }
  }

  const estilos = `
    @keyframes fadein { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes pulse { 0%{transform:scale(1)} 50%{transform:scale(1.05)} 100%{transform:scale(1)} }
    @keyframes glow-red { 0%{box-shadow:0 0 10px rgba(255,100,100,0.3)} 50%{box-shadow:0 0 20px rgba(255,100,100,0.6)} 100%{box-shadow:0 0 10px rgba(255,100,100,0.3)} }
  `

  return (
    <main className="min-h-screen bg-black text-white p-8 flex flex-col gap-8 max-w-2xl mx-auto relative overflow-hidden">
      {/* Fondo con gradiente */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 50% 30%, rgba(200,150,255,0.05) 0%, rgba(0,0,0,1) 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 10 }}>
        {/* Header */}
        <div style={{
          marginBottom: '2rem',
          paddingBottom: '2rem',
          borderBottom: '1px solid rgba(200,150,255,0.2)',
          animation: 'fadein 0.6s ease-out',
        }}>
          <p style={{
            fontSize: '0.75rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'rgba(200,150,255,0.6)',
            margin: 0,
            marginBottom: '1rem',
          }}>
            panel de control
          </p>
          <div style={{
            display: 'flex',
            gap: '2rem',
            flexWrap: 'wrap',
          }}>
            <div>
              <p style={{
                fontSize: '0.9rem',
                color: 'rgba(200,150,255,0.5)',
                margin: '0 0 0.5rem 0',
              }}>
                Estado
              </p>
              <p style={{
                fontSize: '1.5rem',
                color: 'rgba(200,150,255,0.95)',
                fontWeight: 300,
                margin: 0,
                textTransform: 'capitalize',
              }}>
                {estado}
              </p>
            </div>
            <div>
              <p style={{
                fontSize: '0.9rem',
                color: 'rgba(200,150,255,0.5)',
                margin: '0 0 0.5rem 0',
              }}>
                Características
              </p>
              <p style={{
                fontSize: '1.5rem',
                color: 'rgba(200,150,255,0.95)',
                fontWeight: 300,
                margin: 0,
              }}>
                {caracteristicas}
              </p>
            </div>
            <div>
              <p style={{
                fontSize: '0.9rem',
                color: 'rgba(200,150,255,0.5)',
                margin: '0 0 0.5rem 0',
              }}>
                Preguntas
              </p>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}>
                <input
                  type="checkbox"
                  id="preguntasHabilitadas"
                  checked={preguntasHabilitadas}
                  onChange={(e) => actualizarPreguntasHabilitadas(e.target.checked)}
                  style={{
                    width: '20px',
                    height: '20px',
                    cursor: 'pointer',
                    accentColor: 'rgba(200,150,255,0.8)',
                  }}
                />
                <label htmlFor="preguntasHabilitadas" style={{
                  color: 'rgba(200,150,255,0.95)',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  margin: 0,
                }}>
                  Habilitadas
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Controles contextuales */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          marginBottom: '2rem',
          animation: 'fadein 0.8s ease-out',
        }}>
          {estado === 'activa' && (
            <button
              onClick={iniciarDisolucion}
              style={{
                padding: '1rem 2rem',
                borderRadius: '50px',
                border: '1px solid rgba(255,150,100,0.7)',
                backgroundColor: 'rgba(255,150,100,0.05)',
                color: 'rgba(255,150,100,0.9)',
                fontSize: '1rem',
                fontWeight: 300,
                letterSpacing: '0.05em',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                const target = e.target as HTMLButtonElement
                target.style.borderColor = 'rgba(255,150,100,1)'
                target.style.backgroundColor = 'rgba(255,150,100,0.15)'
                target.style.color = 'rgba(255,150,100,1)'
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                const target = e.target as HTMLButtonElement
                target.style.borderColor = 'rgba(255,150,100,0.7)'
                target.style.backgroundColor = 'rgba(255,150,100,0.05)'
                target.style.color = 'rgba(255,150,100,0.9)'
              }}
            >
              iniciar disolución
            </button>
          )}

          {estado === 'disolucion' && (
            <button
              onClick={invocar}
              disabled={cargando}
              style={{
                padding: '1rem 2rem',
                borderRadius: '50px',
                border: `1px solid rgba(200,150,255,${cargando ? 0.3 : 0.7})`,
                backgroundColor: `rgba(200,150,255,${cargando ? 0.02 : 0.08})`,
                color: `rgba(200,150,255,${cargando ? 0.5 : 0.9})`,
                fontSize: '1rem',
                fontWeight: 300,
                letterSpacing: '0.05em',
                cursor: cargando ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                opacity: cargando ? 0.5 : 1,
                animation: !cargando ? 'pulse 2s ease-in-out infinite' : 'none',
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                if (!cargando) {
                  const target = e.target as HTMLButtonElement
                  target.style.borderColor = 'rgba(200,150,255,1)'
                  target.style.backgroundColor = 'rgba(200,150,255,0.15)'
                  target.style.color = 'rgba(200,150,255,1)'
                }
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                if (!cargando) {
                  const target = e.target as HTMLButtonElement
                  target.style.borderColor = 'rgba(200,150,255,0.7)'
                  target.style.backgroundColor = 'rgba(200,150,255,0.08)'
                  target.style.color = 'rgba(200,150,255,0.9)'
                }
              }}
            >
              {cargando ? 'invocando...' : 'invocar al psico'}
            </button>
          )}

          {estado === 'dios' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              padding: '1.5rem',
              borderRadius: '12px',
              backgroundColor: 'rgba(200,150,255,0.05)',
              border: '1px solid rgba(200,150,255,0.3)',
            }}>
              <p style={{
                color: 'rgba(200,150,255,0.7)',
                fontSize: '0.9rem',
                margin: 0,
                fontStyle: 'italic',
              }}>
                ✦ La psico está despierta ✦
              </p>

              <textarea
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(200,150,255,0.05)',
                  border: '1px solid rgba(200,150,255,0.3)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  color: 'white',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  lineHeight: '1.5',
                  resize: 'none',
                }}
                rows={2}
                placeholder="hacele una pregunta al Psico..."
                value={preguntaCustom}
                onChange={e => setPreguntaCustom(e.target.value)}
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

              {/* Checkbox: La entidad se descontrola */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(255,100,100,0.05)',
                border: '1px solid rgba(255,100,100,0.3)',
              }}>
                <input
                  type="checkbox"
                  id="descontrolado"
                  checked={descontrolado}
                  onChange={(e) => {
                    setDescontrolado(e.target.checked)
                  }}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                    accentColor: 'rgba(255,100,100,0.8)',
                  }}
                />
                <label htmlFor="descontrolado" style={{
                  flex: 1,
                  color: 'rgba(255,100,100,0.8)',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  margin: 0,
                }}>
                  La entidad se descontrola
                </label>
              </div>

              <div style={{
                display: 'flex',
                gap: '0.75rem',
                flexWrap: 'wrap',
              }}>
                <button
                  onMouseDown={iniciarGrabacion}
                  onMouseUp={detenerGrabacion}
                  onTouchStart={iniciarGrabacion}
                  onTouchEnd={detenerGrabacion}
                  style={{
                    flex: 1,
                    minWidth: '120px',
                    padding: '0.75rem 1rem',
                    borderRadius: '50px',
                    border: `1px solid rgba(255,100,100,${escuchando ? 0.9 : 0.5})`,
                    backgroundColor: `rgba(255,100,100,${escuchando ? 0.15 : 0.05})`,
                    color: `rgba(255,100,100,${escuchando ? 1 : 0.8})`,
                    fontSize: '0.9rem',
                    fontWeight: 300,
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    animation: escuchando ? 'glow-red 1.5s ease-in-out infinite' : 'none',
                    userSelect: 'none',
                  }}
                >
                  {escuchando ? '🎤 grabando...' : '🎤 hablar'}
                </button>

                <button
                  onClick={() => preguntar(preguntaCustom)}
                  disabled={cargando || !preguntaCustom.trim()}
                  style={{
                    flex: 1,
                    minWidth: '120px',
                    padding: '0.75rem 1rem',
                    borderRadius: '50px',
                    border: `1px solid rgba(200,150,255,${preguntaCustom.trim() && !cargando ? 0.7 : 0.3})`,
                    backgroundColor: `rgba(200,150,255,${preguntaCustom.trim() && !cargando ? 0.1 : 0.02})`,
                    color: `rgba(200,150,255,${preguntaCustom.trim() && !cargando ? 0.95 : 0.5})`,
                    fontSize: '0.9rem',
                    fontWeight: 300,
                    letterSpacing: '0.05em',
                    cursor: preguntaCustom.trim() && !cargando ? 'pointer' : 'not-allowed',
                    transition: 'all 0.3s ease',
                    opacity: cargando || !preguntaCustom.trim() ? 0.5 : 1,
                  }}
                  onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                    if (preguntaCustom.trim() && !cargando) {
                      const target = e.target as HTMLButtonElement
                      target.style.borderColor = 'rgba(200,150,255,1)'
                      target.style.backgroundColor = 'rgba(200,150,255,0.2)'
                      target.style.color = 'rgba(200,150,255,1)'
                    }
                  }}
                  onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                    if (preguntaCustom.trim() && !cargando) {
                      const target = e.target as HTMLButtonElement
                      target.style.borderColor = 'rgba(200,150,255,0.7)'
                      target.style.backgroundColor = 'rgba(200,150,255,0.1)'
                      target.style.color = 'rgba(200,150,255,0.95)'
                    }
                  }}
                >
                  {cargando ? 'pensando...' : 'preguntar'}
                </button>
              </div>

              {respuesta && (
                <div style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(200,150,255,0.08)',
                  border: '1px solid rgba(200,150,255,0.3)',
                  animation: 'fadein 0.6s ease-out',
                }}>
                  <p style={{
                    fontSize: '0.8rem',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'rgba(200,150,255,0.5)',
                    margin: '0 0 0.75rem 0',
                  }}>
                    respuesta del dios
                  </p>
                  <p style={{
                    color: 'rgba(200,150,255,0.95)',
                    fontWeight: 300,
                    lineHeight: 1.6,
                    margin: 0,
                  }}>
                    {respuesta}
                  </p>
                </div>
              )}

              {descontrolado && (
                <button
                  onClick={() => enviarMensajeFinal(true)}
                  disabled={enviandoMensaje}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: `1px solid rgba(255,100,100,${enviandoMensaje ? 0.3 : 0.8})`,
                    backgroundColor: `rgba(255,100,100,${enviandoMensaje ? 0.02 : 0.1})`,
                    color: `rgba(255,100,100,${enviandoMensaje ? 0.5 : 1})`,
                    fontSize: '0.95rem',
                    fontWeight: 300,
                    letterSpacing: '0.05em',
                    cursor: enviandoMensaje ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    opacity: enviandoMensaje ? 0.6 : 1,
                  }}
                  onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                    if (!enviandoMensaje) {
                      const target = e.target as HTMLButtonElement
                      target.style.borderColor = 'rgba(255,100,100,1)'
                      target.style.backgroundColor = 'rgba(255,100,100,0.2)'
                    }
                  }}
                  onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                    if (!enviandoMensaje) {
                      const target = e.target as HTMLButtonElement
                      target.style.borderColor = 'rgba(255,100,100,0.8)'
                      target.style.backgroundColor = 'rgba(255,100,100,0.1)'
                    }
                  }}
                >
                  {enviandoMensaje ? 'enviando...' : 'enviar mensaje final'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Botón de nueva sesión */}
        <button
          onClick={nuevaSesion}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '50px',
            border: '1px solid rgba(200,150,255,0.2)',
            backgroundColor: 'transparent',
            color: 'rgba(200,150,255,0.4)',
            fontSize: '0.8rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
            const target = e.target as HTMLButtonElement
            target.style.borderColor = 'rgba(200,150,255,0.5)'
            target.style.color = 'rgba(200,150,255,0.7)'
          }}
          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
            const target = e.target as HTMLButtonElement
            target.style.borderColor = 'rgba(200,150,255,0.2)'
            target.style.color = 'rgba(200,150,255,0.4)'
          }}
        >
          nueva sesión
        </button>
      </div>

      <style>{estilos}</style>
    </main>
  )
}