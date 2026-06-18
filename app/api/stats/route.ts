import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getRedis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

const CACHE_KEY = 'vertice:stats';
const CACHE_TTL = 60;

export async function GET() {
  try {
    const redis = getRedis();
    const cached = await redis.get(CACHE_KEY).catch(() => null);
    if (cached) return NextResponse.json(JSON.parse(cached));
  } catch {}

  const supabase = getAdminClient();
  const { data, error } = await supabase.from('vtx_network_stats').select('*').single();
  if (error || !data) {
    return NextResponse.json({ error: 'No disponible' }, { status: 503 });
  }

  try {
    const redis = getRedis();
    await redis.set(CACHE_KEY, JSON.stringify(data), 'EX', CACHE_TTL);
  } catch {}

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
  });
}
