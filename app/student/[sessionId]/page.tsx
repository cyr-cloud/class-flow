import ChatRoom from "@/components/chat/ChatRoom";
import StudentView from "@/components/StudentView";

export default async function StudentPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <ChatRoom sessionId={sessionId} role="student" enabled={!!process.env.CHAT_SERVER_URL && !!process.env.CHAT_TOKEN_SECRET}><StudentView sessionId={sessionId} /></ChatRoom>;
}
