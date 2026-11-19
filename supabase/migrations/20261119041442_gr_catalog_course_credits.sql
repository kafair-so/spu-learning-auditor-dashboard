-- Course credits are populated by exact-GR-ID GRGS_Public catalog synchronization.
alter table public.courses add column course_credits integer check (course_credits between 1 and 30);
comment on column public.courses.course_credits is 'Registrar credits from exact GRGS_Public Course ID; NULL means not verified. GR legacy audit only.';
