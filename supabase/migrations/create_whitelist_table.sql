-- Create email_whitelist table
CREATE TABLE IF NOT EXISTS public.email_whitelist (
    email TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.email_whitelist ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read (needed for login check)
CREATE POLICY "Allow public read access" ON public.email_whitelist
    FOR SELECT
    USING (true);

-- Insert existing whitelist emails
INSERT INTO public.email_whitelist (email)
VALUES 
    ('damandropdead@gmail.com')
ON CONFLICT (email) DO NOTHING;
