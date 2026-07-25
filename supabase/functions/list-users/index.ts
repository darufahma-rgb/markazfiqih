import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify caller is admin
    const { data: callerProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!callerProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let page = 1;
    let pageSize = 20;
    let search = '';

    const url = new URL(req.url);
    if (url.searchParams.has('page')) page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    if (url.searchParams.has('pageSize')) pageSize = Math.max(1, Math.min(100, parseInt(url.searchParams.get('pageSize') || '20', 10)));
    if (url.searchParams.has('search')) search = url.searchParams.get('search')?.trim().toLowerCase() || '';

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.page) page = Math.max(1, parseInt(body.page, 10));
        if (body.pageSize) pageSize = Math.max(1, Math.min(100, parseInt(body.pageSize, 10)));
        if (body.search !== undefined) search = String(body.search).trim().toLowerCase();
      } catch {
        // ignore JSON parse error
      }
    }

    const { data: listUsersData, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listUsersError) throw listUsersError;

    const authUsers = listUsersData.users || [];

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, nickname, phone, is_admin');
    if (profilesError) throw profilesError;

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);

    let combinedUsers = authUsers.map((u) => {
      const profile = profileMap.get(u.id);
      return {
        userId: u.id,
        email: u.email ?? '',
        nickname: profile?.nickname ?? null,
        phone: profile?.phone ?? null,
        isAdmin: profile?.is_admin ?? false,
        createdAt: u.created_at,
      };
    });

    if (search) {
      combinedUsers = combinedUsers.filter((u) => {
        const emailMatch = u.email.toLowerCase().includes(search);
        const nameMatch = (u.nickname ?? '').toLowerCase().includes(search);
        const phoneMatch = (u.phone ?? '').toLowerCase().includes(search);
        return emailMatch || nameMatch || phoneMatch;
      });
    }

    combinedUsers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalCount = combinedUsers.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const safePage = Math.min(page, totalPages);

    const pagedUsers = combinedUsers.slice((safePage - 1) * pageSize, safePage * pageSize);
    const pagedUserIds = pagedUsers.map((u) => u.userId);

    const { data: enrollmentCounts } = await supabaseAdmin
      .from('enrollments')
      .select('user_id')
      .in('user_id', pagedUserIds.length > 0 ? pagedUserIds : ['dummy']);

    const enrollCountMap = new Map<string, number>();
    (enrollmentCounts ?? []).forEach((e: any) => {
      enrollCountMap.set(e.user_id, (enrollCountMap.get(e.user_id) ?? 0) + 1);
    });

    const result = pagedUsers.map((u) => ({
      ...u,
      enrollmentCount: enrollCountMap.get(u.userId) ?? 0,
    }));

    return new Response(
      JSON.stringify({
        users: result,
        totalCount,
        totalPages,
        page: safePage,
        pageSize,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
