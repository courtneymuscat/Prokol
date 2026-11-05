'use client'

import { useClientTags } from './ClientTagsContext'

export default function ClientTagBadges({ clientId, size = 'sm' }: { clientId: string; size?: 'sm' | 'xs' }) {
  const { byClient } = useClientTags()
  const tags = byClient[clientId]
  if (!tags || tags.length === 0) return null

  const cls = size === 'xs' ? 'text-[10px] px-1.5 py-0' : 'text-[11px] px-2 py-0.5'

  return (
    <>
      {tags.map((tag) => (
        <span
          key={tag.id}
          className={`${cls} font-semibold rounded-full flex-shrink-0 whitespace-nowrap`}
          style={{ backgroundColor: `${tag.color}1a`, color: tag.color }}
        >
          {tag.name}
        </span>
      ))}
    </>
  )
}
