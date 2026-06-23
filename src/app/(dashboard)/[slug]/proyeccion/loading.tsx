export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-36 bg-gray-200 rounded" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24" />
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 h-64" />
    </div>
  )
}
