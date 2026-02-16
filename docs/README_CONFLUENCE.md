# Costra documentation for Confluence

This folder contains user-facing feature documentation formatted for **Atlassian Confluence**.

## Files

| File | Purpose |
|------|---------|
| **CONFLUENCE_USER_FEATURES.md** | Main feature list and short descriptions. Use as the primary page or parent page in Confluence. |
| **CONFLUENCE_FEATURE_DETAILS.md** | Deeper detail for selected features (Dashboard, Budgets, Reports, Recommendations, Notifications, Email, Saved views, Spend goals, API keys, Plans). Use as child pages or expand sections. |
| **README_CONFLUENCE.md** | This file – how to use the docs in Confluence. |

## How to use in Confluence

### Option 1: Paste Markdown (Confluence Cloud)

1. Create a new Confluence page (or open an existing one).
2. Type `/markdown` and choose **Markdown** block (or use **Insert → Markdown**).
3. Paste the contents of `CONFLUENCE_USER_FEATURES.md` (and optionally `CONFLUENCE_FEATURE_DETAILS.md`).
4. Confluence will render headings, tables, and lists. Adjust any formatting if needed.

### Option 2: Copy sections

- Use **CONFLUENCE_USER_FEATURES.md** as the master list. Copy individual sections (e.g. “3. Dashboard”, “14. Settings”) into separate Confluence pages or panels for a structured space.
- Use **CONFLUENCE_FEATURE_DETAILS.md** for “How it works” or “Details” child pages.

### Option 3: Convert Markdown to Confluence storage format

- If your space uses Confluence wiki or storage format, use a Markdown → Confluence converter (e.g. [md2confluence](https://github.com/kovetskiy/md2confluence), or built-in import if available) to produce Confluence XML/HTML. Then import or paste the result.

### Option 4: Tables and panels

- **Tables** in the Markdown will render as Confluence tables.
- For **info/warning panels**, add a Confluence **Info** or **Warning** macro and paste the relevant bullet list or paragraph from the docs.

## Suggested Confluence structure

- **Costra User Guide** (parent)
  - **Overview & getting started** (from §1–2)
  - **Dashboard** (§3)
  - **Budgets** (§4)
  - **Reports** (§5)
  - **Compare** (§6)
  - **Recommendations** (§7)
  - **Provider detail & cost views** (§8–9)
  - **Notifications** (§10)
  - **Alerts & email** (§11)
  - **Exports** (§12)
  - **Profile** (§13)
  - **Settings** (§14)
  - **Billing** (§15)
  - **Appearance & saved views** (§16)
  - **Spend goals** (§17)
  - **API keys** (§18)
  - **Security & compliance** (§19)
  - **Quick reference** (§20)
- **Feature details** (child of User Guide, or separate page) – content from **CONFLUENCE_FEATURE_DETAILS.md**

## Updating the docs

- When you add or change a feature in the app, update the corresponding section in `CONFLUENCE_USER_FEATURES.md` and, if needed, in `CONFLUENCE_FEATURE_DETAILS.md`.
- Re-paste or re-import the updated Markdown into Confluence, or update the specific Confluence page that maps to that section.
