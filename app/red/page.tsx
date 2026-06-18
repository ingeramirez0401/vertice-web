import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import MeshCanvas from '@/components/MeshCanvas';

export default async function RedPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth');
  return <MeshCanvas userId={user.id} />;
}
