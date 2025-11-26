-- Add birthdate to profiles table
ALTER TABLE public.profiles 
ADD COLUMN birthdate date NULL;