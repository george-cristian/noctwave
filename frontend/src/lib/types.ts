export interface PostMetadata {
  id: string               // manifestCID — used as the post's unique identifier
  title: string
  description: string
  content_type: 'video' | 'text' | 'image'
  thumbnail_cid: string    // public, unencrypted
  manifest_cid: string     // encrypted video blob CID
  creator_encrypted_key?: string  // content key encrypted with creator's wallet sig, base64
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
