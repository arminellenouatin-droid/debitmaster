-- DebitMaster: remplacement du catalogue historique par Buvette, Bar restaurant et Hôtel et auberge.
begin;
delete from public.saas_plan_prices;
alter table public.saas_plan_prices drop constraint if exists saas_plan_prices_activity_code_check;
alter table public.saas_plan_prices add constraint saas_plan_prices_activity_code_check check (activity_code = any (array['BUVETTE','BAR_RESTAURANT','NIGHTCLUB_LOUNGE','HOTEL_AUBERGE']));
alter table public.saas_plan_prices drop constraint if exists saas_plan_prices_plan_code_check;
alter table public.saas_plan_prices add constraint saas_plan_prices_plan_code_check check (plan_code = any (array['BUVETTE','BAR_RESTAURANT','HOTEL_AUBERGE']));
alter table public.companies drop constraint if exists companies_activity_type_check;
alter table public.companies add constraint companies_activity_type_check check (activity_type = any (array['BUVETTE','BAR_RESTAURANT','NIGHTCLUB_LOUNGE','HOTEL_AUBERGE']));
insert into public.saas_plan_prices (activity_code, plan_code, billing_period, price_xof, description, is_active) values
('BUVETTE','BUVETTE','MONTHLY',40000,'Boissons uniquement',true),('BUVETTE','BUVETTE','ANNUAL',360000,'Boissons uniquement',true),
('BUVETTE','BAR_RESTAURANT','MONTHLY',60000,'Boissons et repas',true),('BUVETTE','BAR_RESTAURANT','ANNUAL',540000,'Boissons et repas',true),
('BUVETTE','HOTEL_AUBERGE','MONTHLY',75000,'Boissons, repas et chambres',true),('BUVETTE','HOTEL_AUBERGE','ANNUAL',675000,'Boissons, repas et chambres',true),
('BAR_RESTAURANT','BUVETTE','MONTHLY',40000,'Boissons uniquement',true),('BAR_RESTAURANT','BUVETTE','ANNUAL',360000,'Boissons uniquement',true),
('BAR_RESTAURANT','BAR_RESTAURANT','MONTHLY',60000,'Boissons et repas',true),('BAR_RESTAURANT','BAR_RESTAURANT','ANNUAL',540000,'Boissons et repas',true),
('BAR_RESTAURANT','HOTEL_AUBERGE','MONTHLY',75000,'Boissons, repas et chambres',true),('BAR_RESTAURANT','HOTEL_AUBERGE','ANNUAL',675000,'Boissons, repas et chambres',true),
('NIGHTCLUB_LOUNGE','BUVETTE','MONTHLY',40000,'Boissons uniquement',true),('NIGHTCLUB_LOUNGE','BUVETTE','ANNUAL',360000,'Boissons uniquement',true),
('NIGHTCLUB_LOUNGE','BAR_RESTAURANT','MONTHLY',60000,'Boissons et repas',true),('NIGHTCLUB_LOUNGE','BAR_RESTAURANT','ANNUAL',540000,'Boissons et repas',true),
('NIGHTCLUB_LOUNGE','HOTEL_AUBERGE','MONTHLY',75000,'Boissons, repas et chambres',true),('NIGHTCLUB_LOUNGE','HOTEL_AUBERGE','ANNUAL',675000,'Boissons, repas et chambres',true),
('HOTEL_AUBERGE','BUVETTE','MONTHLY',40000,'Boissons uniquement',true),('HOTEL_AUBERGE','BUVETTE','ANNUAL',360000,'Boissons uniquement',true),
('HOTEL_AUBERGE','BAR_RESTAURANT','MONTHLY',60000,'Boissons et repas',true),('HOTEL_AUBERGE','BAR_RESTAURANT','ANNUAL',540000,'Boissons et repas',true),
('HOTEL_AUBERGE','HOTEL_AUBERGE','MONTHLY',75000,'Boissons, repas et chambres',true),('HOTEL_AUBERGE','HOTEL_AUBERGE','ANNUAL',675000,'Boissons, repas et chambres',true);
commit;
