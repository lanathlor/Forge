import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import './globals-accessibility.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Forge - AI Oversight Dashboard',
  description: 'Deterministic QA gate dashboard for AI coding agents',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={inter.className}>
        <a href="#main-content" className="skip-to-main">
          Skip to main content
        </a>
        <Providers>
          <div
            id="main-content"
            className="min-h-screen bg-background"
            role="main"
          >
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
