-- DebitMaster: normalisation des téléphones existants après adoption du sélecteur pays/préfixe.
begin;
update public.profiles set phone = regexp_replace(phone, '[^+0-9]', '', 'g') where phone is not null and phone <> '';
update public.employees set phone = regexp_replace(phone, '[^+0-9]', '', 'g') where phone is not null and phone <> '';
update public.employee_access_requests set phone = regexp_replace(phone, '[^+0-9]', '', 'g') where phone is not null and phone <> '';
update public.customers set phone = regexp_replace(phone, '[^+0-9]', '', 'g') where phone is not null and phone <> '';
update public.lodging_stays set customer_phone = regexp_replace(customer_phone, '[^+0-9]', '', 'g') where customer_phone is not null and customer_phone <> '';
update auth.users set phone = regexp_replace(phone, '[^+0-9]', '', 'g') where phone is not null and phone <> '';
commit;
