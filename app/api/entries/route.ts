import { isDbConfigured, listEntries, saveEntry } from "@/lib/db";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const NO_DB = () =>
  Response.json(
    { error: "no-database", message: "No DATABASE_URL configured." },
    { status: 503 },
  );

export async function GET(request: NextRequest) {
  if (!isDbConfigured()) return NO_DB();
  const labelId = request.nextUrl.searchParams.get("labelId") ?? undefined;
  try {
    return Response.json({ entries: await listEntries(labelId) });
  } catch (err) {
    return Response.json({ error: "db-error", message: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isDbConfigured()) return NO_DB();
  try {
    const body = await request.json();
    if (!body?.id || !body?.labelId) {
      return Response.json(
        { error: "bad-request", message: "Missing id or labelId." },
        { status: 400 },
      );
    }
    return Response.json({ entry: await saveEntry(body) });
  } catch (err) {
    return Response.json({ error: "db-error", message: String(err) }, { status: 500 });
  }
}
