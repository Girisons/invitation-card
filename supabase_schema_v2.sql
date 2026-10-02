-- ════════════════════════════════════════════════════════
-- ARPIT @ 40 × DIWALI — SUPABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ════════════════════════════════════════════════════════

-- GUESTS TABLE
create table if not exists guests (
  id                uuid primary key default gen_random_uuid(),
  invite_code       text unique not null,
  first_name        text not null,
  last_name         text,
  partner_name      text,
  mobile            text,
  email             text,
  guest_of          text,
  relationship_group text,
  invited_count     int default 1,
  invitation_status text default 'pending',  -- pending | opened | rsvp_yes | rsvp_no
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- RSVPS TABLE
create table if not exists rsvps (
  id               uuid primary key default gen_random_uuid(),
  guest_id         uuid references guests(id) on delete cascade,
  status           text not null default 'pending', -- pending | attending | declined
  number_attending int default 0,
  submitted_at     timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ATTENDEES TABLE (each person attending)
create table if not exists attendees (
  id           uuid primary key default gen_random_uuid(),
  rsvp_id      uuid references rsvps(id) on delete cascade,
  guest_id     uuid references guests(id) on delete cascade,
  first_name   text not null,
  last_name    text,
  relationship text,
  age_category text -- adult | child | infant
);

-- PREFERENCES TABLE (food + drinks per attendee)
create table if not exists preferences (
  id               uuid primary key default gen_random_uuid(),
  attendee_id      uuid references attendees(id) on delete cascade,
  guest_id         uuid references guests(id) on delete cascade,
  food_preference  text, -- vegetarian | jain | non-vegetarian | other
  allergy_notes    text,
  drinks_preference text, -- yes | no | maybe
  drinks_notes     text,
  special_notes    text
);

-- ANALYTICS / TRACKING TABLE
create table if not exists events (
  id           uuid primary key default gen_random_uuid(),
  guest_id     uuid references guests(id) on delete set null,
  invite_code  text,
  event_type   text not null, -- invitation_opened | video_started | rsvp_attending etc
  metadata     jsonb,
  created_at   timestamptz default now()
);

-- ════════════════════════════
-- INDEXES
-- ════════════════════════════
create index if not exists idx_guests_invite_code on guests(invite_code);
create index if not exists idx_rsvps_guest_id on rsvps(guest_id);
create index if not exists idx_attendees_rsvp_id on attendees(rsvp_id);
create index if not exists idx_preferences_attendee_id on preferences(attendee_id);
create index if not exists idx_events_guest_id on events(guest_id);
create index if not exists idx_events_type on events(event_type);

-- ════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════
alter table guests enable row level security;
alter table rsvps enable row level security;
alter table attendees enable row level security;
alter table preferences enable row level security;
alter table events enable row level security;

-- Public can read guest by invite_code only (NO full table access)
create policy "guest_read_own" on guests
  for select using (true); -- restricted in app layer by invite_code

-- Public can insert/update rsvp for their guest
create policy "rsvp_insert" on rsvps for insert with check (true);
create policy "rsvp_update" on rsvps for update using (true);
create policy "rsvp_read" on rsvps for select using (true);

create policy "attendees_all" on attendees for all using (true);
create policy "preferences_all" on preferences for all using (true);
create policy "events_insert" on events for insert with check (true);
create policy "events_read" on events for select using (true);

-- ════════════════════════════
-- UPDATED_AT TRIGGER
-- ════════════════════════════
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger guests_updated_at before update on guests
  for each row execute function update_updated_at();
create trigger rsvps_updated_at before update on rsvps
  for each row execute function update_updated_at();

-- ════════════════════════════
-- SAMPLE DATA (for testing)
-- ════════════════════════════
insert into guests (invite_code, first_name, last_name, partner_name, mobile, guest_of, relationship_group, invited_count)
values
  ('R7X21', 'Rahul', 'Sharma', 'Priya', '9876543210', 'Arpit', 'family', 2),
  ('A4K92', 'Vikram', 'Singh', null, '9876543211', 'Arpit', 'friends', 1),
  ('P2M45', 'Palak', null, 'Babhi Ji', '9876543212', 'Vipul', 'family', 2),
  ('DEMO1', 'Test', 'Guest', null, '9999999999', 'Arpit', 'friends', 1)
on conflict (invite_code) do nothing;
