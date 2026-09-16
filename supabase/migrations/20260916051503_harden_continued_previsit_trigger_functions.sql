-- Trigger functions do not need to be callable through the Data API.

revoke all on function public.prevent_duplicate_previsit_submission() from public, anon, authenticated;
revoke all on function public.link_previous_previsit() from public, anon, authenticated;
