"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"

interface FrameScrubberProps {
  src: string
}

export default function FrameScrubber({ src }: FrameScrubberProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [velocity, setVelocity] = useState(0)
  const [lastX, setLastX] = useState(0)
  const [lastTime, setLastTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const animationRef = useRef<number>()

  const handleStart = useCallback((clientX: number) => {
    setIsDragging(true)
    setLastX(clientX)
    setLastTime(Date.now())
    setVelocity(0)
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
  }, [])

  const handleMove = useCallback(
    (clientX: number) => {
      if (!isDragging || !videoRef.current) return

      const deltaX = clientX - lastX
      const deltaTime = Date.now() - lastTime

      if (deltaTime > 0) {
        const newVelocity = deltaX / deltaTime
        setVelocity(newVelocity)
      }

      setLastX(clientX)
      setLastTime(Date.now())

      const container = containerRef.current
      if (container && duration > 0) {
        const sensitivity = duration / (container.offsetWidth * 0.5) // 2x more sensitive
        const timeChange = deltaX * sensitivity

        let newTime = videoRef.current.currentTime + timeChange
        if (newTime < 0) {
          newTime = duration + newTime // Loop to end
        } else if (newTime > duration) {
          newTime = newTime - duration // Loop to start
        }

        videoRef.current.currentTime = newTime
      }
    },
    [isDragging, lastX, lastTime, duration],
  )

  const handleEnd = useCallback(() => {
    setIsDragging(false)

    const animate = () => {
      setVelocity((prev) => {
        const friction = window.innerWidth < 768 ? 0.85 : 0.92 // More friction on mobile
        const newVelocity = prev * friction

        if (Math.abs(newVelocity) < 0.1) {
          return 0
        }

        const container = containerRef.current
        if (container && videoRef.current && duration > 0) {
          const sensitivity = duration / (container.offsetWidth * 0.5)
          const timeChange = newVelocity * sensitivity * 2

          let newTime = videoRef.current.currentTime + timeChange
          if (newTime < 0) {
            newTime = duration + newTime
          } else if (newTime > duration) {
            newTime = newTime - duration
          }

          videoRef.current.currentTime = newTime
        }

        animationRef.current = requestAnimationFrame(animate)
        return newVelocity
      })
    }

    if (Math.abs(velocity) > 0.1) {
      animate()
    }
  }, [velocity, duration])

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()

      if (!videoRef.current || duration === 0) return

      const sensitivity = 0.02 // 2x more sensitive
      const timeChange = (e.deltaX + e.deltaY) * sensitivity

      let newTime = videoRef.current.currentTime + timeChange
      if (newTime < 0) {
        newTime = duration + newTime
      } else if (newTime > duration) {
        newTime = newTime - duration
      }

      videoRef.current.currentTime = newTime
    },
    [duration],
  )

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    handleStart(e.clientX)
  }

  // Touch events - Improved for iPhone
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      // Only single touch
      handleStart(e.touches[0].clientX)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      // Only single touch
      handleMove(e.touches[0].clientX)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    handleEnd()
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener("wheel", handleWheel, { passive: false })
    return () => container.removeEventListener("wheel", handleWheel)
  }, [handleWheel])

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

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  // Cleanup
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
      onContextMenu={(e) => e.preventDefault()} // Disable right-click
    >
      <video
        ref={videoRef}
        src={src}
        className="block touch-none object-cover w-full h-full"
        muted
        playsInline
        preload="auto" // Changed to auto for better preloading
        onLoadedMetadata={handleLoadedMetadata}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        draggable={false} // Disable dragging
        style={{
          WebkitUserSelect: "none",
          userSelect: "none",
          WebkitTouchCallout: "none",
        }}
      />
    </div>
  )
}
