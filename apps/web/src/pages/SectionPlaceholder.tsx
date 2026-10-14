import { PageTitle, Panel } from '../components/ui';

/** Leaderboard, Intel and Achievements are built in Phase 5. */
export function SectionPlaceholder({ title }: { title: string }) {
  return (
    <>
      <PageTitle>{title}</PageTitle>
      <Panel className="mt-4">
        <p className="text-base text-ink/65">This section opens soon.</p>
      </Panel>
    </>
  );
}
