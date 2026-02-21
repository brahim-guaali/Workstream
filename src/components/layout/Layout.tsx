import type { ReactNode } from 'react';
import { Header } from './Header';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <Header />
      <main>{children}</main>
    </div>
  );
}
