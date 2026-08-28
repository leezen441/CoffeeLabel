import { isDbConfigured, listLabels, saveLabel } from "@/lib/db";
import { normalizeLabel } from "@/lib/types";

export const dynamic = "force-dynamic";

const NO_DB = Response.json(
  { error: "no-database", message: "No DATABASE_URL configured." },
  { status: 503 },
);

export async function GET() {
  if (!isDbConfigured()) return NO_DB;
  try {
    return Response.json({ labels: await listLabels() });
  } catch (err) {
    return Response.json({ error: "db-error", message: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isDbConfigured()) return NO_DB;
  try {
    const body = await request.json();
    if (!body?.id) {
      return Response.json({ error: "bad-request", message: "Missing id." }, { status: 400 });
    }
    const saved = await saveLabel(normalizeLabel(body));
    return Response.json({ label: saved });
  } catch (err) {
    return Response.json({ error: "db-error", message: String(err) }, { status: 500 });
  }
}
