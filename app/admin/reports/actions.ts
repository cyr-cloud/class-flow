'use server';
// 신고 처리 (ADM-02). 관리자만. 실제 권한 확인과 처리는 DB 함수(202611200009)가 한다.
import { revalidatePath } from 'next/cache';
import { checkAdmin } from '@/lib/auth/admin';
import { isPostId } from '@/lib/gallery/model';
import { createUserClient } from '@/lib/supabase/server';

export type ModerationResult = { ok: true; message: string } | { ok: false; message: string };
export type ModerationAction = 'hide' | 'restore' | 'dismiss' | 'delete';

const DONE: Record<ModerationAction, string> = { hide: '숨겼어요.', restore: '다시 보이게 했어요.', dismiss: '문제없음으로 닫았어요.', delete: '지웠어요.' };

async function adminClient() {
  const check = await checkAdmin({ readOnly: false });
  if (check.access !== 'admin') return null;
  return { client: await createUserClient(), userId: check.userId };
}

function refresh() { revalidatePath('/admin'); revalidatePath('/admin/reports'); }

export async function moderate(input: { action: ModerationAction; target: 'post' | 'comment'; targetId: string }): Promise<ModerationResult> {
  if (!['hide', 'restore', 'dismiss', 'delete'].includes(input.action) || !['post', 'comment'].includes(input.target) || !isPostId(input.targetId)) {
    return { ok: false, message: '잘못된 요청입니다.' };
  }
  const admin = await adminClient();
  if (!admin) return { ok: false, message: '관리자만 할 수 있어요.' };
  const { client } = admin;
  let result;
  if (input.action === 'dismiss') {
    result = await client.rpc('dismiss_reports', { p_target: input.target, p_id: input.targetId });
  } else if (input.target === 'post') {
    result = input.action === 'delete'
      ? await client.rpc('delete_post', { p_id: input.targetId })
      : await client.rpc('set_post_status', { p_id: input.targetId, p_status: input.action === 'hide' ? 'hidden' : 'visible' });
  } else {
    const status = input.action === 'delete' ? 'deleted' : input.action === 'hide' ? 'hidden' : 'visible';
    result = await client.rpc('set_comment_status', { p_id: input.targetId, p_status: status });
  }
  if (result.error || result.data === false) return { ok: false, message: '처리하지 못했어요. 이미 처리됐는지 새로고침해 확인해주세요.' };
  refresh();
  return { ok: true, message: DONE[input.action] };
}

// days: 7·30 등, null이면 풀 때까지, 0이면 정지 풀기
export async function setUploadBan(input: { userId: string; days: number | null; reason?: string }): Promise<ModerationResult> {
  const days = input.days;
  if (!isPostId(input.userId) || !(days === null || (Number.isInteger(days) && days >= 0 && days <= 3650))) return { ok: false, message: '잘못된 요청입니다.' };
  const admin = await adminClient();
  if (!admin) return { ok: false, message: '관리자만 할 수 있어요.' };
  if (admin.userId === input.userId) return { ok: false, message: '나를 정지할 수는 없어요.' };
  const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 200) : '';
  const { error } = await admin.client.rpc('admin_set_upload_ban', { p_user: input.userId, p_days: days, p_reason: reason });
  if (error) return { ok: false, message: '처리하지 못했어요. 잠시 후 다시 시도해주세요.' };
  refresh();
  return { ok: true, message: days === 0 ? '업로드 정지를 풀었어요.' : days === null ? '풀 때까지 업로드를 정지했어요.' : `${days}일 동안 업로드를 정지했어요.` };
}
