CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;

DROP POLICY "Editors manage categories" ON public.categories;
CREATE POLICY "Editors manage categories" ON public.categories FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'editor')) WITH CHECK (private.has_role(auth.uid(), 'editor'));
DROP POLICY "Editors view all articles" ON public.articles;
DROP POLICY "Editors create articles" ON public.articles;
DROP POLICY "Editors update articles" ON public.articles;
DROP POLICY "Editors delete articles" ON public.articles;
CREATE POLICY "Editors view all articles" ON public.articles FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'editor'));
CREATE POLICY "Editors create articles" ON public.articles FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'editor'));
CREATE POLICY "Editors update articles" ON public.articles FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'editor')) WITH CHECK (private.has_role(auth.uid(), 'editor'));
CREATE POLICY "Editors delete articles" ON public.articles FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'editor'));
DROP POLICY "Editors moderate comments" ON public.comments;
CREATE POLICY "Editors moderate comments" ON public.comments FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'editor')) WITH CHECK (private.has_role(auth.uid(), 'editor'));
DROP POLICY "Editors manage subscriptions" ON public.newsletter_subscriptions;
CREATE POLICY "Editors manage subscriptions" ON public.newsletter_subscriptions FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'editor')) WITH CHECK (private.has_role(auth.uid(), 'editor'));

DROP FUNCTION public.has_role(uuid, public.app_role);
DROP FUNCTION public.increment_article_view(text);
