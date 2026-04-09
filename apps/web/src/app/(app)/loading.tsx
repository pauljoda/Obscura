export default function AppLoading() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 border-2 border-accent-500 border-t-transparent animate-spin" />
        <p className="text-sm text-text-muted font-mono">Loading</p>
      </div>
    </div>
  );
}
