import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GifSearchConfigurationError,
  createGiphySearchProvider,
  findGifSlashCommand,
  removeGifSlashCommand,
} from './gifSearch.ts'

test('finds gif slash commands with optional quoted queries', () => {
  assert.deepEqual(findGifSlashCommand('/gif', 4), {
    start: 0,
    end: 4,
    raw: '/gif',
    query: '',
  })

  assert.deepEqual(findGifSlashCommand('before /gif cats', 16), {
    start: 7,
    end: 16,
    raw: '/gif cats',
    query: 'cats',
  })

  assert.deepEqual(findGifSlashCommand('/gif "ship it"', 14), {
    start: 0,
    end: 14,
    raw: '/gif "ship it"',
    query: 'ship it',
  })
})

test('removes committed gif slash commands', () => {
  const text = 'Celebrate /gif ship it'
  const command = findGifSlashCommand(text, text.length)

  assert.ok(command)
  assert.deepEqual(removeGifSlashCommand(text, command), {
    text: 'Celebrate ',
    caretIndex: 10,
  })
})

test('giphy provider searches and maps compact renditions', async () => {
  const requestedUrls: string[] = []
  const provider = createGiphySearchProvider({
    apiKey: 'public-key',
    fetchImpl: async (url) => {
      requestedUrls.push(String(url))

      return new Response(
        JSON.stringify({
          data: [
            {
              id: 'gif-1',
              title: 'Ship it',
              rating: 'pg',
              url: 'https://giphy.com/gifs/gif-1',
              images: {
                fixed_width_small: {
                  url: 'https://media.giphy.com/preview.gif',
                  width: '100',
                  height: '80',
                },
                fixed_width_small_still: {
                  url: 'https://media.giphy.com/preview-still.gif',
                },
                fixed_width: {
                  url: 'https://media.giphy.com/full.gif',
                  width: '200',
                  height: '160',
                },
                original: {
                  url: 'https://media.giphy.com/original.gif',
                  width: '480',
                  height: '360',
                },
              },
              analytics: {
                onload: {
                  url: 'https://analytics.giphy.com/onload',
                },
                onclick: {
                  url: 'https://analytics.giphy.com/click',
                },
                onsent: {
                  url: 'https://analytics.giphy.com/send',
                },
              },
            },
          ],
        })
      )
    },
  })

  const results = await provider.search('ship it', {
    limit: 6,
    rating: 'pg',
  })
  const requestedUrl = new URL(requestedUrls[0])

  assert.equal(requestedUrl.pathname, '/v1/gifs/search')
  assert.equal(requestedUrl.searchParams.get('api_key'), 'public-key')
  assert.equal(requestedUrl.searchParams.get('q'), 'ship it')
  assert.equal(requestedUrl.searchParams.get('limit'), '6')
  assert.equal(requestedUrl.searchParams.get('rating'), 'pg')
  assert.deepEqual(results[0], {
    provider: 'giphy',
    providerAssetId: 'gif-1',
    title: 'Ship it',
    previewUrl: 'https://media.giphy.com/preview.gif',
    stillUrl: 'https://media.giphy.com/preview-still.gif',
    animatedUrl: 'https://media.giphy.com/full.gif',
    width: 200,
    height: 160,
    providerUrl: 'https://giphy.com/gifs/gif-1',
    rating: 'pg',
    attributionLabel: 'Powered by GIPHY',
    analytics: {
      onload: 'https://analytics.giphy.com/onload',
      onclick: 'https://analytics.giphy.com/click',
      onsent: 'https://analytics.giphy.com/send',
    },
  })
})

test('giphy provider supports trending and reports missing configuration', async () => {
  const urls: string[] = []
  const provider = createGiphySearchProvider({
    apiKey: 'public-key',
    fetchImpl: async (url) => {
      urls.push(String(url))

      return new Response(JSON.stringify({ data: [] }))
    },
  })

  await provider.trending({ limit: 4 })
  assert.equal(new URL(urls[0]).pathname, '/v1/gifs/trending')

  await assert.rejects(
    () =>
      createGiphySearchProvider({
        apiKey: '',
        fetchImpl: async () => new Response(JSON.stringify({ data: [] })),
      }).search('cats', {}),
    GifSearchConfigurationError
  )
})
