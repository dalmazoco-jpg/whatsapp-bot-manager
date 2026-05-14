export function DashboardLayoutSkeleton() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="w-[260px] border-r bg-muted/20 animate-pulse" />
      <div className="flex-1">
        <div className="h-16 border-b bg-background/95 animate-pulse" />
        <div className="p-8 animate-pulse" />
      </div>
    </div>
  );
}
