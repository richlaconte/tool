import { cookies } from 'next/headers'

import { createDatabase } from '../../../src/server/database'
import { getAuthConfig, getUserFromCookie } from '../../../src/server/auth'
import {
  getPageAccessModeFromRequestCookies,
  getPageSessionSecret,
} from '../../../src/server/pageAccess'
import { getPageRecord } from '../../../src/server/pageRepository'
import { readGiphyApiKey } from '../../../src/gifSearchConfig'
import EditorPage from './EditorPage'

type PageProps = {
  params: Promise<{
    pageId: string
  }>
}

const Page = async ({ params }: PageProps) => {
  const { pageId } = await params
  const database = createDatabase()
  const cookieStore = await cookies()
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ')
  const authEnabled = Boolean(getAuthConfig())
  const authUser = authEnabled
    ? getUserFromCookie(database, cookieHeader)
    : null
  const initialAccessMode =
    getPageAccessModeFromRequestCookies({
      authenticatedUserId: authUser?.id ?? null,
      cookieHeader,
      database,
      pageId,
      secret: getPageSessionSecret(),
    }) ?? 'view'
  const pageRecord = getPageRecord(database, pageId)

  return (
    <EditorPage
      authEnabled={authEnabled}
      authUser={authUser}
      giphyApiKey={readGiphyApiKey()}
      pageId={pageId}
      pageOwnerUserId={pageRecord?.ownerUserId ?? null}
      initialAccessMode={initialAccessMode}
    />
  )
}

export default Page
