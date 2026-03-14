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

// --- Turntable class with proper cleanup ---

class Turntable {
  container: HTMLElement
  video: HTMLVideoElement
  isDragging = false
  startX = 0
  velocity = 0
  lastX = 0
  lastTime = 0
  animationFrameId: number | null = null
  friction: number
  targetTime = 0
  velocityHistory: Array<{ velocity: number; time: number }> = []
  maxVelocityHistory = 5
  smoothingFactor: number
  minVelocity = 0.001
  currentFloatTime = 0
  private boundHandleStart: (e: MouseEvent | TouchEvent) => void
  private boundHandleMove: (e: MouseEvent | TouchEvent) => void
  private boundHandleEnd: () => void
  private boundHandleWheel: (e: WheelEvent) => void
  onDragStateChange?: (dragging: boolean) => void

  constructor(container: HTMLElement, video: HTMLVideoElement, onDragStateChange?: (dragging: boolean) => void) {
    this.container = container
    this.video = video
    this.onDragStateChange = onDragStateChange
    this.currentFloatTime = video.currentTime || 0
    this.targetTime = this.currentFloatTime

    // Tune for mobile vs desktop
    const isMobile = window.innerWidth < 1024
    this.friction = isMobile ? 0.93 : 0.96
    this.smoothingFactor = isMobile ? 0.25 : 0.15

    this.boundHandleStart = this.handleStart.bind(this)
    this.boundHandleMove = this.handleMove.bind(this)
    this.boundHandleEnd = this.handleEnd.bind(this)
    this.boundHandleWheel = this.handleWheel.bind(this)

    this.bindEvents()
    this.animationFrameId = requestAnimationFrame(this.update.bind(this))
  }

  bindEvents() {
    this.container.style.userSelect = "none"
    this.container.style.touchAction = "none"

    this.container.addEventListener("mousedown", this.boundHandleStart)
    this.container.addEventListener("touchstart", this.boundHandleStart, { passive: false })
    window.addEventListener("mousemove", this.boundHandleMove)
    window.addEventListener("touchmove", this.boundHandleMove, { passive: false })
    window.addEventListener("mouseup", this.boundHandleEnd)
    window.addEventListener("touchend", this.boundHandleEnd)
    this.container.addEventListener("wheel", this.boundHandleWheel, { passive: false })
  }

  destroy() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId)
    this.container.removeEventListener("mousedown", this.boundHandleStart)
    this.container.removeEventListener("touchstart", this.boundHandleStart)
    window.removeEventListener("mousemove", this.boundHandleMove)
    window.removeEventListener("touchmove", this.boundHandleMove)
    window.removeEventListener("mouseup", this.boundHandleEnd)
    window.removeEventListener("touchend", this.boundHandleEnd)
    this.container.removeEventListener("wheel", this.boundHandleWheel)
  }

  handleWheel(e: WheelEvent) {
    if (!this.video.duration) return
    e.preventDefault()
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    this.targetTime += (delta / this.container.offsetWidth) * this.video.duration * 1.5
    this.velocity = 0
    this.velocityHistory = []
  }

  handleStart(e: MouseEvent | TouchEvent) {
    if (!this.video.duration || !isFinite(this.video.duration)) return
    this.isDragging = true
    this.onDragStateChange?.(true)
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
    this.targetTime += (delta / this.container.offsetWidth) * this.video.duration * 1.0
  }

  handleEnd() {
    if (!this.isDragging) return
    this.isDragging = false
    this.onDragStateChange?.(false)
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
    newTime = ((newTime % this.video.duration) + this.video.duration) % this.video.duration
    if (isFinite(newTime)) {
      this.currentFloatTime = newTime
      this.targetTime = newTime
      const fps = 24
      const snappedTime = Math.round(newTime * fps) / fps
      if (Math.abs(this.video.currentTime - snappedTime) > 0.001) {
        this.video.currentTime = snappedTime
      }
    }
    this.animationFrameId = requestAnimationFrame(this.update.bind(this))
  }
}

// --- Helpers ---

const formatName = (s: string) => {
  if (!s) return ""
  return s.split(/\s+/).map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w).join(" ")
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    setIsMobile(!window.matchMedia("(pointer: fine)").matches)
  }, [])
  return isMobile
}

// --- Grid Item (no autoPlay videos on mobile) ---

function GridItem({ item, onClick, isMobile }: { item: ChairItem; onClick: () => void; isMobile: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isActive, setIsActive] = useState(false)
  const [isDirectHover, setIsDirectHover] = useState(false)
  const [isRandomActive, setIsRandomActive] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [pinchScale, setPinchScale] = useState(1)
  const [isPinching, setIsPinching] = useState(false)
  const pinchStartDist = useRef(0)

  // Lazy-load via IntersectionObserver
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect() } },
      { rootMargin: "200px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Radial proximity effect (desktop only)
  useEffect(() => {
    if (isMobile) return
    if (!window.matchMedia("(pointer: fine)").matches) return
    let isTicking = false
    const handleMouseMove = (e: MouseEvent) => {
      if (isTicking) return
      isTicking = true
      requestAnimationFrame(() => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          const centerX = rect.left + rect.width / 2
          const centerY = rect.top + rect.height / 2
          const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY)
          const threshold = window.innerWidth > 1024 ? 180 : 120
          if (dist < threshold) {
            setIsActive(true)
            if (videoRef.current) {
              const speed = Math.max(0.1, 1.0 - (dist / threshold) * 0.9)
              videoRef.current.playbackRate = speed
            }
          } else {
            setIsActive(false)
          }
        }
        isTicking = false
      })
    }
    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [isMobile])

  // Random ambient movement (desktop only)
  useEffect(() => {
    if (isMobile) return
    const initialDelay = Math.random() * 5000
    let spinTimeout: NodeJS.Timeout
    let stopSpinTimeout: NodeJS.Timeout
    const startRandomSpin = () => {
      if (Math.random() < 0.10) {
        setIsRandomActive(true)
        if (videoRef.current) {
          videoRef.current.playbackRate = 0.3 + Math.random() * 0.4
        }
        const spinDuration = 2000 + Math.random() * 4000
        stopSpinTimeout = setTimeout(() => setIsRandomActive(false), spinDuration)
      }
      const nextCheck = 3000 + Math.random() * 7000
      spinTimeout = setTimeout(startRandomSpin, nextCheck)
    }
    spinTimeout = setTimeout(startRandomSpin, initialDelay)
    return () => { clearTimeout(spinTimeout); clearTimeout(stopSpinTimeout) }
  }, [isMobile])

  // Direct hover overrides ambient
  useEffect(() => {
    if (isDirectHover && videoRef.current) {
      videoRef.current.playbackRate = 1.0
    }
  }, [isDirectHover])

  const showVideo = !isMobile && (isActive || isDirectHover || isRandomActive) && !!item.thumbVideo

  // Preload full video on hover (desktop) to make detail view load faster
  const preloadedRef = useRef(false)
  const handlePreload = useCallback(() => {
    if (preloadedRef.current || !item.video) return
    preloadedRef.current = true
    const link = document.createElement("link")
    link.rel = "preload"
    link.as = "video"
    link.href = item.video
    document.head.appendChild(link)
  }, [item.video])

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => { setIsDirectHover(true); handlePreload() }}
      onMouseLeave={() => setIsDirectHover(false)}
      onClick={onClick}
      onTouchStart={(e) => {
        // Preload on touch start for faster detail view
        handlePreload()
        if (e.touches.length === 2) {
          const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
          pinchStartDist.current = dist
          setIsPinching(true)
        }
      }}
      onTouchMove={(e) => {
        if (e.touches.length === 2 && isPinching && pinchStartDist.current > 0) {
          const currentDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
          const scale = Math.min(2, Math.max(1, currentDist / pinchStartDist.current))
          setPinchScale(scale)
          if (currentDist - pinchStartDist.current > 40) {
            pinchStartDist.current = 0
            setIsPinching(false)
            setPinchScale(1)
            onClick()
          }
        }
      }}
      onTouchEnd={() => {
        if (isPinching) {
          setIsPinching(false)
          setPinchScale(1)
        }
      }}
      className="relative aspect-square border-black/40 cursor-pointer bg-white group transition-all duration-300"
      style={{
        borderWidth: "0.5px",
        transform: isPinching ? `scale(${pinchScale})` : "scale(1)",
        zIndex: isPinching ? 50 : "auto",
        transition: isPinching ? "none" : "transform 0.3s ease-out",
      } as React.CSSProperties}
    >
      <div className="absolute top-1 left-1 font-mono font-bold text-[9px] text-black/80 z-10">{item.symbol}</div>
      <div className="absolute top-1 right-1 font-mono font-bold text-[9px] text-black/80 z-10">{item.number}</div>

      <div className="flex flex-col items-center justify-center h-full p-2 relative">
        <div className="flex-1 flex items-center justify-center w-full overflow-hidden relative">
          {isVisible && (
            <img
              src={item.thumb}
              alt={item.name}
              loading="lazy"
              className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${showVideo ? "opacity-0" : "opacity-100"}`}
            />
          )}
          {!isMobile && item.thumbVideo && isVisible && (
            <video
              ref={videoRef}
              src={showVideo ? item.thumbVideo : undefined}
              poster={item.thumb}
              autoPlay={showVideo}
              loop
              muted
              playsInline
              preload="none"
              className={`absolute inset-0 w-full h-full object-contain mix-blend-multiply transition-opacity duration-300 ${showVideo ? "opacity-100" : "opacity-0"}`}
            />
          )}
        </div>
        <div className="text-black font-sans font-bold text-[9px] mt-1 truncate w-full text-center uppercase tracking-tighter">
          {formatName(item.name)}
        </div>
      </div>
    </div>
  )
}

// --- Metadata section (shared between mobile and desktop) ---

function MetadataContent({ item }: { item: ChairItem }) {
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="font-mono font-black text-[10px] uppercase tracking-[0.3em] text-gray-500">Skildring</h2>
        <p className="text-lg font-serif leading-relaxed text-gray-800">{item.text || "Skildring kjem snart..."}</p>
      </section>

      <div className="grid grid-cols-1 gap-y-6 border-t border-gray-100 pt-8">
        {[
          { label: "Mål", val: item.specs, mono: true },
          { label: "Materialar", val: item.materials },
          { label: "Teknikkar", val: item.techniques },
          { label: "Stad", val: item.location },
          { label: "Inventarnr", val: item.inventoryNr, mono: true },
          { label: "Produsent", val: item.producer },
        ].map(
          (f) =>
            f.val && (
              <div key={f.label}>
                <h3 className="font-mono font-black text-[12px] uppercase tracking-[0.2em] text-gray-500 mb-1">{f.label}</h3>
                <p className={`text-base font-bold ${f.mono ? "font-mono" : "font-sans"} text-black`}>{f.val}</p>
              </div>
            )
        )}
      </div>

      {item.source && (
        <a href={item.source} target="_blank" className="block pt-8 font-mono font-black text-[10px] uppercase tracking-widest hover:line-through">
          Sjå hos Nasjonalmuseet ↗
        </a>
      )}
    </div>
  )
}

// --- Loading skeleton ---

function LoadingSkeleton() {
  return (
    <div className="min-h-dvh bg-white text-black font-sans pb-40">
      <div className="container mx-auto px-4 sm:px-6 pt-24 lg:pt-48">
        <h1 className="font-sans font-black text-5xl lg:text-[12rem] leading-[0.8] tracking-tighter mb-12 lg:mb-32">
          Norske<br />stolar.
        </h1>
        <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-9 border-t border-l border-black/10">
          {Array.from({ length: 27 }).map((_, i) => (
            <div key={i} className="aspect-square border-black/5 animate-pulse bg-gray-50" style={{ borderWidth: "0.5px" }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// --- Main component ---

export default function Home() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [galleryData, setGalleryData] = useState<ChairItem[]>([])
  const [currentItem, setCurrentItem] = useState<ChairItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [videoReady, setVideoReady] = useState(false)
  const [turntableOpacity, setTurntableOpacity] = useState(1)
  const turntableRef = useRef<Turntable | null>(null)
  const isDraggingTurntable = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  // Load gallery data
  useEffect(() => {
    fetch(`/data/chairs.json?t=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => { setGalleryData(data); setIsLoading(false) })
      .catch((err) => { console.error("Feil ved lasting av stolar:", err); setIsLoading(false) })
  }, [])

  // URL → item sync
  useEffect(() => {
    const itemId = searchParams.get("item")
    if (itemId) {
      const item = galleryData.find((d) => d.id === itemId)
      if (item) setCurrentItem(item)
    } else {
      setCurrentItem(null)
    }
  }, [searchParams, galleryData])

  // Reset state when item changes
  useEffect(() => {
    setVideoReady(false)
    setTurntableOpacity(1)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [currentItem?.id])

  // Init turntable when video ready
  useEffect(() => {
    if (!currentItem) return
    const video = document.getElementById("detail-video") as HTMLVideoElement
    const container = document.getElementById("turntable-container")
    if (!video || !container) return

    if (turntableRef.current) turntableRef.current.destroy()

    const handleReady = () => {
      turntableRef.current = new Turntable(container, video, (dragging) => {
        isDraggingTurntable.current = dragging
      })
      setVideoReady(true)
    }

    if (video.readyState >= 2) {
      handleReady()
    } else {
      video.addEventListener("loadeddata", handleReady, { once: true })
    }

    return () => turntableRef.current?.destroy()
  }, [currentItem])

  // Preload adjacent videos
  useEffect(() => {
    if (!currentItem || galleryData.length === 0) return
    const idx = galleryData.findIndex((d) => d.id === currentItem.id)
    if (idx === -1) return
    const adjacent = [
      galleryData[(idx - 1 + galleryData.length) % galleryData.length],
      galleryData[(idx + 1) % galleryData.length],
    ]
    adjacent.forEach((item) => {
      if (!item.video) return
      const link = document.createElement("link")
      link.rel = "preload"
      link.as = "video"
      link.href = item.video
      document.head.appendChild(link)
    })
  }, [currentItem, galleryData])

  // Scroll-driven turntable fade (mobile)
  useEffect(() => {
    if (!isMobile || !currentItem) return
    const el = scrollRef.current
    if (!el) return
    const handleScroll = () => {
      const opacity = Math.max(0, 1 - el.scrollTop / 250)
      setTurntableOpacity(opacity)
    }
    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [isMobile, currentItem])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentItem || galleryData.length === 0) return
      const currentIndex = galleryData.findIndex((d) => d.id === currentItem.id)
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
      if (isDraggingTurntable.current) return
      const touchEndX = e.changedTouches[0].clientX
      const touchEndY = e.changedTouches[0].clientY
      const dx = touchEndX - touchStartX
      const dy = touchEndY - touchStartY
      const target = e.target as HTMLElement
      const isTurntable = target.closest("#turntable-container")
      const ignoreHorizontal = isTurntable && currentItem.video
      const currentIndex = galleryData.findIndex((d) => d.id === currentItem.id)
      if (currentIndex === -1) return
      if (!ignoreHorizontal && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        if (dx < 0) {
          const nextIndex = (currentIndex + 1) % galleryData.length
          router.push(`/?item=${galleryData[nextIndex].id}`)
        } else {
          const prevIndex = (currentIndex - 1 + galleryData.length) % galleryData.length
          router.push(`/?item=${galleryData[prevIndex].id}`)
        }
      } else if (dy > 70 && Math.abs(dy) > Math.abs(dx)) {
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

  // --- DETAIL VIEW ---

  if (currentItem) {
    // Mobile detail: fixed turntable that fades on scroll, content card scrolls over it
    if (isMobile) {
      return (
        <div ref={scrollRef} className="h-dvh bg-white text-black overflow-y-auto overscroll-none">
          {/* Back button */}
          <button
            onClick={() => router.push("/")}
            className="fixed z-50 font-mono font-black uppercase text-xs bg-white/90"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)", left: "1rem", padding: "0.25rem 0" }}
          >
            ← Tilbake
          </button>

          {/* Fixed turntable — fades out on scroll */}
          <div
            className="fixed inset-x-0 top-0 flex items-center justify-center pointer-events-none"
            style={{
              height: "43dvh",
              paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)",
              opacity: turntableOpacity,
              transition: "opacity 0.05s linear",
            }}
          >
            <div
              id="turntable-container"
              className="w-full aspect-square cursor-grab active:cursor-grabbing relative pointer-events-auto"
              style={{ maxWidth: "min(80vw, 42dvh)" }}
            >
              {/* Static image shown immediately, fades out when video ready */}
              <img
                src={currentItem.fullImage || currentItem.thumb}
                alt={currentItem.name}
                className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${videoReady ? "opacity-0" : "opacity-100"}`}
              />
              {currentItem.video ? (
                <video
                  key={currentItem.id}
                  id="detail-video"
                  src={currentItem.video}
                  className={`w-full h-full object-contain pointer-events-none transition-opacity duration-500 ${videoReady ? "opacity-100" : "opacity-0"}`}
                  muted
                  playsInline
                  preload="auto"
                />
              ) : (
                <img
                  key={currentItem.id}
                  src={currentItem.fullImage || currentItem.thumb}
                  className="w-full h-full object-contain"
                />
              )}
              {/* Loading spinner */}
              {!videoReady && currentItem.video && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Spacer — pushes content card below turntable */}
          <div style={{ height: "33dvh" }} />

          {/* Content card — scrolls up over the fading turntable */}
          <div
            className="relative z-10 bg-white min-h-[55dvh] px-6 pt-5 shadow-[0_-2px_16px_rgba(0,0,0,0.06)]"
            style={{
              borderTopLeftRadius: "1.25rem",
              borderTopRightRadius: "1.25rem",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 3rem)",
            }}
          >
            {/* Drag handle */}
            <div className="mx-auto w-10 h-1 bg-gray-200 rounded-full mb-4" />

            {/* Title — tight to the handle */}
            <h1 className="text-3xl font-sans font-black tracking-tighter uppercase leading-none mb-1">
              {formatName(currentItem.name)}
            </h1>
            <p className="font-mono text-gray-500 text-xs font-bold uppercase tracking-widest mb-6">{currentItem.year}</p>

            <MetadataContent item={currentItem} />
          </div>
        </div>
      )
    }

    // Desktop detail (unchanged layout)
    return (
      <div className="min-h-dvh bg-white text-black flex flex-col lg:flex-row overflow-hidden">
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
            {/* Static image shown immediately */}
            <img
              src={currentItem.fullImage || currentItem.thumb}
              alt={currentItem.name}
              className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${videoReady ? "opacity-0" : "opacity-100"}`}
            />
            {currentItem.video ? (
              <video
                key={currentItem.id}
                id="detail-video"
                src={currentItem.video}
                className={`w-full h-full object-contain pointer-events-none transition-opacity duration-500 ${videoReady ? "opacity-100" : "opacity-0"}`}
                muted
                playsInline
                preload="auto"
              />
            ) : (
              <img key={currentItem.id} src={currentItem.fullImage || currentItem.thumb} className="w-full h-full object-contain" />
            )}
            {!videoReady && currentItem.video && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Metadata Sidebar */}
        <div className="lg:w-[450px] border-l border-gray-100 bg-gray-50/50 p-8 lg:p-12 overflow-y-auto h-dvh">
          <div className="space-y-8">
            <section>
              <h1 className="text-4xl font-sans font-black tracking-tighter uppercase leading-none mb-2">{formatName(currentItem.name)}</h1>
              <p className="font-mono text-gray-500 text-xs font-bold uppercase tracking-widest">{currentItem.year}</p>
            </section>
            <MetadataContent item={currentItem} />
          </div>
        </div>
      </div>
    )
  }

  // --- GRID VIEW ---

  if (isLoading) return <LoadingSkeleton />

  return (
    <div className="min-h-dvh bg-white text-black font-sans selection:bg-black selection:text-white pb-40">
      <div className="container mx-auto px-4 sm:px-6 pt-24 lg:pt-48">
        <h1 className="font-sans font-black text-5xl lg:text-[12rem] leading-[0.8] tracking-tighter mb-12 lg:mb-32">
          Norske<br />stolar.
        </h1>

        <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-9 border-t border-l border-black/10">
          {galleryData.map((item) => (
            <GridItem key={item.id} item={item} isMobile={isMobile} onClick={() => router.push(`/?item=${item.id}`)} />
          ))}
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square border-black/5" style={{ borderWidth: "0.5px" }} />
          ))}
        </div>
      </div>
    </div>
  )
}
