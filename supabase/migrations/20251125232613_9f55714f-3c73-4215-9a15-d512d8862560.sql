-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create households table
CREATE TABLE public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  currency TEXT DEFAULT 'SEK' NOT NULL,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create enum for household member roles
CREATE TYPE public.household_role AS ENUM ('owner', 'member');

-- Create household_members junction table
CREATE TABLE public.household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role public.household_role NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(household_id, user_id)
);

-- Create enum for invite status
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'expired');

-- Create household_invites table
CREATE TABLE public.household_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  invited_email TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status public.invite_status DEFAULT 'pending' NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to create default household for new profiles
CREATE OR REPLACE FUNCTION public.create_default_household()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_household_id UUID;
BEGIN
  -- Create a default household
  INSERT INTO public.households (name, owner_id)
  VALUES ('My Household', NEW.id)
  RETURNING id INTO new_household_id;
  
  -- Add user as owner in household_members
  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (new_household_id, NEW.id, 'owner');
  
  RETURN NEW;
END;
$$;

-- Trigger to create household when profile is created
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_household();

-- Security definer function to get user's household ID
CREATE OR REPLACE FUNCTION public.get_user_household_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT household_id
  FROM public.household_members
  WHERE user_id = _user_id
  LIMIT 1;
$$;

-- Security definer function to check if user is household member
CREATE OR REPLACE FUNCTION public.is_household_member(_user_id UUID, _household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members
    WHERE user_id = _user_id
      AND household_id = _household_id
  );
$$;

-- Security definer function to check if user is household owner
CREATE OR REPLACE FUNCTION public.is_household_owner(_user_id UUID, _household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members
    WHERE user_id = _user_id
      AND household_id = _household_id
      AND role = 'owner'
  );
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can view profiles in their household"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm1
      WHERE hm1.user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.household_members hm2
          WHERE hm2.user_id = profiles.id
            AND hm2.household_id = hm1.household_id
        )
    )
  );

-- RLS Policies for households
CREATE POLICY "Users can view their household"
  ON public.households FOR SELECT
  USING (public.is_household_member(auth.uid(), id));

CREATE POLICY "Users can update their household"
  ON public.households FOR UPDATE
  USING (public.is_household_member(auth.uid(), id));

CREATE POLICY "Owners can delete their household"
  ON public.households FOR DELETE
  USING (public.is_household_owner(auth.uid(), id));

CREATE POLICY "Users can create households"
  ON public.households FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- RLS Policies for household_members
CREATE POLICY "Users can view members of their household"
  ON public.household_members FOR SELECT
  USING (public.is_household_member(auth.uid(), household_id));

CREATE POLICY "Owners can insert household members"
  ON public.household_members FOR INSERT
  WITH CHECK (public.is_household_owner(auth.uid(), household_id));

CREATE POLICY "Owners can delete household members"
  ON public.household_members FOR DELETE
  USING (public.is_household_owner(auth.uid(), household_id));

CREATE POLICY "Users can leave household"
  ON public.household_members FOR DELETE
  USING (auth.uid() = user_id AND role != 'owner');

-- RLS Policies for household_invites
CREATE POLICY "Users can view invites for their household"
  ON public.household_invites FOR SELECT
  USING (public.is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can create invites for their household"
  ON public.household_invites FOR INSERT
  WITH CHECK (public.is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can update invites they created"
  ON public.household_invites FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Anyone can view pending invites by code"
  ON public.household_invites FOR SELECT
  USING (status = 'pending' AND expires_at > NOW());

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_households_updated_at
  BEFORE UPDATE ON public.households
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();