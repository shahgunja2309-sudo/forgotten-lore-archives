CREATE OR REPLACE VIEW public.article_like_counts AS
  SELECT article_id, count(*)::int AS like_count
  FROM public.article_likes
  GROUP BY article_id;

CREATE OR REPLACE VIEW public.comment_like_counts AS
  SELECT comment_id, count(*)::int AS like_count
  FROM public.comment_likes
  GROUP BY comment_id;

GRANT SELECT ON public.article_like_counts, public.comment_like_counts TO anon, authenticated;

REVOKE SELECT ON public.article_likes FROM anon;
REVOKE SELECT ON public.comment_likes FROM anon;
REVOKE SELECT ON public.followers FROM anon;

DROP POLICY IF EXISTS "Article likes are public" ON public.article_likes;
CREATE POLICY "Users can see their own article likes" ON public.article_likes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Comment likes are public" ON public.comment_likes;
CREATE POLICY "Users can see their own comment likes" ON public.comment_likes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Follower total is public" ON public.followers;
CREATE POLICY "Users can see their own follow" ON public.followers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);