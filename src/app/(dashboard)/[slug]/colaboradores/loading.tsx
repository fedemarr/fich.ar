export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-44 bg-gray-200 rounded" />
      <div className="flex justify-end gap-2">
        <div className="h-8 w-32 bg-gray-100 rounded-md" />
        <div className="h-8 w-32 bg-gray-100 rounded-md" />
      </div>
      <div className="flex gap-4 border-b border-gray-200">
        <div className="h-8 w-20 bg-gray-200 rounded-t" />
        <div className="h-8 w-16 bg-gray-100 rounded-t" />
        <div className="h-8 w-24 bg-gray-100 rounded-t" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="h-12 bg-gray-50 border-b border-gray-100" />
        {[...Array(7)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-50">
            <div className="w-9 h-9 rounded-full bg-gray-200" />
            <div className="h-4 w-44 bg-gray-200 rounded" />
            <div className="h-4 w-16 bg-gray-100 rounded ml-8" />
            <div className="h-4 w-28 bg-gray-100 rounded ml-4" />
            <div className="h-4 w-28 bg-gray-100 rounded ml-4" />
          </div>
        ))}
      </div>
    </div>
  )
}
