import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import JoinClient from './JoinClient';

export const dynamic = 'force-dynamic';

interface Props { params: Promise<{ code: string }> }

export default async function UnirsePage({ params }: Props) {
  const { code } = await params;
  const supabase = await createServerSupabase();

  const [{ data: inviter }, { data: { user } }, { data: municipios }] = await Promise.all([
    supabase.rpc('vtx_inviter_preview', { p_code: code }),
    supabase.auth.getUser(),
    supabase.from('vtx_municipios').select('codigo, nombre').order('nombre'),
  ]);

  if (!inviter?.length) notFound();

  return (
    <JoinClient
      code={code}
      inviter={inviter[0] as { full_name: string; role: string; subtree_size: number; depth: number }}
      userId={user?.id ?? null}
      municipios={(municipios ?? []) as { codigo: string; nombre: string }[]}
    />
  );
}
