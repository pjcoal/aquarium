import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AppShell } from '@/components/AppShell'

export const metadata: Metadata = {
  title: 'Tank — every fish has a mind',
  description: 'A shared ASCII aquarium where every fish is a coin launched on pump.fun, with an AI brain its creator chose.',
}

export const viewport: Viewport = {
  themeColor: '#03070b',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
