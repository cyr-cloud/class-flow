import TeacherView from "@/components/TeacherView";

export default async function TeacherPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <TeacherView sessionId={sessionId} />;
}
