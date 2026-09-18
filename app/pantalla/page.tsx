'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

function golpeIndustrial(ctx: AudioContext) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 15) * 0.8
      + Math.sin(2 * Math.PI * 60 * t) * Math.exp(-t * 10) * 0.6
      + Math.sin(2 * Math.PI * 120 * t) * Math.exp(-t * 20) * 0.3
  }
  const source = ctx.createBufferSource()
  source.buffer = buf
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(1, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
  source.connect(gain)
  gain.connect(ctx.destination)
  source.start()
}

function FraseEspera({ frases }: { frases: string[] }) {
  const [frase, setFrase] = useState(frases.length > 0 ? frases[Math.floor(Math.random() * frases.length)] : 'Pensando...')
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (frases.length === 0) return
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setFrase(frases[Math.floor(Math.random() * frases.length)])
        setVisible(true)
      }, 400)
    }, 4000)
    return () => clearInterval(interval)
  }, [frases])

  return (
    <div style={{
      textAlign: 'center',
    }}>
      <p style={{
        color: 'rgba(200,150,255,0.9)',
        fontSize: '2.5rem',
        fontWeight: 300,
        letterSpacing: '0.08em',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease',
        margin: 0,
        fontStyle: 'italic',
        lineHeight: 1.4,
      }}>
        {frase}
      </p>
      <div style={{
        marginTop: '1.5rem',
        display: 'flex',
        gap: '8px',
        justifyContent: 'center',
      }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'rgba(200,150,255,0.6)',
              animation: `pulse ${1 + i * 0.2}s infinite`,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

type Modo = 'caracteristicas' | 'contador' | 'disolucion' | 'dios'

interface Flotante {
  texto: string
  x: number
  y: number
  rot: number
  vx: number
  vy: number
  size: number
  op: number
}

export default function Pantalla() {
  const [audioActivo, setAudioActivo] = useState(false)
  const [caracteristicas, setCaracteristicas] = useState<string[]>([])
  const [modo, setModo] = useState<Modo>('caracteristicas')
  const [actual, setActual] = useState(0)
  const [visible, setVisible] = useState(true)
  const [cuenta, setCuenta] = useState(5)
  const [fase, setFase] = useState(0)
  const [flotantes, setFlotantes] = useState<Flotante[]>([])
  const [hablando, setHablando] = useState(false)
  const [ultimaPregunta, setUltimaPregunta] = useState('')
  const [ultimaRespuesta, setUltimaRespuesta] = useState('')
  const [descontrolado, setDescontrolado] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const prevEstado = useRef<string>('')
  const prevRespuesta = useRef<string>('')
  const audioCtxRef = useRef<AudioContext | null>(null)
  const talkingAudioRef = useRef<HTMLAudioElement | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const hablandoRef = useRef(false)
  const reproducidoRef = useRef<string>('')
  const [procesando, setProcesando] = useState(false)
  const [frasesEspera, setFrasesEspera] = useState<string[]>([])
  // Desactivado: frases en espera
  // useEffect(() => {
  //   const fetchFrases = async () => {
  //     const { data, error } = await supabase.from('frases_espera').select('texto')
  //     if (data && !error) {
  //       setFrasesEspera(data.map(item => item.texto))
  //     }
  //   }
  //   fetchFrases()
  // }, [])
  useEffect(() => {
    const check = setInterval(() => {
      const audioSpeaking = talkingAudioRef.current
        ? !talkingAudioRef.current.paused && !talkingAudioRef.current.ended
        : false
      const speaking = window.speechSynthesis.speaking || audioSpeaking

      if (speaking !== hablandoRef.current) {
        hablandoRef.current = speaking
        setHablando(speaking)
      }
    }, 100)
    return () => clearInterval(check)
  }, [])

  async function activarAudio() {
    const ctx = new AudioContext()
    await ctx.resume()
    audioCtxRef.current = ctx
    setAudioActivo(true)
  }

  function cleanupAudioAnalyser() {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect()
      sourceNodeRef.current = null
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect()
      analyserRef.current = null
      dataArrayRef.current = null
    }
  }

  function setupAudioAnalyser(audio: HTMLAudioElement) {
    const ctx = audioCtxRef.current
    if (!ctx) return

    cleanupAudioAnalyser()
    audio.muted = false
    audio.volume = 1

    const source = ctx.createMediaElementSource(audio)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 128

    source.connect(analyser)
    source.connect(ctx.destination)
    analyser.connect(ctx.destination)

    sourceNodeRef.current = source
    analyserRef.current = analyser
    dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)
  }

  async function cargar() {
  const res = await fetch('/api/estado')
  const data = await res.json()

  if (data.estado === 'dios') {
    setProcesando(data.procesando ?? false)
  }

  if (data.estado === 'dios' && prevEstado.current !== 'dios') {
      prevEstado.current = 'dios'
      setModo('dios')
      
      if (data.monologo_despertar) {
        setTimeout(async () => {
          window.speechSynthesis.cancel()

          if (process.env.USE_ELEVENLABS === 'true') {
              try {
                const res = await fetch(`/api/despertar?t=${Date.now()}`)
                if (!res.ok) {
                  const text = await res.text()
                  throw new Error(`Despertar audio request failed: ${res.status} ${text}`)
                }
                const blob = await res.blob()
                if (!blob.type.startsWith('audio/')) {
                  const text = await blob.text()
                  throw new Error(`Despertar returned non-audio content: ${blob.type} ${text}`)
                }
                const url = URL.createObjectURL(blob)
                const audio = new Audio(url)
                talkingAudioRef.current = audio
                setupAudioAnalyser(audio)

                audio.addEventListener('play', () => {
                  hablandoRef.current = true
                  setHablando(true)
                })
                audio.addEventListener('ended', () => {
                  hablandoRef.current = false
                  setHablando(false)
                  talkingAudioRef.current = null
                  cleanupAudioAnalyser()
                  URL.revokeObjectURL(url)
                })
                audio.addEventListener('error', () => {
                  hablandoRef.current = false
                  setHablando(false)
                  talkingAudioRef.current = null
                  cleanupAudioAnalyser()
                  URL.revokeObjectURL(url)
                })

                await audio.play()
              } catch(e) {
                console.error('error despertar', e)
              }
            }else {
            const utterance = new SpeechSynthesisUtterance(data.monologo_despertar)
            utterance.lang = 'es-AR'
            utterance.rate = 0.8
            utterance.pitch = 0.5
            utterance.volume = 1
            const keepAlive = setInterval(() => {
              if (window.speechSynthesis.speaking) {
                window.speechSynthesis.pause()
                window.speechSynthesis.resume()
              } else {
                clearInterval(keepAlive)
              }
            }, 5000)
            window.speechSynthesis.speak(utterance)
          }
        }, 2000)
      }
    } else if (data.estado === 'disolucion' && prevEstado.current !== 'disolucion' && prevEstado.current !== 'dios') {
      prevEstado.current = 'disolucion'
      setCaracteristicas(data.respuestas)
      setModo('contador')
      setCuenta(5)
    } else if (data.estado === 'activa') {
      prevEstado.current = 'activa'
      setCaracteristicas(data.respuestas)
    }

    if (data.ultimaRespuesta && data.ultimaRespuesta.respuesta !== prevRespuesta.current) {
      if (window.speechSynthesis.speaking) return
      if (reproducidoRef.current === data.ultimaRespuesta.respuesta) return

      prevRespuesta.current = data.ultimaRespuesta.respuesta
      reproducidoRef.current = data.ultimaRespuesta.respuesta
      setUltimaPregunta(data.ultimaRespuesta.pregunta)
      setUltimaRespuesta(data.ultimaRespuesta.respuesta)
      
      // Detectar si la respuesta tiene el flag descontrolado
      if (data.ultimaRespuesta.descontrolado === true) {
        setDescontrolado(true)
      } else {
        setDescontrolado(false)
      }

      try {
        const texto = data.ultimaRespuesta.respuesta

        if (process.env.USE_ELEVENLABS === 'true') {
          const res = await fetch(`/api/audio?t=${Date.now()}`)
          if (!res.ok) {
            const text = await res.text()
            throw new Error(`Audio request failed: ${res.status} ${text}`)
          }
          const blob = await res.blob()
          if (!blob.type.startsWith('audio/')) {
            const text = await blob.text()
            throw new Error(`Audio returned non-audio content: ${blob.type} ${text}`)
          }
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          talkingAudioRef.current = audio
          setupAudioAnalyser(audio)

          audio.addEventListener('play', () => {
            hablandoRef.current = true
            setHablando(true)
            console.log('HABLANDO TRUE', hablandoRef.current)
          })

          audio.addEventListener('ended', () => {
            hablandoRef.current = false
            setHablando(false)
            talkingAudioRef.current = null
            cleanupAudioAnalyser()
            URL.revokeObjectURL(url)
          })
          audio.addEventListener('error', () => {
            hablandoRef.current = false
            setHablando(false)
            talkingAudioRef.current = null
            cleanupAudioAnalyser()
            URL.revokeObjectURL(url)
          })

          await audio.play()
        } else {
          window.speechSynthesis.cancel()
          const utterance = new SpeechSynthesisUtterance(texto)
          utterance.lang = 'es-AR'
          utterance.rate = 0.85
          utterance.pitch = 0.6
          utterance.volume = 1
          const keepAlive = setInterval(() => {
            if (window.speechSynthesis.speaking) {
              window.speechSynthesis.pause()
              window.speechSynthesis.resume()
            } else {
              clearInterval(keepAlive)
            }
          }, 5000)
          window.speechSynthesis.speak(utterance)
        }
      } catch(e) {
        console.error('audio error', e)
      }
    }
  }

  useEffect(() => {
    if (!audioActivo) return
    cargar()
    const interval = setInterval(cargar, 3000)
    return () => clearInterval(interval)
  }, [audioActivo])

  useEffect(() => {
    if (caracteristicas.length === 0) return
    setActual(0)
    setVisible(true)
    const rot = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setActual(p => (p + 1) % caracteristicas.length)
        setVisible(true)
      }, 600)
    }, 3500)
    return () => clearInterval(rot)
  }, [caracteristicas.length])

  useEffect(() => {
    if (modo !== 'contador') return
    if (audioCtxRef.current) golpeIndustrial(audioCtxRef.current)
    const interval = setInterval(() => {
      setCuenta(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          const items: Flotante[] = caracteristicas.map((texto, index) => ({
            texto,
            x: Math.random() * 80 + 10, // Más centrado inicialmente
            y: Math.random() * 80 + 10,
            rot: (Math.random() - 0.5) * 20, // Rotación inicial más suave
            vx: (Math.random() - 0.5) * 0.8, // Velocidad inicial más alta
            vy: (Math.random() - 0.5) * 0.8,
            size: Math.random() * 8 + 16, // Tamaño más consistente
            op: Math.random() * 0.3 + 0.7, // Opacidad más alta
          }))
          setFlotantes(items)
          setModo('disolucion')
          setFase(0)
          return 0
        }
        if (audioCtxRef.current) golpeIndustrial(audioCtxRef.current)
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [modo])

  useEffect(() => {
    if (modo !== 'disolucion') return
    
    // Reproducir sonido de disolución
    const audio = new Audio('/disolucion.mp3')
    audio.volume = 0.7
    audio.play().catch(e => console.error('Error audio disolución', e))
    
    const timers = [1500, 3500, 5500, 7500, 9500].map((t, i) =>
      setTimeout(() => setFase(i + 1), t)
    )
    return () => timers.forEach(clearTimeout)
  }, [modo])

  useEffect(() => {
    if (flotantes.length === 0) return
    const anim = setInterval(() => {
      setFlotantes(prev => prev.map(p => {
        // Movimiento más orgánico con atracción al centro
        const centerX = 50
        const centerY = 50
        const dx = centerX - p.x
        const dy = centerY - p.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        // Atracción gradual al centro
        const attraction = 0.02
        const newVx = p.vx + (dx / distance) * attraction
        const newVy = p.vy + (dy / distance) * attraction

        // Amortiguación para movimiento más suave
        const damping = 0.98
        const finalVx = newVx * damping
        const finalVy = newVy * damping

        return {
          ...p,
          x: Math.max(0, Math.min(100, p.x + finalVx)),
          y: Math.max(0, Math.min(100, p.y + finalVy)),
          vx: finalVx,
          vy: finalVy,
          // Rotación más dinámica
          rot: p.rot + (Math.sin(Date.now() * 0.001 + p.x) * 0.5),
        }
      }))
    }, 16) // 60fps
    return () => clearInterval(anim)
  }, [flotantes.length])

  
  useEffect(() => {
    if (!procesando) return

    const audioFiles = ['/cucaCanta1.mp3', '/cucaCanta2.mp3', '/cucaCanta3.mp3', '/cucaCanta4.mp3', '/cucaCanta5.mp3', '/cucaCanta6.mp3']
    const audio = new Audio(audioFiles[Math.floor(Math.random() * audioFiles.length)])
    audio.loop = true
    audio.volume = 0.35

    const playAudio = async () => {
      try {
        await audio.play()
      } catch (e) {
        console.error('Error reproduciendo audio de proceso:', e)
      }
    }

    playAudio()

    return () => {
      audio.pause()
      audio.currentTime = 0
    }
  }, [procesando])

  useEffect(() => {
  if (modo !== 'dios') return
  const canvas = canvasRef.current
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const W = canvas.width = window.innerWidth
  const H = canvas.height = window.innerHeight
  let t = 0
  let frame: number

  function draw() {
    if (!ctx) return

    // estática de TV
    const imageData = ctx.createImageData(W, H)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() * 255
      data[i] = v
      data[i+1] = v
      data[i+2] = v
      data[i+3] = 255
    }
    ctx.putImageData(imageData, 0, 0)

    // overlay negro semitransparente para que no sea tan agresiva
    const overlayColor = descontrolado ? 'rgba(150,0,0,0.72)' : 'rgba(0,0,0,0.72)'
    ctx.fillStyle = overlayColor
    ctx.fillRect(0, 0, W, H)

    // scan lines
    for (let y = 0; y < H; y += 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(0, y, W, 1)
    }

    // glitch horizontal ocasional
    const glitchThreshold = descontrolado ? 0.3 : 0.06
    if (Math.random() < glitchThreshold) {
      const gy = Math.random() * H
      const gh = Math.random() * 12 + 2
      const imageSlice = ctx.getImageData(0, gy, W, gh)
      ctx.putImageData(imageSlice, (Math.random() - 0.5) * 60, gy)
    }

    
    if (procesando) {
      // estática más intensa
      if (Math.random() < 0.2) {  // más glitches que lo normal
        const gy = Math.random() * H
        const gh = Math.random() * 20 + 5
        const imageSlice = ctx.getImageData(0, gy, W, gh)
        ctx.putImageData(imageSlice, (Math.random() - 0.5) * 100, gy)
      }
      // pulso sutil
      const pulse = Math.abs(Math.sin(t * 0.1)) * 0.05
      ctx.fillStyle = `rgba(255,255,255,${pulse})`
      ctx.fillRect(0, 0, W, H)
    }
    // ecualizador cuando habla
    if (hablandoRef.current) {
      const bars = 64
      const barW = (W * 0.6) / bars
      const centerX = W / 2
      const centerY = H / 2
      const analyser = analyserRef.current
      const data = dataArrayRef.current

      if (analyser && data) {
        analyser.getByteFrequencyData(data)
        for (let i = 0; i < bars; i++) {
          const idx = Math.floor(i * data.length / bars)
          const value = data[idx] ?? 0
          const barH = (value / 255) * (H * 0.5) + 5
          const distance = (i + 1) * barW
          const alpha = 0.4 + (value / 255) * 0.6
          const hue = descontrolado ? (i / bars) * 30 : 280 + (i / bars) * 100
          const saturation = 80 + (value / 255) * 20

          // Barra derecha
          ctx.fillStyle = `hsla(${hue}, ${saturation}%, 65%, ${alpha})`
          ctx.fillRect(centerX + distance, centerY - barH / 2, barW - 0.5, barH)
          
          ctx.shadowColor = `hsla(${hue}, 100%, 65%, 0.8)`
          ctx.shadowBlur = 12
          ctx.fillStyle = `hsla(${hue}, 100%, 80%, ${alpha * 0.6})`
          ctx.fillRect(centerX + distance, centerY - barH / 2, barW - 0.5, barH * 0.3)
          ctx.shadowBlur = 0

          // Barra izquierda (simétrica)
          ctx.fillStyle = `hsla(${hue}, ${saturation}%, 65%, ${alpha})`
          ctx.fillRect(centerX - distance - (barW - 0.5), centerY - barH / 2, barW - 0.5, barH)
          
          ctx.shadowColor = `hsla(${hue}, 100%, 65%, 0.8)`
          ctx.shadowBlur = 12
          ctx.fillStyle = `hsla(${hue}, 100%, 80%, ${alpha * 0.6})`
          ctx.fillRect(centerX - distance - (barW - 0.5), centerY - barH / 2, barW - 0.5, barH * 0.3)
          ctx.shadowBlur = 0
        }
      } else {
        for (let i = 0; i < bars; i++) {
          const freq = Math.sin(t * 0.15 + i * 0.4) * 0.5
            + Math.sin(t * 0.23 + i * 0.7) * 0.3
            + Math.sin(t * 0.31 + i * 0.2) * 0.2
            + (Math.random() - 0.5) * 0.3

          const barH = Math.abs(freq) * 200 + 5
          const distance = (i + 1) * barW
          const alpha = 0.6 + Math.abs(freq) * 0.4
          const hue = descontrolado ? (i / bars) * 30 : 280 + (i / bars) * 100

          // Barra derecha
          ctx.fillStyle = `hsla(${hue}, 80%, 65%, ${alpha})`
          ctx.fillRect(centerX + distance, centerY - barH / 2, barW - 0.5, barH)

          // Barra izquierda (simétrica)
          ctx.fillStyle = `hsla(${hue}, 80%, 65%, ${alpha})`
          ctx.fillRect(centerX - distance - (barW - 0.5), centerY - barH / 2, barW - 0.5, barH)
        }
      }

      const pulse = analyser && data
        ? Math.max(...data) / 255 * 0.2
        : Math.abs(Math.sin(t * 0.18)) * 0.1
      ctx.fillStyle = `rgba(200,150,255,${pulse})`
      ctx.fillRect(0, 0, W, H)
    } else {
      // línea plana cuando no habla
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.fillRect(0, H / 2 - 1, W, 2)
    }

    t++
    frame = requestAnimationFrame(draw)
  }

  draw()
  return () => cancelAnimationFrame(frame)
}, [modo])

  const transiciones = ['glitch 0.6s ease-out', 'caer 0.6s cubic-bezier(.68,-0.55,.27,1.55)', 'rotar 0.6s ease-out', 'explotar 0.6s ease-out']

  const estilos = `
    @keyframes glitch { 0%{opacity:0;transform:skewX(20deg) translateX(-30px);filter:blur(8px)} 40%{opacity:1;transform:skewX(-5deg) translateX(5px);filter:blur(0)} 100%{transform:skewX(0)} }
    @keyframes caer { 0%{opacity:0;transform:translateY(-80px) rotate(-3deg)} 60%{opacity:1;transform:translateY(10px) rotate(1deg)} 100%{transform:translateY(0) rotate(0)} }
    @keyframes rotar { 0%{opacity:0;transform:rotate(-180deg) scale(0.3)} 70%{opacity:1;transform:rotate(10deg) scale(1.05)} 100%{transform:rotate(0) scale(1)} }
    @keyframes explotar { 0%{opacity:0;transform:scale(3);filter:blur(12px)} 60%{opacity:1;transform:scale(0.95);filter:blur(0)} 100%{transform:scale(1)} }
    @keyframes pulso { 0%{transform:scale(1)} 50%{transform:scale(1.08)} 100%{transform:scale(1)} }
    @keyframes aparecer { from{opacity:0;letter-spacing:0.5em;filter:blur(8px)} to{opacity:1;letter-spacing:normal;filter:blur(0)} }
    @keyframes fadein { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  `

  if (!audioActivo) return (
    <main className="min-h-screen bg-black flex items-center justify-center">
      <button onClick={activarAudio}
        className="px-8 py-4 border border-white/20 rounded-full text-white/40 hover:text-white hover:border-white transition-all">
        iniciar
      </button>
    </main>
  )

  if (modo === 'dios') return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-8 gap-6">
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
      />
       {/* Desactivado: frases en espera */}
      {/* {!hablando && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 5,
          pointerEvents: 'none',
        }}>
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            backdropFilter: 'blur(4px)',
            borderRadius: '12px',
            border: '1px solid rgba(200,150,255,0.3)',
            boxShadow: '0 0 40px rgba(200,150,255,0.1)',
          }}>
            <FraseEspera frases={frasesEspera} />
          </div>
        </div>
      )} */
      }
      <style>{estilos}</style>
    </main>
  )

  if (modo === 'contador') return (
    <main className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-white font-light" style={{ fontSize: '40vw', opacity: 0.15, animation: 'pulso 0.3s ease-out', lineHeight: 1 }}>
        {cuenta}
      </p>
      <style>{estilos}</style>
    </main>
  )

  if (modo === 'disolucion') {
    const bgIntensity = Math.min(fase * 0.15, 0.8)
    const bgColor = `rgba(255, ${100 + fase * 20}, 0, ${bgIntensity})`

    return (
      <main className="min-h-screen overflow-hidden relative" style={{
        background: `radial-gradient(circle at 50% 50%, ${bgColor} 0%, rgba(20,0,0,${bgIntensity}) 50%, black 100%)`,
        transition: 'all 2s ease-in-out'
      }}>
        {/* Partículas de fondo */}
        {fase >= 1 && Array.from({ length: 20 }, (_, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: '2px',
            height: '2px',
            background: `hsl(${20 + fase * 10}, 100%, 70%)`,
            borderRadius: '50%',
            opacity: Math.min(fase * 0.1, 0.6),
            animation: `float ${2 + Math.random() * 2}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
          }} />
        ))}

        {flotantes.map((p, i) => {
          const fusionProgress = Math.max(0, fase - 2)
          const scale = 1 + fusionProgress * 0.5
          const glowIntensity = fusionProgress * 20

          return (
            <span key={i} style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              fontSize: `${p.size * scale}px`,
              transform: `rotate(${p.rot}deg) scale(${scale})`,
              opacity: fase >= 4 ? Math.max(0, p.op - (fase - 4) * 0.3) : p.op,
              color: fase >= 2 ? `hsl(${20 + fusionProgress * 20}, ${80 + fusionProgress * 20}%, ${60 + fusionProgress * 20}%)` : 'white',
              filter: fase >= 2 ? `blur(${fusionProgress * 1.5}px) drop-shadow(0 0 ${glowIntensity}px hsl(${20 + fusionProgress * 20}, 100%, 70%))` : 'none',
              transition: 'all 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
              fontWeight: 300,
              whiteSpace: 'nowrap',
              maxWidth: '40vw',
              textShadow: fase >= 2 ? `0 0 ${glowIntensity * 0.5}px hsl(${20 + fusionProgress * 20}, 100%, 70%)` : 'none',
              animation: fase >= 3 ? `dissolve ${2 + Math.random()}s ease-in-out infinite` : 'none',
            }}>
              {p.texto}
            </span>
          )
        })}

        {/* Overlay final con efecto de quemado */}
        {fase >= 4 && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 50% 50%, transparent 30%, rgba(0,0,0,0.8) 60%, black 100%)',
            animation: 'burn 3s ease-in forwards',
            zIndex: 10,
          }} />
        )}

        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.3; }
            50% { transform: translateY(-20px) rotate(180deg); opacity: 0.8; }
          }
          @keyframes dissolve {
            0%, 100% { transform: scale(1) rotate(0deg); filter: blur(0px); }
            50% { transform: scale(1.1) rotate(5deg); filter: blur(2px); }
          }
          @keyframes burn {
            0% { opacity: 0; transform: scale(0.8); }
            50% { opacity: 0.5; transform: scale(1.2); }
            100% { opacity: 1; transform: scale(1); }
          }
          ${estilos}
        `}</style>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 overflow-hidden relative">
      {/* Fondo con gradiente radial sutil */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 50% 50%, rgba(200,150,255,0.05) 0%, rgba(0,0,0,1) 70%)',
        pointerEvents: 'none',
      }} />

      {/* Contenedor principal */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '3rem',
          animation: 'fadein 1s ease-out',
        }}>
          <p style={{
            fontSize: '0.75rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'rgba(200,150,255,0.6)',
            margin: 0,
            marginBottom: '0.5rem',
            fontWeight: 400,
          }}>
            {caracteristicas.length} {caracteristicas.length === 1 ? 'ofrenda' : 'ofrendas'} recibidas
          </p>
          <div style={{
            height: '2px',
            width: '60px',
            background: 'linear-gradient(90deg, transparent, rgba(200,150,255,0.8), transparent)',
            margin: '0 auto',
          }} />
        </div>

        {/* Contenido principal */}
        {caracteristicas.length === 0 ? (
          <div style={{
            textAlign: 'center',
            animation: 'pulse 2s ease-in-out infinite',
          }}>
            <p style={{
              fontSize: '1.5rem',
              color: 'rgba(200,150,255,0.4)',
              fontStyle: 'italic',
              letterSpacing: '0.05em',
              margin: 0,
              fontWeight: 300,
            }}>
              esperando ofrendas...
            </p>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2rem',
            maxWidth: '90vw',
          }}>
            {/* Características principales */}
            <div style={{
              position: 'relative',
              minHeight: '200px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
            }}>
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(circle, rgba(200,150,255,0.1) 0%, transparent 70%)',
                borderRadius: '50%',
                opacity: visible ? 1 : 0,
                transition: 'opacity 0.4s ease',
              }} />
              <p style={{
                fontSize: 'clamp(2rem, 8vw, 4.5rem)',
                fontWeight: 300,
                textAlign: 'center',
                maxWidth: '85vw',
                lineHeight: 1.3,
                color: 'rgba(200,150,255,0.95)',
                opacity: visible ? 1 : 0,
                animation: visible ? transiciones[actual % transiciones.length] : 'none',
                transition: visible ? 'none' : 'opacity 0.4s ease',
                textShadow: '0 0 20px rgba(200,150,255,0.3)',
                letterSpacing: '0.02em',
              }}>
                {caracteristicas[actual]}
              </p>
            </div>

            {/* Indicador de progreso */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'center',
              margin: '1rem 0',
            }}>
              {caracteristicas.map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: '6px',
                    width: i === actual ? '24px' : '6px',
                    borderRadius: '3px',
                    background: i === actual 
                      ? 'rgba(200,150,255,0.9)' 
                      : 'rgba(200,150,255,0.3)',
                    transition: 'all 0.3s ease',
                    boxShadow: i === actual ? '0 0 12px rgba(200,150,255,0.6)' : 'none',
                  }}
                />
              ))}
            </div>

            {/* Info de reproducción */}
            {hablando && (
              <div style={{
                position: 'relative',
                padding: '1rem 2rem',
                borderRadius: '12px',
                border: '1px solid rgba(200,150,255,0.4)',
                background: 'rgba(200,150,255,0.08)',
                backdropFilter: 'blur(4px)',
                animation: 'fadein 0.6s ease-out',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.8rem',
                  justifyContent: 'center',
                }}>
                  <div style={{
                    display: 'flex',
                    gap: '3px',
                  }}>
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        style={{
                          width: '3px',
                          height: '12px',
                          borderRadius: '2px',
                          background: 'rgba(200,150,255,0.8)',
                          animation: `pulse ${0.8 + i * 0.1}s ease-in-out infinite`,
                          animationDelay: `${i * 0.1}s`,
                        }}
                      />
                    ))}
                  </div>
                  <span style={{
                    fontSize: '0.85rem',
                    color: 'rgba(200,150,255,0.8)',
                    letterSpacing: '0.05em',
                  }}>
                    reproduciendo...
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{estilos}</style>
    </main>
  )
}