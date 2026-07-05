'use client'

import dynamic from 'next/dynamic'
import type { AuthUser } from '../../../src/server/auth'
import type { ShareAccessMode } from '../../../src/shareLinks'

const App = dynamic(() => import('../../../src/App'), {
  ssr: false,
})

const EditorPage = ({
  authEnabled,
  authUser,
  giphyApiKey,
  initialAccessMode,
  pageOwnerUserId,
  pageId,
}: {
  authEnabled?: boolean
  authUser?: AuthUser | null
  giphyApiKey?: string
  initialAccessMode: ShareAccessMode
  pageOwnerUserId?: string | null
  pageId: string
}) => (
  <App
    authEnabled={authEnabled}
    authUser={authUser}
    giphyApiKey={giphyApiKey}
    pageId={pageId}
    pageOwnerUserId={pageOwnerUserId}
    serverAccessMode={initialAccessMode}
  />
)

export default EditorPage
