export const REACTIONS = [
  { emoji: "👍", label: "좋아요" },
  { emoji: "❤️", label: "하트" },
  { emoji: "😂", label: "웃음" },
  { emoji: "😮", label: "놀라워요" },
  { emoji: "👏", label: "박수" },
  { emoji: "🎉", label: "축하해요" },
] as const;

export interface SlideReaction {
  id: string;
  slideNo: number;
  emoji: string;
  senderId: string;
  createdAt: number;
}
