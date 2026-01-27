# Supplier Project Tracker

Local, single-user desktop app for tracking suppliers, projects, and project activities. Built with Electron, React, and TypeScript.

## Highlights
- Manage suppliers, projects, activity templates, and parts
- Apply projects to suppliers and track activity status and dates
- Schedule items with fixed dates or offset-based rules
- Local SQLite storage via sql.js (offline-first)
- Reports and settings pages for filtering and configuration

## Tech stack
- Electron + Vite
- React + TypeScript
- Tailwind CSS
- SQL.js (SQLite in the main process)

## Development
### Requirements
- Node.js (LTS recommended)

### Install
```bash
npm install
```

### Run (dev)
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Package
```bash
npm run electron:build
```

### Quality checks
```bash
npm run lint
npm run type-check
npm run verify
```

## Data storage
The app stores its database in Electron's user data directory (see `app.getPath('userData')` in `electron/database.ts`). Copy the `supplier-tracking.db` file from that directory to back up your data.

## Project structure
- `src`: renderer UI
- `electron`: main process, preload, database, migrations
- `shared`: shared types and utilities
- `spec.md`: product spec and requirements
