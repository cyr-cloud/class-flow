import ChatRoom from "@/components/chat/ChatRoom";
import TeacherView from "@/components/TeacherView";
import { localMaterialEnabled } from "@/lib/localMaterial";
import { conversionEnabled } from "@/lib/conversion/queue";

export default async function TeacherPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <ChatRoom sessionId={sessionId} role="teacher" enabled={!!process.env.CHAT_SERVER_URL && !!process.env.CHAT_TOKEN_SECRET}><TeacherView sessionId={sessionId} localUploads={localMaterialEnabled()} cloudConversion={conversionEnabled()} /></ChatRoom>;
}
