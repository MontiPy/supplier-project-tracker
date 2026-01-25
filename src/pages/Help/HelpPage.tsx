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
          <li>Create Suppliers.</li>
          <li>Create Activity Templates in the Activity Library.</li>
          <li>Add schedule item templates (milestones/tasks) to each Activity Template.</li>
          <li>Define applicability rules on templates if needed.</li>
          <li>Create a Project and add activities from the library.</li>
          <li>Set milestone dates at the project level.</li>
          <li>Apply the project to suppliers and set the project NMR rank if needed.</li>
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
        <p className="text-sm text-muted-foreground">
          Applicability rules control when an activity should be included based on project NMR rank
          and part PA ranks.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Projects</h2>
        <p className="text-sm text-muted-foreground">
          Projects store the schedule item instances. Set milestone dates here. Tasks calculate
          automatically from offsets unless you enable a planned date override.
        </p>
        <p className="text-sm text-muted-foreground">
          Use "Sync From Template" on an activity to add new template items. Optionally apply
          updated anchor rules/offsets without overwriting project-specific dates. Sync also removes
          items deleted from the template.
        </p>
        <p className="text-sm text-muted-foreground">
          The audit log records propagation runs and override changes.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Suppliers</h2>
        <p className="text-sm text-muted-foreground">
          Apply projects to suppliers to create supplier project instances and track progress. Each
          supplier project can have its own NMR rank.
        </p>
        <p className="text-sm text-muted-foreground">
          Use activity overrides to force activities required or not required for a specific
          supplier project.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Parts</h2>
        <p className="text-sm text-muted-foreground">
          Parts live under a supplier project and store PA rankings. Parts are unique per supplier
          project and used in applicability rules.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Reports</h2>
        <p className="text-sm text-muted-foreground">
          Reports include supplier progress, project progress across suppliers, and detailed overdue
          and due-soon lists. Export CSV from any tab.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Search</h2>
        <p className="text-sm text-muted-foreground">
          Use search on Suppliers, Projects, and Activity Library to quickly filter by name or
          category.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage NMR/PA rank lists, propagation policies, and business day calculations. Use backup
          export/import to save or restore your database, or wipe all data to start fresh.
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
            <strong>SCHEDULE_ITEM:</strong> Uses another schedule item planned date plus an
            offset. Example: Submit Docs anchored to Milestone 2 Due with offset -14.
          </li>
          <li>
            <strong>COMPLETION:</strong> Uses another schedule item's actual completion date as the
            anchor. Planned dates update when the referenced item is completed.
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
            <strong>Planned Date Override:</strong> Optional manual planned date when enabled.
          </li>
          <li>
            <strong>Lock:</strong> Prevents propagation updates to planned dates.
          </li>
          <li>
            <strong>Activity Override:</strong> Force an activity required or not required for one
            supplier project.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Attachments</h2>
        <p className="text-sm text-muted-foreground">
          Supplier activities can store links (URLs) with optional labels for specs, emails, or
          documents.
        </p>
      </section>
    </div>
  );
}
