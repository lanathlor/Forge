export function EmptyRepositoryState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <div className="mx-auto w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
          <svg className="h-12 w-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-semibold mb-2">Select a Repository</h3>
          <p className="text-muted-foreground text-sm">
            Choose a repository from the sidebar to view its QA gates configuration
          </p>
        </div>
      </div>
    </div>
  );
}
