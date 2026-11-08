grant insert on public.food_truck_sales to authenticated;

create policy "food_truck_sales_admin_insert"
on public.food_truck_sales
for insert
to authenticated
with check (
  exists (
    select 1
    from public.admin_profiles p
    where p.user_id = (select auth.uid())
      and p.enabled = true
      and (p.role = 'super_admin' or p.can_manage_food_truck = true)
  )
);
