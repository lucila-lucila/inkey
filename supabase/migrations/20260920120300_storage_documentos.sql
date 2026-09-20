-- Storage privado para los documentos del alquiler (por ahora, el contrato;
-- en la Fase 3 se suman los comprobantes de pago).
--
-- Los archivos se guardan como <rental_id>/<nombre> y se sirven SOLO con URLs
-- firmadas de vida corta, únicamente a las dos partes de ese alquiler.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos',
  'documentos',
  false,
  10485760, -- 10 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

/*
 * Primera carpeta de la ruta = id del alquiler. Devuelve null si no es un
 * uuid, así una ruta rara no hace explotar la política.
 */
create or replace function public.rental_id_de_ruta(p_ruta text)
returns uuid
language plpgsql
immutable
as $$
declare
  v_primera text := (storage.foldername(p_ruta))[1];
begin
  if v_primera is null or v_primera !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return v_primera::uuid;
end;
$$;

comment on function public.rental_id_de_ruta is
  'Extrae el id del alquiler de la ruta del archivo (<rental_id>/<archivo>).';

-- Las dos partes del alquiler, y nadie más. El exists() pasa por RLS de
-- rentals, así que para un tercero simplemente no hay fila.
create policy "documentos: los ven las partes del alquiler"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documentos'
    and exists (
      select 1 from public.rentals r
       where r.id = public.rental_id_de_ruta(name)
         and (r.tenant_id = (select auth.uid()) or r.owner_id = (select auth.uid()))
    )
  );

create policy "documentos: los suben las partes del alquiler"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documentos'
    and exists (
      select 1 from public.rentals r
       where r.id = public.rental_id_de_ruta(name)
         and (r.tenant_id = (select auth.uid()) or r.owner_id = (select auth.uid()))
    )
  );

create policy "documentos: los reemplazan las partes del alquiler"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'documentos'
    and exists (
      select 1 from public.rentals r
       where r.id = public.rental_id_de_ruta(name)
         and (r.tenant_id = (select auth.uid()) or r.owner_id = (select auth.uid()))
    )
  );

create policy "documentos: los borra quien los subió"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documentos'
    and owner = (select auth.uid())
    and exists (
      select 1 from public.rentals r
       where r.id = public.rental_id_de_ruta(name)
         and (r.tenant_id = (select auth.uid()) or r.owner_id = (select auth.uid()))
    )
  );
