'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard on initial load
    router.replace('/dashboard');
  }, [router]);

  return null;
}
