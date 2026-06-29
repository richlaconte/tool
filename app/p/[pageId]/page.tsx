import { cookies } from 'next/headers'

import { createDatabase } from '../../../src/server/database'
import {
  getPageAccessModeFromRequestCookies,
  getPageSessionSecret,
} from '../../../src/server/pageAccess'
import EditorPage from './EditorPage'

type PageProps = {
  params: Promise<{
    pageId: string
  }>
}

const Page = async ({ params }: PageProps) => {
  const { pageId } = await params
  const cookieStore = await cookies()
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ')
  const initialAccessMode =
    getPageAccessModeFromRequestCookies({
      cookieHeader,
      database: createDatabase(),
      pageId,
      secret: getPageSessionSecret(),
    }) ?? 'view'

  return (
    <EditorPage pageId={pageId} initialAccessMode={initialAccessMode} />
  )
}

export default Page
