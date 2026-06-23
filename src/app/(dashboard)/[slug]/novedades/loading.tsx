export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-36 bg-gray-200 rounded" />
      <div className="flex border-b border-gray-200 gap-4 pb-0">
        <div className="h-8 w-28 bg-gray-200 rounded-t" />
        <div className="h-8 w-24 bg-gray-100 rounded-t" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-gray-100">
            <div className="w-9 h-9 rounded-full bg-gray-200" />
            <div className="h-4 w-44 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-100 rounded ml-auto" />
            <div className="h-9 w-40 bg-gray-100 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
