-- Reservorio de Agua · nube (Supabase)
-- Pegar completo en Supabase → SQL Editor → Run. Se puede volver a ejecutar sin problema.
--
-- Seguridad:
--   * Las tablas tienen RLS activo y SIN políticas: nadie las lee ni escribe directo con la
--     clave pública (publishable/anon). Solo se usan a través de las dos funciones.
--   * ingest() exige el token secreto del ESP32 (secrets.h). En la base solo se guarda su
--     hash SHA-256, nunca el token.
--   * ultimo() entrega el último dato a la web publicada (solo lectura).

create table if not exists public.dispositivo (
  token_hash text primary key,              -- sha256 (hex) del CLOUD_TOKEN del ESP32
  creado timestamptz not null default now()
);

create table if not exists public.telemetria_ultimo (
  id int primary key default 1 check (id = 1),  -- una sola fila: el último dato
  data jsonb not null,
  recibido timestamptz not null default now()
);

create table if not exists public.telemetria_historial (
  id bigserial primary key,
  recibido timestamptz not null default now(),
  data jsonb not null
);
create index if not exists telemetria_historial_recibido on public.telemetria_historial (recibido desc);

alter table public.dispositivo enable row level security;
alter table public.telemetria_ultimo enable row level security;
alter table public.telemetria_historial enable row level security;

-- El ESP32 llama a esta función cada 5 s (y con p_historial = true una vez por minuto).
create or replace function public.ingest(p_token text, p_data jsonb, p_historial boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from dispositivo
    where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  ) then
    raise exception 'token invalido' using errcode = '28000';
  end if;
  if p_data is null or pg_column_size(p_data) > 16000 then
    raise exception 'datos invalidos';
  end if;

  insert into telemetria_ultimo (id, data, recibido) values (1, p_data, now())
  on conflict (id) do update set data = excluded.data, recibido = excluded.recibido;

  if p_historial then
    insert into telemetria_historial (data) values (p_data);
    delete from telemetria_historial where recibido < now() - interval '90 days';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- La web publicada llama a esta función: último dato + antigüedad en segundos.
create or replace function public.ultimo()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select data || jsonb_build_object(
    'source', 'cloud',
    'ageS', round(extract(epoch from now() - recibido)::numeric, 1)
  )
  from telemetria_ultimo
  where id = 1;
$$;

revoke all on function public.ingest(text, jsonb, boolean) from public;
revoke all on function public.ultimo() from public;
grant execute on function public.ingest(text, jsonb, boolean) to anon, authenticated;
grant execute on function public.ultimo() to anon, authenticated;

-- Registrar el ESP32: reemplaza el texto por el hash que te da Claude/la guía (docs/nube.md).
-- insert into public.dispositivo (token_hash) values ('HASH_SHA256_DEL_TOKEN')
-- on conflict do nothing;
