import EditorPage from './EditorPage'

type PageProps = {
  params: Promise<{
    pageId: string
  }>
}

const Page = async ({ params }: PageProps) => {
  const { pageId } = await params

  return <EditorPage pageId={pageId} />
}

export default Page
