# Knowing Eye - Project OS

A **self-contained static "Project OS"** that bundles the capstone documentation and a full project-management workspace into a single zero-backend site. Clone → push → the live site updates. No servers. No databases.

> **Project:** Knowing Eye - A Full-Stack Session-Guided Web-Based Examination Platform with Integrated Behavior Monitoring
> **Institution:** Legacy College of Compostela · Institute of Information Technology

## What is Project OS?

A single static master shell (SPA) acts as the project's operating system. Documentation pages, diagrams, and PM tools are plugins loaded into one layout. Committed JSON seeds provide the default state; IndexedDB holds your edits; localStorage holds UI preferences.

### Features

| Module | Description |
|--------|-------------|
| **Dashboard** | Health score, milestone countdown, task counts, team workload, implementation status |
| **Tasks** | Kanban board (5 columns), drag-and-drop, CRUD, filters - persists to IndexedDB |
| **Gantt** | Pure-SVG timeline: draggable/resizable bars, dependencies, milestones, today line, zoom, export |
| **WBS** | Expandable tree with roll-up progress, outline export |
| **Team** | Member cards, RACI matrix, workload, adviser panel |
| **Milestones** | Institutional + technical milestones with countdown and overdue alerts |
| **Risks** | Register with auto score (probability × impact) and SVG heat map |
| **Documentation** | In-app navigator for all chapters and references |
| **Architecture** | Reference pages + diagram gallery + graph viewer |
| **Testing** | Suite summary, traceability, classification metrics (Accuracy/Recall/Precision/F1) |
| **Reports** | Status report preview, JSON/CSV/SVG exports, print stylesheet |
| **Settings** | Theme, seed version, reset/import/export data, deployment info |

## Quick start (local)

ES modules and `fetch()` require HTTP - **do not** open `index.html` from the file system.

```bash
# from this folder (docs-new/)
./deploy.sh          # macOS/Linux
deploy.bat           # Windows
```

Then open <http://localhost:8080>.

## Push-to-deploy (GitHub Pages)

1. Push the repository to GitHub (`main`).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow at `.github/workflows/deploy.yml` validates the seed JSON and publishes `docs-new/`.

After setup: **save → git push → site updates** automatically.

### Cloudflare Pages (alternative)

- Build command: *none*
- Output directory: `docs-new`

## Data model

| Layer | Purpose | Git tracked |
|-------|---------|-------------|
| `os/data/seed/*.json` | Default project data shipped with the deploy | ✅ Yes |
| IndexedDB (`knowing-eye-project-os`) | Your edits (tasks moved, risks added, dates changed) | ❌ No |
| localStorage | UI preferences (theme, last route) | ❌ No |
| `general/Project.json` | Codebase-aligned manifest | ✅ Yes |

Use **Settings → Export all data** to download a JSON backup of your IndexedDB edits, and **Import** to restore. To make edits permanent for everyone, fold them back into the seed JSON and commit.

## Folder structure

```
docs-new/
├── index.html              # Master shell (Project OS SPA)
├── os/
│   ├── app.js              # bootstrap + plugin loader + hash router
│   ├── config/project.json # runtime config (modules, theme, deployment)
│   ├── core/               # router, store, events, plugin-registry, utils
│   ├── assets/             # os.css, styles.css, theme.js, charts/
│   ├── modules/            # 12 plugin modules
│   └── data/seed|schema/   # committed seeds + JSON schemas
├── general/                # Project.json manifest + markdown summaries
├── chapter1/ chapter2/     # manuscript (Ch. II = Methodology, Parts A–E)
├── architecture/           # tech docs + graph viewer + graphs
├── backend/ database/ frontend/   # machine-readable references
├── testing/                # IEEE + UTAUT packs
├── deploy.sh deploy.bat README.md
```

## Adding a new plugin module

1. Create `os/modules/<name>/module.js` exporting `{ id, label, icon, mount, unmount }`.
2. Add a seed file under `os/data/seed/` if it needs data.
3. Add an entry to `modules[]` in `os/config/project.json`.

```js
export const id = 'example';
export const label = 'Example';
export const icon = 'grid';
export async function mount(container, { store, config, events, utils }) {
  container.innerHTML = `<section class="module-page"><h1>${label}</h1></section>`;
}
export function unmount(container) { container.innerHTML = ''; }
```

## Reusing `os/` in another project

Replace only `os/config/project.json`, `os/data/seed/*.json`, `general/Project.json`, and the documentation HTML. Keep `os/core/`, `os/assets/charts/`, and the deployment workflow identical - no project names are hardcoded in core.

## Documentation

- **Chapter I - Introduction:** `chapter1/01-introduction.html`
- **Chapter II - Methodology (Parts A–E):** `chapter2/index.html`
- **Architecture & graphs:** `architecture/graph-viewer.html`

## Credits

Saturnino C. Ancog III · Khrisha Marie O. Cavan · Kervy N. Cadiente · Twixt Jasley J. Tamera
