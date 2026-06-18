import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('key');
  if (apiKey !== process.env.EXPORT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const format = request.nextUrl.searchParams.get('format') ?? 'json';
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('vtx_members')
    .select('adhesion_code,full_name,status,depth,parent_id,child_count,subtree_size,created_at,region')
    .order('depth', { ascending: true });

  if (error || !data) {
    return NextResponse.json({ error: 'Error al exportar' }, { status: 500 });
  }

  if (format === 'csv') {
    const headers = ['adhesion_code','full_name','status','depth','parent_id','child_count','subtree_size','created_at','region'];
    const rows = data.map(r => headers.map(h => JSON.stringify((r as Record<string,unknown>)[h] ?? '')).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="vertice-${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json(data, {
    headers: { 'Content-Disposition': `attachment; filename="vertice-${Date.now()}.json"` },
  });
}
