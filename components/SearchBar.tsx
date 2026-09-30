export default function SearchBar({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Search episodes..."
      className="w-full border rounded-lg px-4 py-2 text-sm"
    />
  )
}
