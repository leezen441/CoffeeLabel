import { deleteEntry, isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/entries/[id]">) {
  if (!isDbConfigured()) {
    return Response.json(
      { error: "no-database", message: "No DATABASE_URL configured." },
      { status: 503 },
    );
  }
  const { id } = await ctx.params;
  try {
    await deleteEntry(id);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: "db-error", message: String(err) }, { status: 500 });
  }
}
