'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { AppHeader } from '@/components/AppHeader'
import { Avatar, seededGradient } from '@/components/ui/Avatar'
import { EncryptionBadge } from '@/components/ui/EncryptionBadge'
import { Spinner } from '@/components/ui/Spinner'
import { useVideoUpload } from '@/hooks/useVideoUpload'
import { uploadToSwarm } from '@/lib/uploadHelper'
import { generateContentKey } from '@/lib/crypto'
import { feedWriteJson, feedReadJson, makeFeedSigner, TOPIC_NAMES, GATEWAY } from '@/lib/swarmClient'
import type { PostMetadata, CreatorFeed } from '@/lib/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function storeContentKey(manifestCID: string, key: Uint8Array) {
  localStorage.setItem(`noctwave-key-${manifestCID}`, btoa(String.fromCharCode(...key)))
}

// LocalStorage backup so posts survive across sessions regardless of Swarm read success
function saveFeedLocally(address: string, feed: CreatorFeed) {
  localStorage.setItem(`noctwave-feed-${address.toLowerCase()}`, JSON.stringify(feed))
}

function loadFeedLocally(address: string): CreatorFeed | null {
  try {
    const raw = localStorage.getItem(`noctwave-feed-${address.toLowerCase()}`)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

// ── Upload modal ─────────────────────────────────────────────────────────────

const UPLOAD_STAGES = [
  { id: 'select',  label: 'Select file',       detail: 'Pick a video to publish.' },
  { id: 'encrypt', label: 'Encrypting',         detail: 'AES-256-GCM, fresh key per post.' },
  { id: 'upload',  label: 'Uploading to Swarm', detail: 'Pinning encrypted video.' },
  { id: 'publish', label: 'Publishing',         detail: 'Writing post to Swarm Feed.' },
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

function UploadModal({
  address,
  onClose,
  onPublished,
}: {
  address: string
  onClose: () => void
  onPublished: (post: PostMetadata) => void
}) {
  const { transcodeAndUpload, progress, stage } = useVideoUpload()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [done, setDone] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [resultCID, setResultCID] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const stageIdx = stage === 'idle' ? 0
    : stage === 'encrypting' ? 1
    : stage === 'uploading' ? 2
    : publishing ? 3
    : stage === 'done' ? 4 : 3

  async function handleStart() {
    if (!file) return
    const contentKey = generateContentKey()
    try {
      const { manifestCID, thumbnailCID } = await transcodeAndUpload(file, contentKey, uploadToSwarm)

      setPublishing(true)

      const post: PostMetadata = {
        id: manifestCID,
        title: title.trim() || file.name,
        description: description.trim(),
        content_type: 'video',
        thumbnail_cid: thumbnailCID,
        manifest_cid: manifestCID,
        published_at: Date.now(),
        paid: true,
        creator_address: address,
        views: 0,
      }

      // Read existing feed — try Swarm first, fall back to localStorage
      let feed: CreatorFeed
      try {
        feed = await feedReadJson<CreatorFeed>(TOPIC_NAMES.CONTENT_ROOT, address)
      } catch {
        feed = loadFeedLocally(address) ?? { version: 1, creator_address: address, posts: [], updated_at: 0 }
      }

      feed.posts.unshift(post)
      feed.updated_at = Date.now()

      // Save locally first so it's available even if Swarm write fails
      saveFeedLocally(address, feed)

      const signer = await makeFeedSigner(address)
      await feedWriteJson(TOPIC_NAMES.CONTENT_ROOT, feed, signer)

      storeContentKey(manifestCID, contentKey)

      setPublishing(false)
      setResultCID(manifestCID)
      setDone(true)
      onPublished(post)
    } catch (err) {
      console.error(err)
      setPublishing(false)
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

        {!file && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              placeholder="Post title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{ width: '100%' }}
            />
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 14, padding: '10px 12px', background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 'var(--r-6)', color: 'var(--text)', outline: 'none' }}
            />
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]) }}
            />
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => fileRef.current?.click()}>
              Choose video file…
            </button>
          </div>
        )}

        {file && (
          <div className="card" style={{ padding: 14, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: seededGradient(file.name) }} />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
              <span className="num" style={{ fontSize: 13, color: 'var(--text)' }}>{title || file.name}</span>
              <span className="num" style={{ fontSize: 12, color: 'var(--text-dim)' }}>{(file.size / 1e6).toFixed(1)} MB</span>
            </div>
            <EncryptionBadge state={stageIdx >= 1 ? 'decrypted' : 'default'}>
              {stageIdx >= 1 ? 'Encrypted' : 'Pending'}
            </EncryptionBadge>
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
                  {st === 'active' && !publishing && <span className="num" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{progress}%</span>}
                  {st === 'active' && publishing && <Spinner />}
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
            {done ? `bzz:${resultCID.slice(0, 12)}…` : stage === 'idle' ? 'Fill in the fields above, then pick a file.' : 'Do not close this window.'}
          </span>
          {stage === 'idle' && file && (
            <button className="btn btn-primary" onClick={handleStart}>
              Start upload
            </button>
          )}
          {done && <button className="btn btn-primary" onClick={onClose}>Done</button>}
        </div>
      </div>
    </div>
  )
}

// ── Post card ─────────────────────────────────────────────────────────────────

function PostCard({ post, ens, onOpen }: { post: PostMetadata; ens: string; onOpen: () => void }) {
  const hasThumbnail = !!post.thumbnail_cid
  return (
    <div
      className="card"
      style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'pointer' }}
      onClick={onOpen}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden', background: '#000' }}>
        {hasThumbnail ? (
          <img
            src={`${GATEWAY}/bzz/${post.thumbnail_cid}`}
            alt={post.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: seededGradient(post.id), position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg, transparent 0 8px, rgba(255,255,255,0.04) 8px 9px)' }} />
          </div>
        )}
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <EncryptionBadge state="decrypted">Encrypted</EncryptionBadge>
        </div>
      </div>

      {/* Metadata */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', lineHeight: 1.3, letterSpacing: '-0.01em' }}>
          {post.title}
        </span>
        {post.description && (
          <span style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {post.description}
          </span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <span className="num" style={{ fontSize: 12, color: 'var(--text-dim)' }}>{timeAgo(post.published_at)}</span>
          <span className="num" style={{ fontSize: 12, color: 'var(--text-dim)' }}>{post.views.toLocaleString()} views</span>
        </div>
      </div>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
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

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function CreatorDashboard() {
  const params = useParams()
  const router = useRouter()
  const ens = params.ens as string
  const { address } = useAccount()
  const [showUpload, setShowUpload] = useState(false)
  const [posts, setPosts] = useState<PostMetadata[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)

  useEffect(() => {
    if (!address) return
    let cancelled = false

    // Show localStorage posts immediately while Swarm loads
    const local = loadFeedLocally(address)
    if (local && local.posts.length > 0) {
      setPosts(local.posts)
      setLoadingPosts(false)
    }

    async function loadFeed() {
      try {
        const feed = await feedReadJson<CreatorFeed>(TOPIC_NAMES.CONTENT_ROOT, address!)
        if (!cancelled) {
          setPosts(feed.posts)
          saveFeedLocally(address!, feed)
        }
      } catch (err) {
        console.warn('[dashboard] Swarm feed read failed:', err)
        // localStorage already shown above as immediate fallback
      } finally {
        if (!cancelled) setLoadingPosts(false)
      }
    }
    loadFeed()
    return () => { cancelled = true }
  }, [address])

  function handlePublished(post: PostMetadata) {
    setPosts(prev => [post, ...prev])
  }

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
                <h1 className="display" style={{ margin: 0, fontSize: 32, letterSpacing: '-0.03em' }}>{ens}.noctwave.eth</h1>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost">Settings</button>
              <button className="btn btn-primary" onClick={() => setShowUpload(true)} disabled={!address}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 2v10M3 7l5-5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Upload video
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
            <Stat label="Posts" value={loadingPosts ? '—' : String(posts.length)} />
            <Stat label="Current MRR" value="—" sub="streaming · live" />
            <Stat label="All-time earnings" value="—" sub="paid out to stealth" />
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>Posts</h2>
            <span className="num" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {loadingPosts ? '…' : `${posts.length} published`}
            </span>
          </div>

          {loadingPosts && (
            <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
              <Spinner />
            </div>
          )}

          {!loadingPosts && posts.length === 0 && (
            <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>
              No posts yet. Upload your first video.
            </div>
          )}

          {!loadingPosts && posts.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {posts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  ens={ens}
                  onOpen={() => router.push(`/watch/${ens}/${post.id}`)}
                />
              ))}
            </div>
          )}

        </div>
      </div>

      {showUpload && address && (
        <UploadModal
          address={address}
          onClose={() => setShowUpload(false)}
          onPublished={handlePublished}
        />
      )}
    </>
  )
}
