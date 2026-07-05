import { getAuthConfig, getUserFromCookie } from '../../src/server/auth'
import { createDatabase } from '../../src/server/database'
import { listPages } from '../../src/server/pageRepository'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const ShelfPage = async () => {
  const database = createDatabase()
  const cookieStore = await cookies()
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ')
  const authEnabled = Boolean(getAuthConfig())
  const user = authEnabled
    ? getUserFromCookie(database, cookieHeader)
    : null

  if (!authEnabled || !user) {
    return (
      <main className="shelf-page">
        <section className="shelf-panel">
          <img alt="" className="shelf-logo" src="/logo.svg" />
          <h1>Keep your Cascadery canvases</h1>
          <p>
            Sign in with GitHub to save a shelf of canvases you own. You can
            still create an anonymous canvas without signing in.
          </p>
          <div className="shelf-actions">
            {authEnabled && <a href="/api/auth/login">Sign in with GitHub</a>}
            <a href="/">Create anonymous canvas</a>
          </div>
        </section>
      </main>
    )
  }

  const pages = listPages(database, { ownerUserId: user.id })

  return (
    <main className="shelf-page">
      <section className="shelf-header">
        <div>
          <img alt="" className="shelf-logo" src="/logo.svg" />
          <h1>Your Cascadery shelf</h1>
          <p>{user.displayName || user.login}</p>
        </div>
        <div className="shelf-actions">
          <form action="/api/pages" method="post">
            <button type="submit">New canvas</button>
          </form>
          <form action="/api/auth/logout" method="post">
            <button type="submit">Sign out</button>
          </form>
        </div>
      </section>
      <section className="shelf-list" aria-label="Owned canvases">
        {pages.length > 0 ? (
          pages.map((page) => (
            <article className="shelf-card" key={page.id}>
              <a href={`/p/${page.id}`}>{page.title}</a>
              <time dateTime={page.updatedAt}>
                Updated {formatShelfDate(page.updatedAt)}
              </time>
              <form
                action={`/api/pages/${page.id}?_method=delete`}
                method="post"
              >
                <button type="submit">Delete</button>
              </form>
            </article>
          ))
        ) : (
          <p className="shelf-empty">No owned canvases yet.</p>
        )}
      </section>
    </main>
  )
}

const formatShelfDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export default ShelfPage
