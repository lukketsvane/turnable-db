"use client"

import type React from "react"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"

interface UploadData {
  name: string
  symbol: string
  number: string
  specs: string
  textNo: string
  textJa: string
  file: File | null
}

export default function Puttekasse() {
  const router = useRouter()
  const [uploadData, setUploadData] = useState<UploadData>({
    name: "",
    symbol: "Sc",
    number: "",
    specs: "",
    textNo: "",
    textJa: "",
    file: null,
  })
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    const getNextNumber = async () => {
      try {
        const manifestRes = await fetch("/data/index.json", { cache: "no-store" })
        const files: string[] = await manifestRes.json()

        // Extract numbers from existing files and find the next available number
        const existingNumbers = files
          .map((file) => {
            const match = file.match(/^(\d+)_/)
            return match ? Number.parseInt(match[1], 10) : 0
          })
          .filter((num) => num > 0)

        const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1

        setUploadData((prev) => ({
          ...prev,
          number: nextNumber.toString().padStart(2, "0"),
        }))
      } catch (err) {
        console.error("Failed to get next number:", err)
        setUploadData((prev) => ({ ...prev, number: "01" }))
      }
    }

    getNextNumber()
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const mp4File = files.find((file) => file.type === "video/mp4")

    if (mp4File) {
      setUploadData((prev) => ({ ...prev, file: mp4File }))
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === "video/mp4") {
      setUploadData((prev) => ({ ...prev, file }))
    }
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!uploadData.file || !uploadData.name || !uploadData.number) return

      setIsUploading(true)

      try {
        const formData = new FormData()
        formData.append("file", uploadData.file)
        formData.append("name", uploadData.name)
        formData.append("number", uploadData.number)
        formData.append("symbol", uploadData.symbol)
        formData.append("specs", uploadData.specs)
        formData.append("textNo", uploadData.textNo)
        formData.append("textJa", uploadData.textJa)

        // Create YAML content
        const yamlContent = `id: "${uploadData.number}"
symbol: "${uploadData.symbol}"
number: "${uploadData.number}"
name: "${uploadData.name}"
video: "/data/${uploadData.number}_${uploadData.name.toLowerCase().replace(/\s+/g, "")}.mp4"
thumbVideo: "/data/${uploadData.number}_${uploadData.name.toLowerCase().replace(/\s+/g, "")}.mp4"
specs: "${uploadData.specs}"
i18n:
  no:
    name: "${uploadData.name}"
    text: "${uploadData.textNo}"
  ja:
    name: "${uploadData.name}"
    text: "${uploadData.textJa}"`

        // For now, just log the data and show success
        console.log("YAML Content:", yamlContent)
        console.log("Upload data:", uploadData)

        // Simulate upload delay
        await new Promise((resolve) => setTimeout(resolve, 2000))

        alert("Upload successful! (Demo mode - files logged to console)")

        // Reset form
        setUploadData({
          name: "",
          symbol: "Sc",
          number: "",
          specs: "",
          textNo: "",
          textJa: "",
          file: null,
        })

        // Get next number for new upload
        const manifestRes = await fetch("/data/index.json", { cache: "no-store" })
        const files: string[] = await manifestRes.json()
        const existingNumbers = files
          .map((file) => {
            const match = file.match(/^(\d+)_/)
            return match ? Number.parseInt(match[1], 10) : 0
          })
          .filter((num) => num > 0)
        const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1
        setUploadData((prev) => ({
          ...prev,
          number: nextNumber.toString().padStart(2, "0"),
        }))
      } catch (error) {
        console.error("Upload failed:", error)
        alert("Upload failed. Please try again.")
      }

      setIsUploading(false)
    },
    [uploadData],
  )

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-xl mx-auto">
        <div className="flex justify-end mb-4">
          <button
            onClick={() => router.push("/")}
            className="px-3 py-1 text-sm bg-white/10 hover:bg-white/20 border border-white/20 rounded transition-all duration-200"
          >
            ←
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center transition-all duration-200 ${
              isDragging ? "border-white bg-white/10" : "border-white/30 hover:border-white/50"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {uploadData.file ? (
              <div>
                <div className="text-green-400 text-sm">✓ {uploadData.file.name}</div>
              </div>
            ) : (
              <div>
                <div className="text-2xl mb-2">📹</div>
                <input type="file" accept="video/mp4" onChange={handleFileSelect} className="hidden" id="file-input" />
                <label
                  htmlFor="file-input"
                  className="inline-block px-3 py-1 text-sm bg-white/10 hover:bg-white/20 border border-white/20 rounded cursor-pointer transition-all duration-200"
                >
                  Select MP4
                </label>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1">Name</label>
              <input
                type="text"
                value={uploadData.name}
                onChange={(e) => setUploadData((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded focus:outline-none focus:border-white/50"
                required
              />
            </div>

            <div>
              <label className="block text-xs mb-1">#</label>
              <input
                type="text"
                value={uploadData.number}
                onChange={(e) => setUploadData((prev) => ({ ...prev, number: e.target.value }))}
                className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded focus:outline-none focus:border-white/50"
                readOnly
              />
            </div>

            <div>
              <label className="block text-xs mb-1">Symbol</label>
              <select
                value={uploadData.symbol}
                onChange={(e) => setUploadData((prev) => ({ ...prev, symbol: e.target.value }))}
                className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded focus:outline-none focus:border-white/50"
              >
                <option value="Sc">Sc</option>
                <option value="Kr">Kr</option>
                <option value="Fl">Fl</option>
                <option value="Br">Br</option>
                <option value="Px">Px</option>
              </select>
            </div>

            <div>
              <label className="block text-xs mb-1">Specs</label>
              <input
                type="text"
                value={uploadData.specs}
                onChange={(e) => setUploadData((prev) => ({ ...prev, specs: e.target.value }))}
                className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded focus:outline-none focus:border-white/50"
                // Removed placeholder text
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1">NO</label>
              <textarea
                value={uploadData.textNo}
                onChange={(e) => setUploadData((prev) => ({ ...prev, textNo: e.target.value }))}
                className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded focus:outline-none focus:border-white/50 h-16 resize-none"
                // Removed placeholder text
              />
            </div>

            <div>
              <label className="block text-xs mb-1">JA</label>
              <textarea
                value={uploadData.textJa}
                onChange={(e) => setUploadData((prev) => ({ ...prev, textJa: e.target.value }))}
                className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded focus:outline-none focus:border-white/50 h-16 resize-none"
                // Removed placeholder text
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!uploadData.file || !uploadData.name || !uploadData.number || isUploading}
            className="w-full py-2 text-sm bg-white text-black font-medium rounded hover:bg-gray-200 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isUploading ? "..." : "Upload"}
          </button>
        </form>
      </div>
    </div>
  )
}
