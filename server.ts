import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import type { Duplex } from 'node:stream'

import { createCollaborationServer } from './src/server/collaborationServer.js'
import { createDatabase } from './src/server/database.js'
import {
  getPageSessionSecret,
  handlePageAccessRequest,
} from './src/server/pageAccess.js'

type NextApp = {
  getRequestHandler(): (
    request: IncomingMessage,
    response: ServerResponse
  ) => Promise<void>
  getUpgradeHandler(): (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer
  ) => Promise<void>
  prepare(): Promise<void>
}

type CreateNextServer = (options: {
  dev: boolean
  hostname: string
  port: number
}) => NextApp

const require = createRequire(import.meta.url)
const next = require('next') as CreateNextServer
const port = Number.parseInt(process.env.PORT ?? '3000', 10)
const hostname = process.env.HOSTNAME ?? '0.0.0.0'
const dev = process.env.NODE_ENV !== 'production'
const pageDatabase = createDatabase()
const pageSessionSecret = getPageSessionSecret()

const app = next({ dev, hostname, port })
const collaborationServer = createCollaborationServer({
  pageDatabase,
  sessionSecret: pageSessionSecret,
})

await app.prepare()

const handle = app.getRequestHandler()
const handleUpgrade = app.getUpgradeHandler()

const server = createServer(async (request, response) => {
  if (
    handlePageAccessRequest({
      database: pageDatabase,
      request,
      response,
      secret: pageSessionSecret,
    })
  ) {
    return
  }

  await handle(request, response)
})

server.on('upgrade', (request, socket, head) => {
  const requestUrl = new URL(
    request.url ?? '/',
    `http://${request.headers.host ?? `${hostname}:${port}`}`
  )

  if (requestUrl.pathname === '/collaboration') {
    collaborationServer.handleUpgrade(request, socket, head)
    return
  }

  void handleUpgrade(request, socket, head)
})

server.listen(port, hostname, () => {
  console.log(
    `> Server listening at http://${hostname}:${port} as ${
      dev ? 'development' : 'production'
    }`
  )
})
