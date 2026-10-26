import BrewGuide from "@/components/BrewGuide";

export default async function BrewGuidePage(props: PageProps<"/b/[id]">) {
  const { id } = await props.params;
  // The method to open on, where Back should return to, and whether the
  // timer should be up already — the library can start a brew directly.
  const { brew, from, timer } = await props.searchParams;

  // No database read here. Waiting on it made every tap from the library sit
  // still for a full round trip; the guide loads the label itself instead,
  // straight from the library's copy when there is one. A scanned QR on
  // another device fetches it from the API, so that still works anywhere.
  return (
    <BrewGuide
      id={id}
      initialBrew={typeof brew === "string" ? brew : null}
      from={typeof from === "string" ? from : null}
      startTimer={timer === "1"}
    />
  );
}
