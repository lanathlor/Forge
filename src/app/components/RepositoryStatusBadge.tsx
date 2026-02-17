interface RepositoryStatusBadgeProps {
  isClean: boolean | null;
}

export function RepositoryStatusBadge({ isClean }: RepositoryStatusBadgeProps) {
  const clean = isClean ?? true;

  return (
    <div
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-sm ${
        clean
          ? 'border border-green-500/20 bg-green-500/10 text-green-600'
          : 'border border-yellow-500/20 bg-yellow-500/10 text-yellow-600'
      }`}
    >
      {clean ? (
        <>
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          Clean
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          Uncommitted Changes
        </>
      )}
    </div>
  );
}
