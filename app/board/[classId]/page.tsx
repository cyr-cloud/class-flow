import ClassPageView from "@/components/board/ClassPageView";

export default async function ClassPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  return <ClassPageView classId={classId} />;
}
