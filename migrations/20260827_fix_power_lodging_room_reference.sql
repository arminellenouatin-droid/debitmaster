-- DebitManager Power: aligner les ventes Auberge sur le modèle de chambres Power.
-- La table historique lodging_rooms ne contient pas les tarifs/dates utilisés par le nouveau flux.
alter table public.power_service_sales drop constraint if exists power_service_sales_room_id_fkey;
alter table public.power_service_sales add constraint power_service_sales_room_id_fkey foreign key (room_id) references public.power_lodging_rooms(id) on delete set null;
