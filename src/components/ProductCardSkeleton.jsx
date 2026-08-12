export default function ProductCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="bg-blush/60 aspect-[4/5]" />
      <div className="mt-3 space-y-2">
        <div className="h-2.5 bg-blush/60 w-1/3" />
        <div className="h-3.5 bg-blush/60 w-4/5" />
        <div className="h-3.5 bg-blush/60 w-1/4" />
      </div>
    </div>
  )
}
