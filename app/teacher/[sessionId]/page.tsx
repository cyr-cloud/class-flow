import TeacherView from "@/components/TeacherView";
import { localMaterialEnabled } from "@/lib/localMaterial";
import { conversionEnabled } from "@/lib/conversion/queue";

export default async function TeacherPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <TeacherView sessionId={sessionId} localUploads={localMaterialEnabled()} cloudConversion={conversionEnabled()} />;
}
