import StudentView from "@/components/StudentView";

export default async function StudentPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <StudentView sessionId={sessionId} />;
}
