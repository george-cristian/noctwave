export interface PostMetadata {
  id: string               // manifestCID — used as the post's unique identifier
  title: string
  description: string
  content_type: 'video' | 'text' | 'image'
  thumbnail_cid: string    // public, unencrypted
  manifest_cid: string     // encrypted video blob CID
  creator_encrypted_key?: string  // content key encrypted with creator's wallet sig, base64
  // Demo-only: content key encrypted with a deterministic per-post secret so any
  // subscriber's browser can decrypt without a per-subscriber key delivery feed.
  // Production should replace this with EIP-5564 stealth-address ECDH key delivery.
  subscriber_demo_key?: string
  published_at: number     // unix ms
  paid: boolean
  creator_address: string
  views: number
}

export interface CreatorFeed {
  version: 1
  creator_address: string
  posts: PostMetadata[]
  updated_at: number
}
