export function HelpPage() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Help</h1>
        <p className="text-muted-foreground">
          Quick guide to using Supplier Tracking and what each option means.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Getting Started</h2>
        <ol className="list-decimal pl-6 space-y-1 text-sm text-muted-foreground">
          <li>Create Suppliers with NMR ranks.</li>
          <li>Create Activity Templates in the Activity Library.</li>
          <li>Add schedule item templates (milestones/tasks) to each Activity Template.</li>
          <li>Create a Project and add activities from the library.</li>
          <li>Set milestone dates at the project level.</li>
          <li>Apply the project to suppliers to generate instances.</li>
          <li>Track supplier progress in Supplier Project detail pages.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Activity Library</h2>
        <p className="text-sm text-muted-foreground">
          Activity Templates define reusable milestone/task templates. These are copied into a
          project when the activity is added. Changes to templates do not affect existing projects
          unless you use Sync From Template.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Projects</h2>
        <p className="text-sm text-muted-foreground">
          Projects store the schedule item instances. Set milestone dates here. Tasks calculate
          automatically from offsets unless you enable a task override.
        </p>
        <p className="text-sm text-muted-foreground">
          Use "Sync From Template" on an activity to add new template items. Optionally apply
          updated anchor rules/offsets without overwriting project-specific dates.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Suppliers</h2>
        <p className="text-sm text-muted-foreground">
          Apply projects to suppliers to create supplier project instances and track progress.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Parts</h2>
        <p className="text-sm text-muted-foreground">
          Parts live under a supplier project and store PA rankings. Parts are unique per supplier
          project.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Anchor Types</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <strong>FIXED_DATE:</strong> Uses a specific date you enter. Example: Milestone 2 Due =
            2026-02-15.
          </li>
          <li>
            <strong>PROJECT_ANCHOR:</strong> Uses the project anchor date plus an offset. Example:
            Project Anchor 2026-01-01, offset +14 → 2026-01-15.
          </li>
          <li>
            <strong>SUPPLIER_ANCHOR:</strong> Uses the supplier anchor date plus an offset.
            Example: Supplier Anchor 2026-01-05, offset +7 → 2026-01-12.
          </li>
          <li>
            <strong>SCHEDULE_ITEM:</strong> Uses another schedule item planned date plus an
            offset. Example: Submit Docs anchored to Milestone 2 Due with offset -14.
          </li>
          <li>
            <strong>COMPLETION:</strong> (Future) Uses an actual completion date as the anchor.
            Not yet computed.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Statuses and Overrides</h2>
        <p className="text-sm text-muted-foreground">
          Status options: Not Started, In Progress, Blocked, Complete, Not Required.
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <strong>Milestone Date:</strong> Project-level source-of-truth date.
          </li>
          <li>
            <strong>Task Override:</strong> Optional manual date for a task when enabled.
          </li>
          <li>
            <strong>Supplier Anchor:</strong> Supplier-specific day-0 that shifts schedules.
          </li>
        </ul>
      </section>
    </div>
  );
}
