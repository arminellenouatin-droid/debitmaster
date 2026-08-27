-- DebitManager Power Auberge: conserver l’heure de début de chaque occupation.
alter table public.power_lodging_rooms add column if not exists occupied_started_at timestamptz;
