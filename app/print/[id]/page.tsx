import PrintView from "@/components/PrintView";

export default async function PrintPage(props: PageProps<"/print/[id]">) {
  const { id } = await props.params;
  return <PrintView id={id} />;
}
