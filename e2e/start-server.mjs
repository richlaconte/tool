// E2E web-server entry: prepare an empty test data directory, then start
// the production server. The wipe must happen here (not in globalSetup)
// because Playwright boots the web server before global setup runs, and the
// server opens its SQLite connection at boot — deleting the file afterwards
// would leave that connection on an unlinked inode.
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'

const testDataDir = path.join(import.meta.dirname, '.test-data')

rmSync(testDataDir, { force: true, recursive: true })
mkdirSync(testDataDir, { recursive: true })

process.env.NODE_ENV = 'production'

await import('../dist/server.js')
