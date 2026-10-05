-- Fix an ambiguous PostgREST RPC overload left by the initial room migration.
-- The client sends JSON values and must resolve partyplay_create_room to one signature.

drop function if exists public.partyplay_create_room(text, text, integer);

-- Ask PostgREST to refresh its schema cache immediately.
notify pgrst, 'reload schema';
