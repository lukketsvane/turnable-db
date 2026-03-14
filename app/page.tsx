"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"

interface ChairItem {
  id: string
  symbol: string
  number: string
  name: string
  video: string
  thumbVideo: string
  thumb?: string
  fullImage?: string
  source?: string
  text: string
  specs: string
  producer: string
  year: string
  materials: string
  techniques: string
  classification: string
  inventoryNr: string
  acquisition: string
  photo: string
  location: string
}

class Turntable {
  container: HTMLElement
  video: HTMLVideoElement
  isDragging = false
  startX = 0
  velocity = 0
  lastX = 0
  lastTime = 0
  animationFrameId: number | null = null
  friction = 0.96
  targetTime = 0
  velocityHistory: Array<{ velocity: number; time: number }> = []
  maxVelocityHistory = 5
  smoothingFactor = 0.15
  minVelocity = 0.001
  currentFloatTime = 0

  constructor(container: HTMLElement, video: HTMLVideoElement) {
    this.container = container
    this.video = video
    this.currentFloatTime = video.currentTime || 0
    this.targetTime = this.currentFloatTime
    this.bindEvents()
    this.animationFrameId = requestAnimationFrame(this.update.bind(this))
  }

  bindEvents() {
    this.container.style.userSelect = "none"
    this.container.style.touchAction = "none" // Prevents scrolling while rotating

    this.container.addEventListener("mousedown", this.handleStart.bind(this))
    this.container.addEventListener("touchstart", this.handleStart.bind(this), { passive: false })
    
    window.addEventListener("mousemove", this.handleMove.bind(this))
    window.addEventListener("touchmove", this.handleMove.bind(this), { passive: false })
    
    window.addEventListener("mouseup", this.handleEnd.bind(this))
    window.addEventListener("touchend", this.handleEnd.bind(this))
    this.container.addEventListener("wheel", this.handleWheel.bind(this), { passive: false })
  }

  destroy() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId)
    // Cleanup window listeners would be good here in a real React effect cleanup
  }

  handleWheel(e: WheelEvent) {
    if (!this.video.duration) return
    e.preventDefault() // Prevent page scroll
    
    // Choose the dominant scroll direction
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    
    // Add to target time (adjustable sensitivity)
    this.targetTime += (delta / this.container.offsetWidth) * this.video.duration * 1.5
    
    // Reset velocity and history to avoid conflicts with drag momentum
    this.velocity = 0
    this.velocityHistory = []
  }

  handleStart(e: MouseEvent | TouchEvent) {
    if (!this.video.duration || !isFinite(this.video.duration)) return
    
    this.isDragging = true
    const x = "touches" in e ? e.touches[0].pageX : e.pageX
    this.startX = x
    this.lastX = x
    this.lastTime = performance.now()
    this.velocity = 0
    this.velocityHistory = []
    this.container.style.cursor = "grabbing"
  }

  handleMove(e: MouseEvent | TouchEvent) {
    if (!this.isDragging || !this.video.duration) return
    
    const currentTime = performance.now()
    const x = "touches" in e ? e.touches[0].pageX : e.pageX
    const delta = x - this.lastX
    const timeDelta = currentTime - this.lastTime
    
    if (timeDelta > 0) {
      const instantVelocity = (delta / timeDelta) * 16.67
      this.velocityHistory.push({ velocity: instantVelocity, time: currentTime })
      if (this.velocityHistory.length > this.maxVelocityHistory) this.velocityHistory.shift()
    }
    
    this.lastX = x
    this.lastTime = currentTime
    
    // Smooth 1:1 mapping for 4s video
    this.targetTime += (delta / this.container.offsetWidth) * this.video.duration * 1.0
  }

  handleEnd() {
    if (!this.isDragging) return
    this.isDragging = false
    this.container.style.cursor = "grab"
    
    if (this.velocityHistory.length > 0) {
      const recentHistory = this.velocityHistory.slice(-3)
      const avgVelocity = recentHistory.reduce((s, it) => s + it.velocity, 0) / recentHistory.length
      this.velocity = avgVelocity * 2
    }
  }

  update() {
    if (!this.video.duration || !isFinite(this.video.duration)) {
      this.animationFrameId = requestAnimationFrame(this.update.bind(this))
      return
    }

    if (!this.isDragging) {
      if (Math.abs(this.velocity) > this.minVelocity) {
        this.targetTime += (this.velocity / this.container.offsetWidth) * this.video.duration
        this.velocity *= this.friction
      } else {
        this.velocity = 0
      }
    }

    const smoothing = this.isDragging ? 0.4 : this.smoothingFactor
    let newTime = this.currentFloatTime + (this.targetTime - this.currentFloatTime) * smoothing
    
    // Seamless loop wrap
    newTime = ((newTime % this.video.duration) + this.video.duration) % this.video.duration
    
    if (isFinite(newTime)) {
      this.currentFloatTime = newTime
      this.targetTime = newTime

      // Snap to exact 24fps frame
      const fps = 24
      const snappedTime = Math.round(newTime * fps) / fps
      
      // Update video if we moved to a new frame
      if (Math.abs(this.video.currentTime - snappedTime) > 0.001) {
        this.video.currentTime = snappedTime
      }
    }
    
    this.animationFrameId = requestAnimationFrame(this.update.bind(this))
  }
}

const formatName = (s: string) => {
  if (!s) return ""
  return s.split(/\s+/).map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w).join(" ")
}

export default function Home() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [galleryData, setGalleryData] = useState<ChairItem[]>([])
  const [currentItem, setCurrentItem] = useState<ChairItem | null>(null)
  const turntableRef = useRef<Turntable | null>(null)

  useEffect(() => {
    fetch(`/data/chairs.json?t=${Date.now()}`, { cache: "no-store" })
      .then(res => res.json())
      .then(setGalleryData)
      .catch(err => console.error("Feil ved lasting av stolar:", err))
  }, [])

  useEffect(() => {
    const itemId = searchParams.get("item")
    if (itemId) {
      const item = galleryData.find(d => d.id === itemId)
      if (item) setCurrentItem(item)
    } else {
      setCurrentItem(null)
    }
  }, [searchParams, galleryData])

  useEffect(() => {
    if (currentItem) {
      const video = document.getElementById("detail-video") as HTMLVideoElement
      const container = document.getElementById("turntable-container")
      if (video && container) {
        if (turntableRef.current) turntableRef.current.destroy()
        
        const handleReady = () => {
          turntableRef.current = new Turntable(container, video)
        }
        
        if (video.readyState >= 2) {
          handleReady()
        } else {
          video.addEventListener("loadeddata", handleReady, { once: true })
        }
      }
    }
    return () => turntableRef.current?.destroy()
  }, [currentItem])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentItem || galleryData.length === 0) return
      
      const currentIndex = galleryData.findIndex(d => d.id === currentItem.id)
      if (currentIndex === -1) return

      if (e.key === "Escape") {
        router.push("/")
      } else if (e.key === "ArrowRight") {
        const nextIndex = (currentIndex + 1) % galleryData.length
        router.push(`/?item=${galleryData[nextIndex].id}`)
      } else if (e.key === "ArrowLeft") {
        const prevIndex = (currentIndex - 1 + galleryData.length) % galleryData.length
        router.push(`/?item=${galleryData[prevIndex].id}`)
      }
    }
    
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentItem, galleryData, router])

  // Swipe navigation (iOS gestures)
  useEffect(() => {
    if (!currentItem || galleryData.length === 0) return
    
    let touchStartX = 0
    let touchStartY = 0
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX
      touchStartY = e.touches[0].clientY
    }
    
    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX
      const touchEndY = e.changedTouches[0].clientY
      
      const dx = touchEndX - touchStartX
      const dy = touchEndY - touchStartY
      
      const target = e.target as HTMLElement
      const isTurntable = target.closest("#turntable-container")
      
      // If we're interacting with the turntable and it has a video, don't trigger horizontal swipe
      const ignoreHorizontal = isTurntable && currentItem.video
      
      const currentIndex = galleryData.findIndex(d => d.id === currentItem.id)
      if (currentIndex === -1) return
      
      // Horizontal swipe (threshold: 50px)
      if (!ignoreHorizontal && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        if (dx < 0) {
          // Swipe left -> Next item
          const nextIndex = (currentIndex + 1) % galleryData.length
          router.push(`/?item=${galleryData[nextIndex].id}`)
        } else {
          // Swipe right -> Prev item
          const prevIndex = (currentIndex - 1 + galleryData.length) % galleryData.length
          router.push(`/?item=${galleryData[prevIndex].id}`)
        }
      } 
      // Vertical swipe down to close (threshold: 70px)
      else if (dy > 70 && Math.abs(dy) > Math.abs(dx)) {
        router.push("/")
      }
    }
    
    window.addEventListener("touchstart", handleTouchStart)
    window.addEventListener("touchend", handleTouchEnd)
    return () => {
      window.removeEventListener("touchstart", handleTouchStart)
      window.removeEventListener("touchend", handleTouchEnd)
    }
  }, [currentItem, galleryData, router])

  const renderGridItem = (item: ChairItem | null, i: number) => {
    if (!item) return <div key={`empty-${i}`} className="aspect-square border-black/5" style={{ borderWidth: "0.5px" }} />

    return (
      <div 
        key={item.id}
        onClick={() => router.push(`/?item=${item.id}`)}
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            const target = e.currentTarget as HTMLElement
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
            target.dataset.pinchStart = dist.toString()
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2) {
            const target = e.currentTarget as HTMLElement
            const startDist = parseFloat(target.dataset.pinchStart || "0")
            if (startDist > 0) {
              const currentDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
              if (currentDist - startDist > 40) { // Pinch out threshold
                target.dataset.pinchStart = "0"
                router.push(`/?item=${item.id}`)
              }
            }
          }
        }}
        className="relative aspect-square border-black/40 cursor-pointer bg-white group hover:opacity-70 transition-all duration-300"
        style={{ borderWidth: "0.5px" }}
      >
        <div className="absolute top-1 left-1 font-mono font-bold text-[9px] text-black/80">{item.symbol}</div>
        <div className="absolute top-1 right-1 font-mono font-bold text-[9px] text-black/80">{item.number}</div>
        
        <div className="flex flex-col items-center justify-center h-full p-2">
          <div className="flex-1 flex items-center justify-center w-full overflow-hidden">
            <img src={item.thumb} alt={item.name} className="max-w-full max-h-full object-contain" />
          </div>
          <div className="text-black font-sans font-bold text-[9px] mt-1 truncate w-full text-center uppercase tracking-tighter">
            {formatName(item.name)}
          </div>
        </div>
      </div>
    )
  }

  if (currentItem) {
    return (
      <div className="min-h-screen bg-white text-black flex flex-col lg:flex-row overflow-hidden">
        {/* Mobile Nav */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center bg-white/80 backdrop-blur-md">
          <button onClick={() => router.push("/")} className="font-mono font-black uppercase text-xs">← Tilbake</button>
        </div>

        {/* Desktop Sidebar Info */}
        <div 
          onClick={() => router.push("/")}
          className="hidden lg:flex flex-col fixed top-12 left-12 z-40 cursor-pointer hover:opacity-70 transition-opacity"
        >
          <div className="font-mono font-black text-8xl leading-none tracking-tighter pointer-events-none">{currentItem.symbol}</div>
          <div className="font-mono font-black text-4xl mt-2 tracking-tighter pointer-events-none">{currentItem.number}</div>
          <div className="font-sans font-black text-xl mt-4 max-w-xs uppercase leading-tight pointer-events-none">{formatName(currentItem.name)}</div>
        </div>

        <button 
          onClick={() => router.push("/")}
          className="hidden lg:flex fixed top-8 right-12 z-50 font-mono font-black uppercase text-xs hover:line-through"
        >
          Lukk
        </button>

        {/* Main 3D View */}
        <div className="flex-1 flex items-center justify-center bg-white relative">
          <div 
            id="turntable-container"
            className="w-full aspect-square max-w-[85vh] cursor-grab active:cursor-grabbing relative"
          >
            {currentItem.video ? (
              <video 
                key={currentItem.id}
                id="detail-video" 
                src={currentItem.video} 
                className="w-full h-full object-contain pointer-events-none" 
                muted playsInline 
              />
            ) : (
              <img key={currentItem.id} src={currentItem.fullImage || currentItem.thumb} className="w-full h-full object-contain" />
            )}
          </div>
        </div>

        {/* Metadata Sidebar */}
        <div className="lg:w-[450px] border-l border-gray-100 bg-gray-50/50 p-8 lg:p-16 overflow-y-auto h-screen">
          <div className="space-y-12 py-20 lg:py-0">
            <section>
              <h1 className="text-4xl font-sans font-black tracking-tighter uppercase leading-none mb-4">{formatName(currentItem.name)}</h1>
              <p className="font-mono text-gray-400 text-xs font-bold uppercase tracking-widest">{currentItem.year}</p>
            </section>

            <section className="space-y-4">
              <h2 className="font-mono font-black text-[10px] uppercase tracking-[0.3em] text-gray-300">Skildring</h2>
              <p className="text-lg font-serif leading-relaxed text-gray-800">{currentItem.text || "Skildring kjem snart..."}</p>
            </section>

            <div className="grid grid-cols-1 gap-y-8 border-t border-gray-100 pt-12">
              {[
                { label: "Mål", val: currentItem.specs, mono: true },
                { label: "Materialar", val: currentItem.materials },
                { label: "Teknikkar", val: currentItem.techniques },
                { label: "Stad", val: currentItem.location },
                { label: "Inventarnr", val: currentItem.inventoryNr, mono: true },
                { label: "Produsent", val: currentItem.producer }
              ].map(f => f.val && (
                <div key={f.label}>
                  <h3 className="font-mono font-black text-[9px] uppercase tracking-[0.2em] text-gray-300 mb-2">{f.label}</h3>
                  <p className={`text-sm font-bold ${f.mono ? 'font-mono' : 'font-sans'} text-black`}>{f.val}</p>
                </div>
              ))}
            </div>

            {currentItem.source && (
              <a href={currentItem.source} target="_blank" className="block pt-12 font-mono font-black text-[10px] uppercase tracking-widest hover:line-through">
                Sjå hos Nasjonalmuseet ↗
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white pb-40">
      <div className="container mx-auto px-6 pt-32 lg:pt-48">
        <h1 className="font-sans font-black text-6xl lg:text-[12rem] leading-[0.8] tracking-tighter mb-20 lg:mb-32">
          Norske<br/>stolar.
        </h1>
        
        <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-9 border-t border-l border-black/10">
          {galleryData.map((item, i) => renderGridItem(item, i))}
          {Array.from({ length: 18 }).map((_, i) => renderGridItem(null, i))}
        </div>
      </div>
    </div>
  )
}
