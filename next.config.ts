import type { NextConfig } from 'next'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  reactStrictMode: true,
  turbopack: {
    root: workspaceRoot,
  },
}

export default nextConfig
