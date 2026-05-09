'use client'
import { useState, useRef } from 'react'
import type { FFmpeg } from '@ffmpeg/ffmpeg'

export type UploadStage = 'idle' | 'transcoding' | 'encrypting' | 'uploading' | 'done'

export function useVideoUpload() {
  const ffmpegRef = useRef<FFmpeg | null>(null)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState<UploadStage>('idle')

  async function loadFFmpeg() {
    if (ffmpegRef.current?.loaded) return

    // Dynamic import avoids SSR crash
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    const { toBlobURL } = await import('@ffmpeg/util')

    const ffmpeg = new FFmpeg()
    ffmpegRef.current = ffmpeg

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })

    ffmpeg.on('progress', ({ progress: p }) => setProgress(Math.round(p * 100)))
  }

  async function transcodeAndUpload(
    file: File,
    contentKey: Uint8Array,
    uploadFn: (data: Uint8Array, filename: string) => Promise<string>
  ): Promise<{ manifestCID: string; thumbnailCID: string }> {
    setStage('transcoding')
    setProgress(0)

    await loadFFmpeg()
    const ffmpeg = ffmpegRef.current!
    const { fetchFile } = await import('@ffmpeg/util')
    const { encryptContent } = await import('@/lib/crypto')
    const gateway = process.env.NEXT_PUBLIC_SWARM_GATEWAY ?? 'https://api.gateway.ethswarm.org'

    await ffmpeg.writeFile('input.mp4', await fetchFile(file))

    // Extract thumbnail at 1s
    await ffmpeg.exec(['-i', 'input.mp4', '-ss', '00:00:01', '-vframes', '1', '-q:v', '2', 'thumb.jpg'])

    // Transcode to HLS (single quality tier)
    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-c:v', 'libx264', '-crf', '28', '-preset', 'fast',
      '-c:a', 'aac',
      '-hls_time', '6',
      '-hls_list_size', '0',
      '-hls_segment_filename', 'segment%03d.ts',
      'index.m3u8',
    ])

    setStage('uploading')

    // Upload thumbnail (public, no encryption)
    const thumbData = await ffmpeg.readFile('thumb.jpg') as Uint8Array
    const thumbnailCID = await uploadFn(thumbData, 'thumb.jpg')

    // Encrypt and upload each segment
    setStage('encrypting')
    const segmentCIDs: string[] = []
    let i = 0
    while (true) {
      const segName = `segment${String(i).padStart(3, '0')}.ts`
      let segData: Uint8Array
      try {
        segData = await ffmpeg.readFile(segName) as Uint8Array
      } catch {
        break
      }

      const { ciphertext, iv } = await encryptContent(segData, contentKey)
      // Prepend 12-byte IV to ciphertext
      const blob = new Uint8Array(12 + ciphertext.byteLength)
      blob.set(iv, 0)
      blob.set(ciphertext, 12)

      setStage('uploading')
      const cid = await uploadFn(blob, segName)
      segmentCIDs.push(cid)
      setProgress(Math.round((i / Math.max(segmentCIDs.length + 1, 1)) * 100))
      i++
    }

    // Build m3u8 manifest with Swarm gateway URLs
    const manifest = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-TARGETDURATION:6',
      ...segmentCIDs.flatMap(cid => ['#EXTINF:6.0,', `${gateway}/bzz/${cid}`]),
      '#EXT-X-ENDLIST',
    ].join('\n')

    const manifestCID = await uploadFn(new TextEncoder().encode(manifest), 'index.m3u8')

    setStage('done')
    setProgress(100)

    return { manifestCID, thumbnailCID }
  }

  return { transcodeAndUpload, progress, stage }
}
