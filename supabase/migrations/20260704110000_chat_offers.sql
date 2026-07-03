-- T07: structured chat price offers.
-- This is a chat event only; it does not create payment, purchase, billing, or advert-status side effects.

begin;

alter table public.adverts
  add column if not exists min_offer_cents integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.adverts'::regclass
      and conname = 'adverts_min_offer_cents_check'
  ) then
    alter table public.adverts
      add constraint adverts_min_offer_cents_check
      check (min_offer_cents is null or (min_offer_cents > 0 and min_offer_cents < 100000000));
  end if;
end $$;

create table if not exists public.chat_offers (
  id uuid primary key default gen_random_uuid(),
  advert_id uuid not null references public.adverts(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0 and amount_cents < 100000000),
  currency text not null default 'EUR' check (currency = 'EUR'),
  message text check (message is null or char_length(message) <= 1000),
  status text not null default 'sent' check (status in ('sent', 'declined', 'accepted_in_chat', 'expired')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists idx_chat_offers_conversation_created
  on public.chat_offers(conversation_id, created_at desc);
create index if not exists idx_chat_offers_advert_sender
  on public.chat_offers(advert_id, sender_id, created_at desc);
create index if not exists idx_chat_offers_status
  on public.chat_offers(status);

alter table public.chat_offers enable row level security;

revoke all on public.chat_offers from public, anon;
grant select, insert on public.chat_offers to authenticated;
grant update (status, responded_at) on public.chat_offers to authenticated;

drop policy if exists chat_offers_participants_read on public.chat_offers;
create policy chat_offers_participants_read on public.chat_offers
  for select to authenticated
  using (public.is_conversation_participant(conversation_id));

drop policy if exists chat_offers_sender_insert on public.chat_offers;
create policy chat_offers_sender_insert on public.chat_offers
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and status = 'sent'
    and currency = 'EUR'
    and public.is_conversation_participant(conversation_id)
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and c.advert_id = advert_id
    )
  );

drop policy if exists chat_offers_recipient_update on public.chat_offers;
create policy chat_offers_recipient_update on public.chat_offers
  for update to authenticated
  using (
    status = 'sent'
    and sender_id <> auth.uid()
    and public.is_conversation_participant(conversation_id)
  )
  with check (
    sender_id <> auth.uid()
    and status in ('declined', 'accepted_in_chat')
    and responded_at is not null
    and public.is_conversation_participant(conversation_id)
  );

commit;
