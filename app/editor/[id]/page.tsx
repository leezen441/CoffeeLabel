import LabelEditor from "@/components/LabelEditor";

export default async function EditorPage(props: PageProps<"/editor/[id]">) {
  const { id } = await props.params;
  return <LabelEditor id={id} />;
}
