export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-44 bg-gray-200 rounded" />
      <div className="flex gap-2">
        <div className="h-9 w-52 bg-gray-200 rounded-md" />
        <div className="h-9 w-9 bg-gray-200 rounded-md" />
        <div className="ml-auto h-9 w-36 bg-gray-200 rounded-md" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="h-11 bg-gray-50 border-b border-gray-100" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-50">
            <div className="w-7 h-7 rounded-full bg-gray-200" />
            <div className="h-4 w-40 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-100 rounded ml-auto" />
            <div className="h-4 w-16 bg-gray-100 rounded" />
            <div className="h-4 w-16 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
