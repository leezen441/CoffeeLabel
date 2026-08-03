import { deleteGroup, isDbConfigured, saveGroup } from "@/lib/db";

export const dynamic = "force-dynamic";

const NO_DB = () =>
  Response.json(
    { error: "no-database", message: "No DATABASE_URL configured." },
    { status: 503 },
  );

export async function PUT(request: Request, ctx: RouteContext<"/api/groups/[id]">) {
  if (!isDbConfigured()) return NO_DB();
  const { id } = await ctx.params;
  try {
    const body = await request.json();
    return Response.json({ group: await saveGroup({ ...body, id }) });
  } catch (err) {
    return Response.json({ error: "db-error", message: String(err) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/groups/[id]">) {
  if (!isDbConfigured()) return NO_DB();
  const { id } = await ctx.params;
  try {
    await deleteGroup(id);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: "db-error", message: String(err) }, { status: 500 });
  }
}
