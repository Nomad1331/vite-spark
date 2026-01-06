-- Unlock Shadow Monarch frame for PierPierro
UPDATE public.player_stats
SET unlocked_card_frames = array_append(
  COALESCE(unlocked_card_frames, ARRAY['default'::text]), 
  'shadow-monarch'::text
)
WHERE user_id = '57494574-0143-42b5-a401-1e41f4bd6f7b'
  AND NOT ('shadow-monarch' = ANY(COALESCE(unlocked_card_frames, ARRAY[]::text[])));