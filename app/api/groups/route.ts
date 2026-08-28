import { isDbConfigured, listGroups, saveGroup } from "@/lib/db";

export const dynamic = "force-dynamic";

const NO_DB = () =>
  Response.json(
    { error: "no-database", message: "No DATABASE_URL configured." },
    { status: 503 },
  );

export async function GET() {
  if (!isDbConfigured()) return NO_DB();
  try {
    return Response.json({ groups: await listGroups() });
  } catch (err) {
    return Response.json({ error: "db-error", message: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isDbConfigured()) return NO_DB();
  try {
    const body = await request.json();
    if (!body?.id || !body?.name) {
      return Response.json(
        { error: "bad-request", message: "Missing id or name." },
        { status: 400 },
      );
    }
    return Response.json({ group: await saveGroup(body) });
  } catch (err) {
    return Response.json({ error: "db-error", message: String(err) }, { status: 500 });
  }
}
