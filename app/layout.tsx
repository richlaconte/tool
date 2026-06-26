import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import '../src/index.css'
import '../src/App.css'
import '../src/components/area.css'
import '../src/components/commandPalette.css'

export const metadata: Metadata = {
  title: 'Tool',
  description: 'Collaborative canvas editor',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/logo.svg',
  },
}

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en">
    <body>{children}</body>
  </html>
)

export default RootLayout
