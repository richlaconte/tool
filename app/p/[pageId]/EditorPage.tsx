'use client'

import dynamic from 'next/dynamic'
import type { ShareAccessMode } from '../../../src/shareLinks'

const App = dynamic(() => import('../../../src/App'), {
  ssr: false,
})

const EditorPage = ({
  giphyApiKey,
  initialAccessMode,
  pageId,
}: {
  giphyApiKey?: string
  initialAccessMode: ShareAccessMode
  pageId: string
}) => (
  <App
    giphyApiKey={giphyApiKey}
    pageId={pageId}
    serverAccessMode={initialAccessMode}
  />
)

export default EditorPage
