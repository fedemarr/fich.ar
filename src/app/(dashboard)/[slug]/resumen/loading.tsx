export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-48 bg-gray-200 rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl p-5 bg-gray-100 h-24" />
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6 h-56" />
      <div className="bg-white rounded-xl border border-gray-200 p-6 h-48" />
    </div>
  )
}
