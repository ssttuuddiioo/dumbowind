-- Reset America: press log + a single-row counter.
-- RLS is on with no policies, so the anon key can't touch these tables.
-- The Next.js API calls increment_reset() with the service role key.

create table if not exists public.reset_counter (
  id int primary key default 1 check (id = 1),
  total bigint not null default 0
);

-- Starting number for the demo. Set to 0 (or the real tally) before launch.
insert into public.reset_counter (id, total) values (1, 187531)
on conflict (id) do nothing;

create table if not exists public.reset_presses (
  id bigint generated always as identity primary key,
  session_id text not null unique,
  topic text not null,
  city text,
  created_at timestamptz not null default now()
);

alter table public.reset_counter enable row level security;
alter table public.reset_presses enable row level security;

-- Adds one press and returns the new total. The unique session_id means a
-- session counts once; the row lock on reset_counter serializes concurrent
-- presses so no increment is lost.
create or replace function public.increment_reset(p_session text, p_topic text, p_city text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total bigint;
begin
  insert into reset_presses (session_id, topic, city)
  values (p_session, p_topic, p_city)
  on conflict (session_id) do nothing;

  if found then
    update reset_counter set total = total + 1 where id = 1 returning total into v_total;
    return json_build_object('total', v_total, 'counted', true);
  end if;

  select total into v_total from reset_counter where id = 1;
  return json_build_object('total', v_total, 'counted', false);
end;
$$;

revoke all on function public.increment_reset(text, text, text) from public, anon, authenticated;
grant execute on function public.increment_reset(text, text, text) to service_role;
