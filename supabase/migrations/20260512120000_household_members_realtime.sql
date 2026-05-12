-- Enable Supabase realtime on household_members so the client can react
-- live when an owner soft-removes a member (sets pending_exit_at).

ALTER PUBLICATION supabase_realtime ADD TABLE public.household_members;
