'use client'
import { useState } from 'react'

export type UploadStage = 'idle' | 'encrypting' | 'uploading' | 'done'

// Extract a JPEG thumbnail from a video file using canvas.
// Waits for metadata so we know the duration before seeking.
async function extractThumbnail(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const url = URL.createObjectURL(file)

    video.preload = 'metadata'

    video.onloadedmetadata = () => {
      // Seek to 10% of duration or 1s, whichever is smaller
      video.currentTime = Math.min(1, video.duration * 0.1)
    }

    video.onseeked = () => {
      if (!video.videoWidth || !video.videoHeight) {
        URL.revokeObjectURL(url)
        reject(new Error('Invalid video dimensions'))
        return
      }
      canvas.width = Math.min(video.videoWidth, 854)
      canvas.height = Math.round(canvas.width * (video.videoHeight / video.videoWidth))
      canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob(async blob => {
        if (!blob) { reject(new Error('Thumbnail extraction failed')); return }
        resolve(new Uint8Array(await blob.arrayBuffer()))
      }, 'image/jpeg', 0.8)
    }

    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Video load failed')) }
    video.src = url
    video.load()
  })
}

export function useVideoUpload() {
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState<UploadStage>('idle')

  async function transcodeAndUpload(
    file: File,
    contentKey: Uint8Array,
    uploadFn: (data: Uint8Array, filename?: string, contentType?: string) => Promise<string>
  ): Promise<{ manifestCID: string; thumbnailCID: string }> {
    const { encryptContent } = await import('@/lib/crypto')

    // ── Thumbnail (public, unencrypted) ──────────────────────────────────────
    setStage('encrypting')
    setProgress(10)
    let thumbnailCID = ''
    try {
      const thumb = await extractThumbnail(file)
      thumbnailCID = await uploadFn(thumb, 'thumb.jpg', 'image/jpeg')
    } catch {
      // Non-fatal — show gradient fallback on cards
    }
    setProgress(35)

    // ── Encrypt raw video ─────────────────────────────────────────────────────
    const videoData = new Uint8Array(await file.arrayBuffer())
    const { ciphertext, iv } = await encryptContent(videoData, contentKey)

    // Prepend 12-byte IV so the player can split it back out
    const blob = new Uint8Array(12 + ciphertext.byteLength)
    blob.set(iv, 0)
    blob.set(ciphertext, 12)
    setProgress(65)

    // ── Upload encrypted blob ─────────────────────────────────────────────────
    setStage('uploading')
    const manifestCID = await uploadFn(blob, file.name, 'application/octet-stream')
    setProgress(100)
    setStage('done')

    return { manifestCID, thumbnailCID }
  }

  return { transcodeAndUpload, progress, stage }
}
