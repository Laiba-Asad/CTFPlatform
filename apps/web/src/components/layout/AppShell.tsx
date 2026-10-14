import type { ReactNode } from 'react';

/** Black frame (top bar + sidebar) around the light grey content area. */
export function AppShell({ topBar, sidebar, children }: { topBar: ReactNode; sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      {topBar}
      {sidebar}
      <main className="px-4 py-6 sm:px-7 sm:py-7 lg:ml-60">{children}</main>
    </div>
  );
}
