export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-40 bg-gray-200 rounded" />
      <div className="flex gap-3 border-b border-gray-200">
        <div className="h-8 w-28 bg-gray-200 rounded-t" />
        <div className="h-8 w-24 bg-gray-100 rounded-t" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-5 py-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-48 bg-gray-200 rounded" />
              <div className="h-3 w-64 bg-gray-100 rounded" />
            </div>
            <div className="h-3 w-16 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
