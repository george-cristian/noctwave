import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { cookieToInitialState } from 'wagmi'
import Providers from './providers'
import { wagmiConfig } from '@/lib/wagmi'
import './globals.css'

export const metadata: Metadata = {
  title: 'Noctwave',
  description: 'Censorship-resistant publishing. Pay per second. Watch forever.',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const initialState = cookieToInitialState(
    wagmiConfig,
    (await headers()).get('cookie'),
  )
  return (
    <html lang="en">
      <body>
        <Providers initialState={initialState}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  )
}
