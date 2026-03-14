"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"

interface GifScrubberProps {
  src: string
  thumbnail?: string
}

export default function GifScrubber({ src, thumbnail }: GifScrubberProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [frames, setFrames] = useState<ImageBitmap[]>([])
  const [currentFrame, setCurrentFrame] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [velocity, setVelocity] = useState(0)
  const [lastX, setLastX] = useState(0)
  const [lastTime, setLastTime] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const [showThumbnail, setShowThumbnail] = useState(!!thumbnail)
  const animationRef = useRef<number>()

  const extractFrames = useCallback(async () => {
    try {
      const response = await fetch(src)
      const blob = await response.blob()

      // Create video element to extract frames from GIF
      const video = document.createElement("video")
      video.src = URL.createObjectURL(blob)
      video.muted = true
      video.playsInline = true

      await new Promise((resolve) => {
        video.addEventListener("loadedmetadata", resolve, { once: true })
      })

      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")!
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const extractedFrames: ImageBitmap[] = []
      const frameCount = Math.min(36, Math.floor(video.duration * 12)) // 12 FPS, max 36 frames

      for (let i = 0; i < frameCount; i++) {
        video.currentTime = (i / frameCount) * video.duration
        await new Promise((resolve) => {
          video.addEventListener("seeked", resolve, { once: true })
        })

        ctx.drawImage(video, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const bitmap = await createImageBitmap(imageData)
        extractedFrames.push(bitmap)
      }

      setFrames(extractedFrames)
      setIsLoaded(true)
      URL.revokeObjectURL(video.src)
    } catch (error) {
      console.error("[v0] GIF frame extraction failed:", error)
    }
  }, [src])

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || frames.length === 0) return

    const ctx = canvas.getContext("2d")!
    const frame = frames[currentFrame]
    if (frame) {
      canvas.width = frame.width
      canvas.height = frame.height
      ctx.drawImage(frame, 0, 0)
    }
  }, [frames, currentFrame])

  const handleStart = useCallback((clientX: number) => {
    setIsDragging(true)
    setLastX(clientX)
    setLastTime(Date.now())
    setVelocity(0)
    setShowThumbnail(false)
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
  }, [])

  const handleMove = useCallback(
    (clientX: number) => {
      if (!isDragging || frames.length === 0) return

      const deltaX = clientX - lastX
      const deltaTime = Date.now() - lastTime

      if (deltaTime > 0) {
        const newVelocity = deltaX / deltaTime
        setVelocity(newVelocity)
      }

      setLastX(clientX)
      setLastTime(Date.now())

      const container = containerRef.current
      if (container) {
        const sensitivity = frames.length / (container.offsetWidth * 0.125) // 8x more sensitive
        const frameChange = deltaX * sensitivity

        let newFrame = currentFrame + frameChange
        while (newFrame < 0) newFrame += frames.length
        while (newFrame >= frames.length) newFrame -= frames.length

        setCurrentFrame(Math.floor(newFrame))
      }
    },
    [isDragging, lastX, lastTime, frames.length, currentFrame],
  )

  const handleEnd = useCallback(() => {
    setIsDragging(false)

    const animate = () => {
      setVelocity((prev) => {
        const friction = window.innerWidth < 768 ? 0.8 : 0.9
        const newVelocity = prev * friction

        if (Math.abs(newVelocity) < 0.1) {
          return 0
        }

        const container = containerRef.current
        if (container && frames.length > 0) {
          const sensitivity = frames.length / (container.offsetWidth * 0.125)
          const frameChange = newVelocity * sensitivity * 3

          setCurrentFrame((prev) => {
            let newFrame = prev + frameChange
            while (newFrame < 0) newFrame += frames.length
            while (newFrame >= frames.length) newFrame -= frames.length
            return Math.floor(newFrame)
          })
        }

        animationRef.current = requestAnimationFrame(animate)
        return newVelocity
      })
    }

    if (Math.abs(velocity) > 0.1) {
      animate()
    }
  }, [velocity, frames.length])

  // Touch events - optimized for iPhone
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      handleStart(e.touches[0].clientX)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      handleMove(e.touches[0].clientX)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    handleEnd()
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    handleStart(e.clientX)
  }

  // Global mouse events
  useEffect(() => {
    if (!isDragging) return

    const handleGlobalMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX)
    }

    const handleGlobalMouseUp = () => {
      handleEnd()
    }

    document.addEventListener("mousemove", handleGlobalMouseMove)
    document.addEventListener("mouseup", handleGlobalMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove)
      document.removeEventListener("mouseup", handleGlobalMouseUp)
    }
  }, [isDragging, handleMove, handleEnd])

  useEffect(() => {
    extractFrames()
  }, [extractFrames])

  useEffect(() => {
    renderFrame()
  }, [renderFrame])

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative cursor-grab active:cursor-grabbing select-none w-full h-full"
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {thumbnail && showThumbnail && (
        <img
          src={thumbnail || "/placeholder.svg"}
          alt="Thumbnail"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 pointer-events-none"
          style={{
            WebkitUserSelect: "none",
            userSelect: "none",
          }}
        />
      )}

      <canvas
        ref={canvasRef}
        className={`block w-full h-full object-cover transition-opacity duration-300 ${
          showThumbnail ? "opacity-0" : "opacity-100"
        }`}
        style={{
          WebkitUserSelect: "none",
          userSelect: "none",
          WebkitTouchCallout: "none",
        }}
      />

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
