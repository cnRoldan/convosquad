begin;

-- The immutable instruction ID prevents a stale confirmation deleting a replacement.
create function public.delete_lineup_instruction(p_instruction_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare note public.lineup_instructions; source_draft uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into note from public.lineup_instructions where id=p_instruction_id;
 if not found then return; end if;
 perform private.require_admin(note.club_id);
 -- Match the lock order used when saving and publishing drafts.
 perform 1 from public.clubs where id=note.club_id for update;
 perform 1 from public.call_ups where id=note.call_up_id for update;
 select * into note from public.lineup_instructions where id=p_instruction_id for update;
 if not found then return; end if;
 select published_draft_id into source_draft from public.call_up_lineups where call_up_id=note.call_up_id;
 perform 1 from public.call_up_lineup_drafts where id=source_draft for update;
 -- Preserve newer, unpublished edits and notes in independent drafts.
 delete from public.lineup_draft_instructions where draft_id=source_draft and player_id=note.player_id and body=note.body;
 if found then
  update public.call_up_lineup_drafts set revision=revision+1,updated_by=auth.uid(),updated_at=clock_timestamp() where id=source_draft;
 end if;
 delete from public.lineup_instructions where id=p_instruction_id;
 update public.push_deliveries d set state='skipped' from public.push_events e
 where d.event_id=e.id and e.lineup_instruction_id=p_instruction_id and d.state='pending';
end; $$;
revoke all on function public.delete_lineup_instruction(uuid) from public,anon;
grant execute on function public.delete_lineup_instruction(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
