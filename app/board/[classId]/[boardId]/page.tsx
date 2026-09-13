import BoardPageView from "@/components/board/BoardPageView";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ classId: string; boardId: string }>;
}) {
  const { classId, boardId } = await params;
  return <BoardPageView classId={classId} boardId={boardId} />;
}
