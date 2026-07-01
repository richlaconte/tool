export type GiphyApiKeyEnv = {
  GIPHY_API_KEY?: string
  NEXT_PUBLIC_GIPHY_API_KEY?: string
  VITE_GIPHY_API_KEY?: string
}

export const readGiphyApiKey = (env: GiphyApiKeyEnv = readGiphyEnv()) =>
  firstConfiguredValue([
    env.GIPHY_API_KEY,
    env.NEXT_PUBLIC_GIPHY_API_KEY,
    env.VITE_GIPHY_API_KEY,
  ])

export const readGiphyEnv = (): GiphyApiKeyEnv => {
  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | undefined>
  }
  const processEnv =
    typeof process === 'undefined' ? {} : process.env

  return {
    GIPHY_API_KEY: processEnv.GIPHY_API_KEY,
    NEXT_PUBLIC_GIPHY_API_KEY: processEnv.NEXT_PUBLIC_GIPHY_API_KEY,
    VITE_GIPHY_API_KEY:
      meta.env?.VITE_GIPHY_API_KEY ?? processEnv.VITE_GIPHY_API_KEY,
  }
}

const firstConfiguredValue = (values: Array<string | undefined>) => {
  for (const value of values) {
    const trimmedValue = value?.trim()

    if (trimmedValue) return trimmedValue
  }

  return ''
}
