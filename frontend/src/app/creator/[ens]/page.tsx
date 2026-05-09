'use client'
export const dynamic = 'force-dynamic'
import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount, useSignMessage } from 'wagmi'
import { keccak256, toBytes } from 'viem'
import { AppHeader } from '@/components/AppHeader'
import { Avatar, seededGradient } from '@/components/ui/Avatar'
import { EncryptionBadge } from '@/components/ui/EncryptionBadge'
import { Spinner } from '@/components/ui/Spinner'
import { useVideoUpload } from '@/hooks/useVideoUpload'
import { uploadToSwarm } from '@/lib/uploadHelper'
import { generateContentKey } from '@/lib/crypto'

interface Post {
  id: string
  title: string
  views: number
  publishedAgo: string
  manifestCID?: string
  thumbnailCID?: string
}

const MOCK_POSTS: Post[] = [
  { id: 'p_004', title: 'River, with no name — chapter 3',          views: 1820, publishedAgo: '2 days ago' },
  { id: 'p_003', title: 'River, with no name — chapter 2',          views: 2340, publishedAgo: '9 days ago' },
  { id: 'p_002', title: 'Field notes from a closed border',         views: 4108, publishedAgo: '3 weeks ago' },
  { id: 'p_001', title: 'How I encrypt before I think — a process', views: 6212, publishedAgo: '2 months ago' },
]

const UPLOAD_STAGES = [
  { id: 'select',    label: 'Select file',       detail: 'Pick a video to publish.' },
  { id: 'transcode', label: 'Transcoding',        detail: 'Re-encoding via ffmpeg.wasm to HLS segments.' },
  { id: 'encrypt',   label: 'Encrypting',         detail: 'AES-256-GCM, fresh key per post.' },
  { id: 'upload',    label: 'Uploading to Swarm', detail: 'Pinning encrypted segments.' },
  { id: 'publish',   label: 'Publishing',         detail: 'Writing post manifest.' },
]

function StageDot({ state }: { state: 'active' | 'done' | 'pending' }) {
  if (state === 'active') return (
    <div style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--accent)', boxShadow: '0 0 0 4px var(--accent-soft)' }} />
  )
  if (state === 'done') return (
    <div style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--success)' }} />
  )
  return <div style={{ width: 10, height: 10, borderRadius: 999, border: '1px solid var(--border-bright)' }} />
}

function UploadModal({ ens, onClose }: { ens: string; onClose: () => void }) {
  const { transcodeAndUpload, progress, stage } = useVideoUpload()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [done, setDone] = useState(false)
  const [resultCID, setResultCID] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const stageIdx = stage === 'idle' ? 0
    : stage === 'transcoding' ? 1
    : stage === 'encrypting' ? 2
    : stage === 'uploading' ? 3
    : stage === 'done' ? 5 : 4

  async function handleStart() {
    if (!file) return
    const contentKey = generateContentKey()
    try {
      const { manifestCID } = await transcodeAndUpload(file, contentKey, uploadToSwarm)
      setResultCID(manifestCID)
      setDone(true)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(10,11,15,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        className="nw-enter"
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(560px, 100%)', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--r-20)', padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="eyebrow">Publishing</span>
            <span style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em' }}>
              {done ? 'Posted to Swarm' : UPLOAD_STAGES[Math.min(stageIdx, UPLOAD_STAGES.length - 1)].label}
            </span>
          </div>
          <button className="btn btn-sm btn-quiet" onClick={onClose}>{done ? 'Close' : 'Cancel'}</button>
        </div>

        {file && (
          <div className="card" style={{ padding: 14, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: seededGradient(file.name) }} />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
              <span className="num" style={{ fontSize: 13, color: 'var(--text)' }}>{file.name}</span>
              <span className="num" style={{ fontSize: 12, color: 'var(--text-dim)' }}>{(file.size / 1e6).toFixed(1)} MB</span>
            </div>
            <EncryptionBadge state={stageIdx >= 2 ? 'decrypted' : 'default'}>
              {stageIdx >= 2 ? 'Encrypted' : 'Not yet encrypted'}
            </EncryptionBadge>
          </div>
        )}

        {!file && (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]) }}
            />
            <input
              placeholder="Post title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{ width: '100%', marginBottom: 12 }}
            />
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => fileRef.current?.click()}>
              Choose video file…
            </button>
          </div>
        )}

        {stage !== 'idle' && (
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {UPLOAD_STAGES.map((s, i) => {
              const st = done ? 'done' : i < stageIdx ? 'done' : i === stageIdx ? 'active' : 'pending'
              return (
                <li key={s.id} style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                  <StageDot state={st} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 14, color: st === 'pending' ? 'var(--text-dim)' : 'var(--text)', fontWeight: st === 'active' ? 500 : 400 }}>{s.label}</span>
                    {st === 'active' && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.detail}</span>}
                  </div>
                  {st === 'active' && <span className="num" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{progress}%</span>}
                  {st === 'done' && (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--success)' }}>
                      <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </li>
              )
            })}
          </ol>
        )}

        {stage !== 'idle' && !done && (
          <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', transition: 'width 80ms linear' }} />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span className="num" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            {done ? `bzz:${resultCID.slice(0, 12)}…` : stage === 'idle' ? 'Pick a video to publish.' : 'Do not close this window.'}
          </span>
          {stage === 'idle' && file && (
            <button className="btn btn-primary" onClick={handleStart}>
              Start upload
            </button>
          )}
          {done && (
            <button className="btn btn-primary" onClick={onClose}>View post</button>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="card" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span className="eyebrow">{label}</span>
      <span className="num" style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.05 }}>{value}</span>
      {sub && (
        <span style={{ fontSize: 12, color: sub.includes('live') ? 'var(--success)' : 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {sub.includes('live') && <span className="live-dot" aria-hidden="true" />}
          {sub}
        </span>
      )}
    </div>
  )
}

export default function CreatorDashboard() {
  const params = useParams()
  const ens = params.ens as string
  const [showUpload, setShowUpload] = useState(false)

  return (
    <>
      <AppHeader />
      <div className="page">
        <div className="shell">

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="eyebrow">Creator</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Avatar seed={ens} size={44} />
                <h1 className="display" style={{ margin: 0, fontSize: 32, letterSpacing: '-0.03em' }}>{ens}</h1>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost">Settings</button>
              <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 2v10M3 7l5-5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Upload video
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
            <Stat label="Active subscribers" value="—" />
            <Stat label="Current MRR" value="—" sub="streaming · live" />
            <Stat label="All-time earnings" value="—" sub="paid out to stealth" />
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>Posts</h2>
            <span className="num" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {MOCK_POSTS.length} published · {MOCK_POSTS.reduce((a, b) => a + b.views, 0).toLocaleString()} total views
            </span>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            {MOCK_POSTS.map((post, i) => (
              <div key={post.id} style={{
                display: 'grid',
                gridTemplateColumns: '64px minmax(0, 1fr) 110px 120px 100px',
                gap: 16,
                alignItems: 'center',
                padding: '14px 16px',
                borderTop: i > 0 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ width: 64, height: 40, borderRadius: 'var(--r-6)', background: seededGradient(post.id), position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg, transparent 0 8px, rgba(255,255,255,0.05) 8px 9px)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</span>
                  <span className="num" style={{ fontSize: 12, color: 'var(--text-dim)' }}>{post.publishedAgo}</span>
                </div>
                <span className="num" style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'right' }}>{post.views.toLocaleString()} views</span>
                <EncryptionBadge state="decrypted">Encrypted</EncryptionBadge>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-sm btn-quiet">Open</button>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {showUpload && <UploadModal ens={ens} onClose={() => setShowUpload(false)} />}
    </>
  )
}
