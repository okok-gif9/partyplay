begin;

create or replace function public.partyplay_social_overview()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
    with network as (
      select auth.uid() as user_id
      union
      select case when f.user_a=auth.uid() then f.user_b else f.user_a end
      from public.pp_friendships f where f.user_a=auth.uid() or f.user_b=auth.uid()
    ),
    scores as (
      select n.user_id,p.display_name,p.username,p.avatar_seed,
        count(distinct s.id) filter(where s.status='finished')::integer as completed_games,
        count(distinct s.id)::integer as games_played
      from network n
      join public.pp_profiles p on p.id=n.user_id
      left join public.pp_room_members m on m.user_id=n.user_id and m.role in ('host','player')
      left join public.pp_game_sessions s on s.room_id=m.room_id
      group by n.user_id,p.display_name,p.username,p.avatar_seed
    ),
    ranked as (
      select row_number() over(order by completed_games desc,games_played desc,display_name asc)::integer as rank,
        user_id,display_name,username,avatar_seed,completed_games,games_played
      from scores
    ),
    matches as (
      select s.id,s.game_type,s.status,s.round_no,s.created_at,s.finished_at,s.room_id,
        (select coalesce(jsonb_agg(p.display_name order by p.display_name),'[]'::jsonb)
         from public.pp_room_members pm join public.pp_profiles p on p.id=pm.user_id
         where pm.room_id=s.room_id and pm.role in ('host','player')) as players
      from public.pp_game_sessions s
      join public.pp_room_members mine on mine.room_id=s.room_id and mine.user_id=auth.uid() and mine.role in ('host','player')
      order by s.created_at desc
      limit 12
    )
    select jsonb_build_object(
      'leaderboard',coalesce((select jsonb_agg(jsonb_build_object('rank',r.rank,'user_id',r.user_id,'display_name',r.display_name,'username',r.username,'avatar_seed',r.avatar_seed,'completed_games',r.completed_games,'games_played',r.games_played) order by r.rank) from ranked r),'[]'::jsonb),
      'matches',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'game_type',m.game_type,'status',m.status,'round_no',m.round_no,'created_at',m.created_at,'finished_at',m.finished_at,'players',m.players) order by m.created_at desc) from matches m),'[]'::jsonb)
    )
$$;

revoke all on function public.partyplay_social_overview() from public;
grant execute on function public.partyplay_social_overview() to authenticated;
notify pgrst,'reload schema';
commit;
