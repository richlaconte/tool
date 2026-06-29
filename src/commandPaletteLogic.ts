export type CommandOptionLike = {
  id: string
  title: string
  description: string
  aliases?: string[]
}

const normalizeQuery = (query: string) => query.trim().toLowerCase()

const getOptionSearchText = (option: CommandOptionLike) =>
  [option.title, option.description, ...(option.aliases ?? [])]
    .join(' ')
    .toLowerCase()

export const getFilteredCommandOptions = <
  Option extends CommandOptionLike,
>(
  options: Option[],
  query: string
) => {
  const normalizedQuery = normalizeQuery(query)

  if (!normalizedQuery) return options

  return options.filter((option) =>
    getOptionSearchText(option).includes(normalizedQuery)
  )
}

export const findExactCommandOption = <
  Option extends CommandOptionLike,
>(
  options: Option[],
  query: string
) => {
  const normalizedQuery = normalizeQuery(query)

  if (!normalizedQuery) return undefined

  return options.find(
    (option) =>
      option.title.toLowerCase() === normalizedQuery ||
      option.id.toLowerCase() === normalizedQuery ||
      (option.aliases ?? []).some(
        (alias) => alias.toLowerCase() === normalizedQuery
      )
  )
}

export const getNextCommandOptionIndex = (
  currentIndex: number,
  direction: -1 | 1,
  optionCount: number
) => {
  if (optionCount === 0) return 0

  return (
    (currentIndex + direction + optionCount) % optionCount
  )
}
