-- Snaily Math: friends & gifts backend (Supabase / Postgres).
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Model: a "family" is a Supabase auth user (anonymous sign-in, created on a
-- device after the parent gate; no email or name is collected). A family has
-- child profiles with a preset nickname and a colour. Children become friends
-- when one shows a one-time QR/friend code and the other redeems it. Both
-- sides pass the parent gate, so both parents approve. Gifts are a fixed set
-- of game items; there is no free text anywhere.
--
-- Clients never read other families' rows directly. Everything that crosses
-- families goes through the SECURITY DEFINER functions below.

create extension if not exists pgcrypto;

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  family uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (nickname ~ '^[A-Z][a-z]+ [A-Z][a-z]+ [0-9]{1,3}$' and length(nickname) <= 32),
  color text not null check (color in ('orange','pink','blue','green','purple','yellow')),
  created_at timestamptz not null default now()
);
create index if not exists children_family on public.children(family);

create table if not exists public.progress (
  child uuid primary key references public.children(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.friend_invites (
  code text primary key,
  child uuid not null references public.children(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  used_by uuid references public.children(id) on delete set null
);
create index if not exists friend_invites_child on public.friend_invites(child);

create table if not exists public.friendships (
  a uuid not null references public.children(id) on delete cascade,
  b uuid not null references public.children(id) on delete cascade,
  status text not null default 'active' check (status in ('active','blocked')),
  blocked_by uuid references public.children(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
create index if not exists friendships_b on public.friendships(b);

create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  from_child uuid not null references public.children(id) on delete cascade,
  to_child uuid not null references public.children(id) on delete cascade,
  item text not null check (item in ('pond','hill','bridge','tree','bakery','market','shed','clock','orchard','treat')),
  thanks text check (thanks in ('heart','star','hug','yum')),
  thanks_seen boolean not null default false,
  opened_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists gifts_to on public.gifts(to_child, created_at desc);
create index if not exists gifts_from on public.gifts(from_child, created_at desc);

-- Row level security: a family sees only its own children and progress.
alter table public.children enable row level security;
alter table public.progress enable row level security;
alter table public.friend_invites enable row level security;
alter table public.friendships enable row level security;
alter table public.gifts enable row level security;

drop policy if exists own_children on public.children;
create policy own_children on public.children for all to authenticated
  using (family = auth.uid()) with check (family = auth.uid());
drop policy if exists own_progress on public.progress;
create policy own_progress on public.progress for all to authenticated
  using (exists (select 1 from public.children c where c.id = child and c.family = auth.uid()))
  with check (exists (select 1 from public.children c where c.id = child and c.family = auth.uid()));
-- invites, friendships and gifts: no direct access (functions only).

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update, delete on public.children to authenticated;
grant select, insert, update, delete on public.progress to authenticated;

-- ------------------------------------------------------------- helpers
create or replace function public._mine(c uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from children where id = c and family = auth.uid()) then
    raise exception 'not your child profile' using errcode = '42501';
  end if;
end $$;

create or replace function public._pair(x uuid, y uuid, out a uuid, out b uuid)
language sql immutable as $$ select least(x, y), greatest(x, y) $$;

-- ------------------------------------------------------------ invites
-- Make a one-time friend code (shown as a QR code and as 6 letters).
create or replace function public.make_invite(me uuid) returns json
language plpgsql security definer set search_path = public as $$
declare k text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  perform _mine(me);
  if (select count(*) from friend_invites where child = me and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Too many codes. Try again later.' using errcode = 'P0001';
  end if;
  delete from friend_invites where child = me and used_by is null and expires_at < now();
  loop
    k := '';
    for i in 1..6 loop k := k || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from friend_invites where code = k);
  end loop;
  insert into friend_invites(code, child) values (k, me);
  return json_build_object('code', k, 'expires_at', now() + interval '10 minutes');
end $$;

-- Redeem a friend code. Returns the new friend's nickname and colour.
create or replace function public.redeem_invite(me uuid, invite text) returns json
language plpgsql security definer set search_path = public as $$
declare inv friend_invites; other children; p record;
begin
  perform _mine(me);
  select * into inv from friend_invites where code = upper(trim(invite)) for update;
  if inv.code is null or inv.used_by is not null or inv.expires_at < now() then
    raise exception 'That code did not work. Ask your friend for a new one.' using errcode = 'P0001';
  end if;
  if inv.child = me then raise exception 'That is your own code!' using errcode = 'P0001'; end if;
  select * into other from children where id = inv.child;
  select * into p from _pair(me, inv.child);
  if exists (select 1 from friendships where a = p.a and b = p.b and status = 'blocked') then
    raise exception 'That code did not work. Ask your friend for a new one.' using errcode = 'P0001';
  end if;
  if (select count(*) from friendships where (a = me or b = me) and status = 'active') >= 50 then
    raise exception 'You have lots of friends already!' using errcode = 'P0001';
  end if;
  insert into friendships(a, b) values (p.a, p.b) on conflict do nothing;
  update friend_invites set used_by = me where code = inv.code;
  return json_build_object('id', other.id, 'nickname', other.nickname, 'color', other.color);
end $$;

-- Check whether my shown code has been used (the showing device polls this).
create or replace function public.invite_status(me uuid, invite text) returns json
language plpgsql security definer set search_path = public as $$
declare inv friend_invites; f children;
begin
  perform _mine(me);
  select * into inv from friend_invites where code = invite and child = me;
  if inv.code is null then return json_build_object('state', 'gone'); end if;
  if inv.used_by is null then
    return json_build_object('state', case when inv.expires_at < now() then 'expired' else 'waiting' end);
  end if;
  select * into f from children where id = inv.used_by;
  return json_build_object('state', 'used', 'friend', json_build_object('id', f.id, 'nickname', f.nickname, 'color', f.color));
end $$;

-- ------------------------------------------------------------ friends
create or replace function public.list_friends(me uuid) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform _mine(me);
  return coalesce((
    select json_agg(json_build_object('id', c.id, 'nickname', c.nickname, 'color', c.color,
      'since', f.created_at,
      'sent_today', (select count(*) from gifts g where g.from_child = me and g.to_child = c.id and g.created_at > now() - interval '1 day'))
      order by c.nickname)
    from friendships f join children c on c.id = case when f.a = me then f.b else f.a end
    where (f.a = me or f.b = me) and f.status = 'active'), '[]'::json);
end $$;

-- Remove (or block) a friend. Blocking stops them adding you again.
create or replace function public.remove_friend(me uuid, friend uuid, block boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  perform _mine(me);
  select * into p from _pair(me, friend);
  if block then
    insert into friendships(a, b, status, blocked_by) values (p.a, p.b, 'blocked', me)
      on conflict (a, b) do update set status = 'blocked', blocked_by = me;
  else
    delete from friendships where a = p.a and b = p.b and status = 'active';
  end if;
  delete from gifts where opened_at is null and ((from_child = friend and to_child = me));
end $$;

-- -------------------------------------------------------------- gifts
create or replace function public.send_gift(me uuid, friend uuid, gift text) returns json
language plpgsql security definer set search_path = public as $$
declare p record; n int; gid uuid;
begin
  perform _mine(me);
  select * into p from _pair(me, friend);
  if not exists (select 1 from friendships where a = p.a and b = p.b and status = 'active') then
    raise exception 'not friends' using errcode = '42501';
  end if;
  select count(*) into n from gifts where from_child = me and created_at > now() - interval '1 day';
  if n >= 3 then raise exception 'You can send 3 gifts a day. Come back tomorrow!' using errcode = 'P0001'; end if;
  insert into gifts(from_child, to_child, item) values (me, friend, gift) returning id into gid;
  return json_build_object('id', gid, 'left_today', 2 - n);
end $$;

-- Presents waiting for me, and thank-yous for presents I sent.
create or replace function public.inbox(me uuid) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform _mine(me);
  return json_build_object(
    'gifts', coalesce((select json_agg(json_build_object('id', g.id, 'item', g.item, 'at', g.created_at,
        'from', json_build_object('id', c.id, 'nickname', c.nickname, 'color', c.color)) order by g.created_at)
      from gifts g join children c on c.id = g.from_child
      where g.to_child = me and g.opened_at is null and g.created_at > now() - interval '30 days'), '[]'::json),
    'thanks', coalesce((select json_agg(json_build_object('id', g.id, 'item', g.item, 'thanks', g.thanks,
        'from', json_build_object('id', c.id, 'nickname', c.nickname, 'color', c.color)) order by g.opened_at)
      from gifts g join children c on c.id = g.to_child
      where g.from_child = me and g.thanks is not null and not g.thanks_seen), '[]'::json),
    'sent_today', (select count(*) from gifts where from_child = me and created_at > now() - interval '1 day'));
end $$;

create or replace function public.open_gift(me uuid, gift uuid, say_thanks text default null) returns json
language plpgsql security definer set search_path = public as $$
declare g gifts;
begin
  perform _mine(me);
  update gifts set opened_at = coalesce(opened_at, now()), thanks = coalesce(say_thanks, thanks)
    where id = gift and to_child = me returning * into g;
  if g.id is null then raise exception 'no such gift' using errcode = 'P0001'; end if;
  return json_build_object('id', g.id, 'item', g.item);
end $$;

-- Mark thank-yous as seen (clears them from the sender's inbox).
create or replace function public.seen_thanks(me uuid, ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _mine(me);
  update gifts set thanks_seen = true where from_child = me and id = any(ids) and thanks is not null;
end $$;

-- ---------------------------------------------------- delete everything
create or replace function public.delete_family() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();   -- cascades to all rows
end $$;

-- Housekeeping (call from a scheduled job later): old invites and gifts.
create or replace function public.cleanup() returns void
language sql security definer set search_path = public as $$
  delete from friend_invites where expires_at < now() - interval '1 day';
  delete from gifts where created_at < now() - interval '60 days';
$$;

revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.make_invite(uuid), public.redeem_invite(uuid, text), public.invite_status(uuid, text),
  public.list_friends(uuid), public.remove_friend(uuid, uuid, boolean), public.send_gift(uuid, uuid, text),
  public.inbox(uuid), public.open_gift(uuid, uuid, text), public.seen_thanks(uuid, uuid[]), public.delete_family()
  to authenticated;
