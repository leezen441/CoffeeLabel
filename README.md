# Bean Label — Coffee Sticker Studio

Design, store and print brew-guide stickers for coffee beans. Fill in the roaster
and bean details, set the roast level, add up to five brew recipes, then print the
label at a real millimetre size and stick it on the bag.

## What goes on a label

| Field | Notes |
| --- | --- |
| Roaster / shop name | Small caps, top-left |
| Coffee name | Display serif headline |
| Variety, Process, Origin, Altitude | Combined into one meta line |
| Roast level | 1–5 coffee-bean icons + name (Light → Dark) |
| Roast date | Plus an auto-calculated **Best before** (roast date + N days) |
| Tasting notes | Up to 4 |
| Net weight | Footer |
| Brew methods | 3 by default, up to 5 |
| QR code | Optional — scans to the full brew guide on a phone |

Each brew method holds:

- **Method** — Espresso, Filter, V60, Aeropress, French Press, Moka Pot, Chemex,
  Cold Brew, Kalita Wave, Siphon (or type your own)
- **Water temperature** in °C
- **Dose → Yield** in grams, with the **ratio computed automatically** (`1:2`, `1:16.7`)
- **Total time**
- **Grinder** and **grind setting** — printed on their own line, e.g.
  `GRIND  Comandante C40 · 24 clicks`. The grinder field has a preset list
  (Comandante, 1Zpresso, Timemore, Niche, DF64, …) but accepts anything typed.
- **Brew sequence** — an ordered, reorderable list of steps, each with an optional
  timestamp (`0:45`)

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Library — all labels, search, duplicate, delete, JSON export/import |
| `/editor/[id]` | Form with a live sticker preview; autosaves as you type |
| `/print/[id]` | Print sheet — paper size, copies, gap, cut guides |
| `/b/[id]` | Mobile brew guide — what the QR code opens |

## Sticker sizes

`100×70`, `90×60`, `80×50`, `70×40`, `60×60` mm and an A6 brew card (105×148 mm).

The layout is defined in units of 1% of the label width, so one design renders
correctly at every size. Content that would overflow is scaled down automatically
until it fits — nothing is ever clipped. On the smallest labels choose the
**Compact** layout, which prints the specs line without the step-by-step sequence.

## Printing

Open a label → **Print stickers**. Choose:

- **Paper** — A4, US Letter, or "Label printer — one per page" (sets `@page` to the
  exact sticker size for a thermal/roll printer)
- **Copies** — tiled across as many pages as needed
- **Gap** between stickers, and dashed **cut guides**

In the browser print dialog set **Margins: None**, **Scale: 100%**, and enable
**Background graphics** so the colours print.

## Storage

The app works in two modes and tells you which one is active with a badge in the
header:

- **Database** — when a Postgres connection string is present. Labels are stored in
  a `coffee_labels` table (created automatically on first use) and are available from
  any device, which is what makes the QR codes work off your phone.
- **This browser** — no database configured; labels live in `localStorage`. Handy for
  a quick local try, but a scanned QR code will only resolve on the same browser.

Use **Export** / **Import** in the header to move labels between the two.

## Local development

```bash
npm install
npm run dev
```

Then open http://localhost:3000. No database is required to start.

To develop against Postgres, copy `.env.example` to `.env.local` and set
`DATABASE_URL`.

## Deploying to Vercel

1. Push this folder to a Git repository.
2. In Vercel, **Add New → Project** and import the repository. The defaults are
   correct — it is a standard Next.js app, no build configuration needed.
3. Add the database: project → **Storage** → **Create Database** → **Neon (Postgres)**
   → connect it to the project. Vercel injects `DATABASE_URL` automatically.
4. Redeploy. The header badge should now read **Database**, and the
   `coffee_labels` table is created on the first save.

`POSTGRES_URL`, `DATABASE_URL_UNPOOLED` and `POSTGRES_URL_NON_POOLING` are also
accepted, so most Vercel Postgres and Neon integrations work without any change.

### One note on access

There is no login. Anyone who knows the deployment URL can read and edit the labels.
For personal use, turn on **Settings → Deployment Protection → Vercel Authentication**
in the Vercel dashboard — that restricts the whole site to your Vercel account
without any code changes. Leave it off if you want QR codes to open for other people.

## Tech

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 ·
`@neondatabase/serverless` · `qrcode`. Labels are stored as JSONB, so adding a field
later does not need a migration.
