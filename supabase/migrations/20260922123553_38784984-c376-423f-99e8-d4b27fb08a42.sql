DROP POLICY IF EXISTS "Profiles are publicly readable" ON public.profiles;
REVOKE SELECT ON public.profiles FROM anon;
CREATE POLICY "Readers view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);