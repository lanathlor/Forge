import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">404</h1>
        <p className="text-muted-foreground mb-6">This page could not be found.</p>
        <Link
          href="/dashboard"
          className="text-primary hover:underline"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
