import BrewGuide from "@/components/BrewGuide";
import { getLabel, isDbConfigured } from "@/lib/db";
import type { CoffeeLabel } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BrewGuidePage(props: PageProps<"/b/[id]">) {
  const { id } = await props.params;
  // The method to open on, when coming back from editing it.
  const { brew } = await props.searchParams;

  // Server-render from the database so a scanned QR works on any device.
  // Without a database the client falls back to this browser's localStorage.
  let initial: CoffeeLabel | null = null;
  if (isDbConfigured()) {
    try {
      initial = await getLabel(id);
    } catch {
      initial = null;
    }
  }

  return (
    <BrewGuide
      id={id}
      initial={initial}
      initialBrew={typeof brew === "string" ? brew : null}
    />
  );
}
