'use client'

import dynamic from 'next/dynamic'
import type { ShareAccessMode } from '../../../src/shareLinks'

const App = dynamic(() => import('../../../src/App'), {
  ssr: false,
})

const EditorPage = ({
  initialAccessMode,
  pageId,
}: {
  initialAccessMode: ShareAccessMode
  pageId: string
}) => <App pageId={pageId} serverAccessMode={initialAccessMode} />

export default EditorPage
