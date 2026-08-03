import { neon } from "@neondatabase/serverless";
import type { CoffeeLabel, LabelGroup } from "./types";
import { normalizeLabel } from "./types";

/**
 * Vercel's Postgres/Neon integration injects one of these. When none is set the
 * app still runs — the API reports `configured: false` and the client keeps
 * labels in localStorage instead.
 */
function connectionString(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    undefined
  );
}

export function isDbConfigured(): boolean {
  return Boolean(connectionString());
}

let schemaReady: Promise<void> | null = null;

function client() {
  const url = connectionString();
  if (!url) throw new Error("No database configured");
  return neon(url);
}

async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    const sql = client();
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS coffee_labels (
          id          TEXT PRIMARY KEY,
          data        JSONB NOT NULL,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS coffee_labels_updated_at_idx
        ON coffee_labels (updated_at DESC)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS coffee_groups (
          id          TEXT PRIMARY KEY,
          data        JSONB NOT NULL,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
    })().catch((err) => {
      // Let the next call retry rather than caching a failure forever.
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

type Row = { id: string; data: CoffeeLabel };

function toLabel(row: Row): CoffeeLabel {
  return normalizeLabel({ ...row.data, id: row.id });
}

export async function listLabels(): Promise<CoffeeLabel[]> {
  await ensureSchema();
  const sql = client();
  const rows = (await sql`
    SELECT id, data FROM coffee_labels ORDER BY updated_at DESC
  `) as Row[];
  return rows.map(toLabel);
}

export async function getLabel(id: string): Promise<CoffeeLabel | null> {
  await ensureSchema();
  const sql = client();
  const rows = (await sql`
    SELECT id, data FROM coffee_labels WHERE id = ${id}
  `) as Row[];
  return rows[0] ? toLabel(rows[0]) : null;
}

export async function saveLabel(label: CoffeeLabel): Promise<CoffeeLabel> {
  await ensureSchema();
  const sql = client();
  const next = { ...label, updatedAt: new Date().toISOString() };
  await sql`
    INSERT INTO coffee_labels (id, data)
    VALUES (${next.id}, ${JSON.stringify(next)}::jsonb)
    ON CONFLICT (id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = now()
  `;
  return next;
}

export async function deleteLabel(id: string): Promise<void> {
  await ensureSchema();
  const sql = client();
  await sql`DELETE FROM coffee_labels WHERE id = ${id}`;
}

/* ------------------------------- groups ------------------------------- */

type GroupRow = { id: string; data: LabelGroup };

export async function listGroups(): Promise<LabelGroup[]> {
  await ensureSchema();
  const sql = client();
  const rows = (await sql`
    SELECT id, data FROM coffee_groups ORDER BY created_at ASC
  `) as GroupRow[];
  return rows.map((r) => ({ ...r.data, id: r.id }));
}

export async function saveGroup(group: LabelGroup): Promise<LabelGroup> {
  await ensureSchema();
  const sql = client();
  await sql`
    INSERT INTO coffee_groups (id, data)
    VALUES (${group.id}, ${JSON.stringify(group)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
  `;
  return group;
}

/** Removes the group and clears it from any label that referenced it. */
export async function deleteGroup(id: string): Promise<void> {
  await ensureSchema();
  const sql = client();
  await sql`DELETE FROM coffee_groups WHERE id = ${id}`;
  await sql`
    UPDATE coffee_labels
    SET data = jsonb_set(data, '{groupId}', '""'::jsonb)
    WHERE data->>'groupId' = ${id}
  `;
}
