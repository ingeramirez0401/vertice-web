import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import JoinClient from './JoinClient';

interface Props { params: Promise<{ code: string }> }

export default async function UnirsePage({ params }: Props) {
  const { code } = await params;
  const supabase = await createServerSupabase();

  const { data: inviter } = await supabase.rpc('vtx_inviter_preview', { p_code: code });
  if (!inviter?.length) notFound();

  const { data: { user } } = await supabase.auth.getUser();

  return (
    <JoinClient
      code={code}
      inviter={inviter[0] as { full_name: string; role: string; subtree_size: number; depth: number }}
      userId={user?.id ?? null}
    />
  );
}
