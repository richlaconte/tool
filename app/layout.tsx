import type { ReactNode } from 'react'

import '../src/index.css'
import '../src/App.css'
import '../src/components/area.css'
import '../src/components/commandPalette.css'

export const metadata = {
  title: 'Tool',
  description: 'Collaborative canvas editor',
}

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en">
    <body>{children}</body>
  </html>
)

export default RootLayout
