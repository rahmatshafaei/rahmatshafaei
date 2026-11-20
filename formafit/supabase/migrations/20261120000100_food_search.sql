-- Pure fats are published at up to about 902 kcal/100 g (Livsmedelsverket's "Matolja"), so the
-- old 900 kcal limit rejected real data.
alter table public.foods drop constraint foods_kcal_per_100g_check;
alter table public.foods add constraint foods_kcal_per_100g_check
  check (kcal_per_100g is null or kcal_per_100g between 0 and 950);

-- Reference foods from an external database are identified by (source, source_ref), so a new
-- import updates existing rows instead of duplicating them.
create unique index foods_reference_source_ref_idx
  on public.foods (source, source_ref)
  where owner_id is null and source_ref is not null;

-- Ranked food search. With thousands of reference foods a plain "name contains" query returns an
-- arbitrary subset, so ranking happens in the database before the limit is applied:
--   1. exact name, 2. name starts with the query, 3. a word starts with it, 4. anywhere;
--   then the user's own foods, then verified data before community data and estimates,
--   then shorter (more generic) names.
-- security invoker: RLS decides which foods are visible, exactly as for a direct select.
create or replace function public.search_foods(p_query text, p_limit integer default 25)
returns setof public.foods
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select
      lower(trim(coalesce(p_query, ''))) as term,
      replace(replace(replace(lower(trim(coalesce(p_query, ''))), '\', '\\'), '%', '\%'), '_', '\_') as pattern
  )
  select f.*
  from public.foods f, q
  where not f.is_archived
    and (
      q.term = ''
      or f.name ilike '%' || q.pattern || '%'
      or coalesce(f.brand, '') ilike '%' || q.pattern || '%'
    )
  order by
    case
      when q.term = '' then 0
      when lower(f.name) = q.term then 0
      when lower(f.name) like q.pattern || '%' then 1
      when ' ' || translate(lower(f.name), ',()/-', '     ') like '% ' || q.pattern || '%' then 2
      else 3
    end,
    (f.owner_id is null),
    case f.verification when 'verified' then 0 when 'user_entered' then 1 when 'community' then 2 else 3 end,
    char_length(f.name),
    f.name
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
$$;
revoke all on function public.search_foods(text, integer) from public, anon;
grant execute on function public.search_foods(text, integer) to authenticated;
