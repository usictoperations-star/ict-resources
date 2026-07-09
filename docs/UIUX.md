# UI/UX Documentation
## MK Digital Operations Center (MK DOC)

**Version:** 1.0  
**Framework:** React + Tailwind CSS v4 + shadcn/ui

---

## 1. Design System Overview

MK DOC uses **shadcn/ui** as the component library foundation, built on top of **Radix UI** primitives and styled with **Tailwind CSS v4**. Design tokens are defined as CSS variables and support both light and dark mode.

---

## 2. Color Palette

### Semantic Tokens (CSS Variables)

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `--background` | `#ffffff` | `#09090b` | Page background |
| `--foreground` | `#09090b` | `#fafafa` | Primary text |
| `--card` | `#ffffff` | `#09090b` | Card surfaces |
| `--card-foreground` | `#09090b` | `#fafafa` | Card text |
| `--primary` | `#18181b` | `#fafafa` | Primary actions |
| `--primary-foreground` | `#fafafa` | `#18181b` | Text on primary |
| `--secondary` | `#f4f4f5` | `#27272a` | Secondary surfaces |
| `--muted` | `#f4f4f5` | `#27272a` | Muted backgrounds |
| `--muted-foreground` | `#71717a` | `#a1a1aa` | Muted/placeholder text |
| `--accent` | `#f4f4f5` | `#27272a` | Hover states |
| `--destructive` | `#ef4444` | `#7f1d1d` | Danger/delete actions |
| `--border` | `#e4e4e7` | `#27272a` | Borders |

### Status Colors

| Status | Color | Usage |
|---|---|---|
| Active / Supported | `emerald-600` | Healthy state |
| Warning / Expiring | `amber-500` | Attention needed |
| Critical | `red-600` | Immediate action |
| Info | `blue-600` | Informational |
| Inactive | `muted-foreground` | Disabled/inactive |

### Severity Colors (Security)
| Severity | Badge Style |
|---|---|
| Critical | `bg-red-100 text-red-700 border-red-200` |
| High | `bg-orange-100 text-orange-700 border-orange-200` |
| Medium | `bg-yellow-100 text-yellow-700 border-yellow-200` |
| Low | `bg-blue-100 text-blue-700 border-blue-200` |
| Info | `bg-gray-100 text-gray-700 border-gray-200` |

### Team Colors
| Team | Color Scheme |
|---|---|
| Infrastructure & Cloud Operations | `blue-100 / blue-800` |
| Application Engineering | `purple-100 / purple-800` |
| Cybersecurity & Governance | `red-100 / red-800` |
| Digital Operations & PMO | `amber-100 / amber-800` |

---

## 3. Typography

| Scale | Class | Size | Weight | Usage |
|---|---|---|---|---|
| Page title | `text-2xl font-bold` | 24px | 700 | Page headings |
| Section title | `text-base font-semibold` | 16px | 600 | Card/section headers |
| Body | `text-sm` | 14px | 400 | Default body text |
| Label | `text-xs font-medium uppercase tracking-wide` | 12px | 500 | Field labels |
| Caption | `text-xs text-muted-foreground` | 12px | 400 | Helper text |
| Monospace | `font-mono text-xs` | 12px | 400 | CVE IDs, versions |

**Font family:** System UI stack (default Tailwind/shadcn — no custom web font loaded)

---

## 4. Icons

**Library:** Lucide React (consistent stroke-based icon set)

Key icons by module:
| Module | Icon |
|---|---|
| Dashboard | `LayoutDashboard` |
| Applications | `AppWindow` |
| Infrastructure | `Server` |
| Databases | `Database` |
| Domains | `Globe` |
| Repositories | `GitBranch` |
| Releases | `Rocket` |
| Security | `Shield` |
| Software | `PackageSearch` |
| Documentation | `BookOpen` |
| Reports | `BarChart3` |
| Administration | `Settings` |
| Delete | `Trash2` |
| Edit | `Pencil` |
| Add | `Plus` |
| Loading | `Loader2` (animated spin) |

---

## 5. Spacing

Tailwind spacing scale is used throughout:
- **4px** (`p-1`, `gap-1`) — tight/compact
- **8px** (`p-2`, `gap-2`) — default small
- **12px** (`p-3`, `gap-3`) — form fields
- **16px** (`p-4`, `gap-4`) — card content
- **24px** (`p-6`, `gap-6`) — card padding
- **32px** (`p-8`) — page padding

---

## 6. Core Components

### PageHeader
```tsx
<PageHeader
  title="Applications"
  description="52 total applications"
  actions={<Button onClick={openCreate}>Add Application</Button>}
/>
```
Displays the module title, count/description, and action buttons.

### StatusBadge
```tsx
<StatusBadge status="Active" />
<StatusBadge status="maintenance" />
<StatusBadge status="decommissioned" />
```
Color-coded badge using status-to-color mapping.

### OwnerBadge
```tsx
<OwnerBadge ownerName={row.ownerName} />
```
Shows the assigned user name, or "Unassigned" in muted text.

### TeamBadge
```tsx
<TeamBadge teamId={row.teamId} />
```
Resolves team name from ID, displays colored badge per team.

### TablePagination
```tsx
<TablePagination
  page={page}
  totalPages={Math.ceil(total / limit)}
  onPageChange={setPage}
/>
```
Standard pagination controls at the bottom of all list tables.

### DeleteConfirmDialog
```tsx
<DeleteConfirmDialog
  open={!!deleteTarget}
  onConfirm={handleDelete}
  onCancel={() => setDeleteTarget(null)}
  title="Delete Application"
  description="This action cannot be undone."
/>
```
Modal confirmation for all destructive actions.

### EmptyState
Displayed when a list has no results, with an appropriate icon and call-to-action.

### Field (in forms)
```tsx
<Field label="Status" error={errors.status}>
  <SelectField ... />
</Field>
```
Wraps form controls with a label and error display.

### OwnerSelectField / TeamSelectField
```tsx
<OwnerSelectField value={form.ownerId} onValueChange={v => setForm(f => ({ ...f, ownerId: v }))} />
<TeamSelectField value={form.teamId} onValueChange={v => setForm(f => ({ ...f, teamId: v }))} />
```
Select dropdowns that fetch users/teams from the API.

---

## 7. Layout

### Application Shell
```
┌─────────────────────────────────────────────────────────┐
│  Header (logo, search bar, theme toggle, user avatar)   │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│   Sidebar    │          Main Content Area               │
│   (250px)    │          (full width, scrollable)        │
│              │                                          │
│  Navigation  │  PageHeader                              │
│  Groups:     │  ├── Module Title + Stats                │
│  - Core      │  └── Action Button (Add)                 │
│  - Security  │                                          │
│  - Mgmt      │  Table / Cards / Detail View             │
│  - Admin     │                                          │
│              │  TablePagination                         │
└──────────────┴──────────────────────────────────────────┘
```

### List Page Pattern
Every module list page follows this pattern:
1. `PageHeader` with title, count, and "Add" button
2. Optional filter bar (search, status select)
3. `Table` with sortable columns
4. `TablePagination` at the bottom
5. `Dialog` overlay for create/edit form
6. `DeleteConfirmDialog` for delete confirmation

### Detail Page Pattern
```
← Back to [Module List]

[Module Icon] [Asset Name]   [Status Badge]   [Edit Button]

┌─────────────────┐  ┌────────────────────┐
│  Section Card   │  │  Section Card      │
│  - Field: Value │  │  - Field: Value    │
│  - Field: Value │  │  - Owner Badge     │
│  - Field: Value │  │  - Team Badge      │
└─────────────────┘  └────────────────────┘
```

---

## 8. Navigation Structure

```
Sidebar Navigation
│
├── Core Operations
│   ├── Dashboard
│   ├── Applications
│   ├── Infrastructure
│   ├── Databases
│   ├── Domains & SSL
│   └── Repositories
│
├── Security & Releases
│   ├── Releases
│   └── Security Center
│
├── Asset Management
│   ├── Software Inventory
│   └── Documentation
│
└── Reporting & Admin
    ├── Reports & Analytics
    └── Administration
```

---

## 9. User Flows

### Create an Asset
```
User clicks "Add [Asset]"
    → Dialog opens with empty form
    → User fills required fields
    → User clicks "Add [Asset]"
    → Zod validation runs client-side
    → On success: API POST, dialog closes, list refreshes
    → On error: field errors displayed inline
```

### Edit an Asset
```
User clicks Pencil icon in table row
    → Same Dialog opens with row data pre-populated
    → User modifies fields
    → User clicks "Save Changes"
    → On success: API PATCH, dialog closes, list refreshes
```

### Delete an Asset
```
User clicks Trash icon
    → DeleteConfirmDialog opens
    → User clicks "Delete"
    → On success: API DELETE, list refreshes
    → Hard delete (most assets) / Soft delete (applications)
```

---

## 10. Responsive Design

MK DOC is **desktop-first** with mobile-accessible layouts:

| Breakpoint | Layout Behavior |
|---|---|
| `lg` (1024px+) | Full sidebar + multi-column grids |
| `md` (768–1023px) | Sidebar collapses to icon-only |
| `sm` (< 768px) | Mobile layout, full-width tables scroll horizontally |

Tables become horizontally scrollable on small screens. Forms switch to single-column grid below `md`.

---

## 11. Dark / Light Mode

- Toggle in the header bar (sun/moon icon)
- Preference stored in `localStorage`
- All colors defined as CSS variables — no hardcoded hex values in components
- Both modes are fully supported; no partial dark mode states

---

## 12. Accessibility

- All form inputs have associated `<label>` elements
- Error messages linked to inputs via `aria-describedby`
- Dialogs use Radix UI Dialog (manages focus trap and `aria-modal`)
- Tables use proper `<thead>` / `<tbody>` / `<th scope="col">` structure
- Status badges use color + text (not color alone) for colorblind accessibility
- Loading states shown with `Loader2` spinner + descriptive button text ("Saving...")
- Target WCAG 2.1 AA

---

## 13. Design Tokens Reference

```css
/* Defined in src/index.css */
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --card: 0 0% 100%;
  --primary: 240 5.9% 10%;
  --secondary: 240 4.8% 95.9%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --border: 240 5.9% 90%;
  --radius: 0.5rem;
}

.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  /* ... */
}
```

---

## 14. Form Validation UX

- **Client-side validation** with Zod schemas before any API call
- Field errors shown immediately beneath the field in `text-destructive`
- Required fields marked with labels (no asterisk — all labels indicate required by default)
- Numeric fields use `type="number"` inputs; form state stores as strings, converted on submit
- Date fields use `type="date"` inputs; stored as ISO date strings
- Select fields use shadcn `Select` component with `SelectField` wrapper
- Checkboxes use shadcn `Checkbox` component
