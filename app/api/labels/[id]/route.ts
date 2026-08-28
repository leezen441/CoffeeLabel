import { deleteLabel, getLabel, isDbConfigured, saveLabel } from "@/lib/db";
import { normalizeLabel } from "@/lib/types";

export const dynamic = "force-dynamic";

const NO_DB = () =>
  Response.json(
    { error: "no-database", message: "No DATABASE_URL configured." },
    { status: 503 },
  );

export async function GET(_request: Request, ctx: RouteContext<"/api/labels/[id]">) {
  if (!isDbConfigured()) return NO_DB();
  const { id } = await ctx.params;
  try {
    const label = await getLabel(id);
    if (!label) return Response.json({ error: "not-found" }, { status: 404 });
    return Response.json({ label });
  } catch (err) {
    return Response.json({ error: "db-error", message: String(err) }, { status: 500 });
  }
}

export async function PUT(request: Request, ctx: RouteContext<"/api/labels/[id]">) {
  if (!isDbConfigured()) return NO_DB();
  const { id } = await ctx.params;
  try {
    const body = await request.json();
    const saved = await saveLabel(normalizeLabel({ ...body, id }));
    return Response.json({ label: saved });
  } catch (err) {
    return Response.json({ error: "db-error", message: String(err) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/labels/[id]">) {
  if (!isDbConfigured()) return NO_DB();
  const { id } = await ctx.params;
  try {
    await deleteLabel(id);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: "db-error", message: String(err) }, { status: 500 });
  }
}
