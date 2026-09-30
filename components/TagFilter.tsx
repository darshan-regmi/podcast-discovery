export default function TagFilter({
  tags,
  active,
  onSelect,
}: {
  tags: string[]
  active: string | null
  onSelect: (tag: string | null) => void
}) {
  if (tags.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`px-3 py-1 rounded-full text-xs border ${
          active === null ? 'bg-black text-white' : 'bg-white text-gray-700'
        }`}
      >
        All
      </button>
      {tags.map(tag => (
        <button
          key={tag}
          type="button"
          onClick={() => onSelect(tag)}
          className={`px-3 py-1 rounded-full text-xs border ${
            active === tag ? 'bg-black text-white' : 'bg-white text-gray-700'
          }`}
        >
          {tag}
        </button>
      ))}
    </div>
  )
}
