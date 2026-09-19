CREATE TYPE public.app_role AS ENUM ('editor', 'reader');
CREATE TYPE public.article_status AS ENUM ('draft', 'published');
CREATE TYPE public.comment_status AS ENUM ('pending', 'approved', 'hidden');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  display_name text NOT NULL DEFAULT 'Reader',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are publicly readable" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Readers create their profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Readers update their profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'reader',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Readers view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are public" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Editors manage categories" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'editor')) WITH CHECK (public.has_role(auth.uid(), 'editor'));
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id),
  title text NOT NULL,
  subtitle text,
  slug text NOT NULL UNIQUE,
  excerpt text NOT NULL,
  topic text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  image_key text NOT NULL,
  image_alt text NOT NULL,
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_date date NOT NULL,
  status public.article_status NOT NULL DEFAULT 'draft',
  is_featured boolean NOT NULL DEFAULT false,
  reading_time integer NOT NULL DEFAULT 8 CHECK (reading_time > 0),
  view_count bigint NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  author_name text NOT NULL DEFAULT 'The Hidden Chronicle',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.articles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.articles TO authenticated;
GRANT ALL ON public.articles TO service_role;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published articles are public" ON public.articles FOR SELECT USING (status = 'published');
CREATE POLICY "Editors view all articles" ON public.articles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'editor'));
CREATE POLICY "Editors create articles" ON public.articles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'editor'));
CREATE POLICY "Editors update articles" ON public.articles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'editor')) WITH CHECK (public.has_role(auth.uid(), 'editor'));
CREATE POLICY "Editors delete articles" ON public.articles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'editor'));
CREATE INDEX articles_publication_idx ON public.articles(status, published_date DESC);
CREATE INDEX articles_category_idx ON public.articles(category_id, status, published_date DESC);
CREATE INDEX articles_tags_idx ON public.articles USING gin(tags);
CREATE TRIGGER articles_updated_at BEFORE UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.article_likes (
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, user_id)
);
GRANT SELECT ON public.article_likes TO anon, authenticated;
GRANT INSERT, DELETE ON public.article_likes TO authenticated;
GRANT ALL ON public.article_likes TO service_role;
ALTER TABLE public.article_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Article likes are public" ON public.article_likes FOR SELECT USING (true);
CREATE POLICY "Readers like articles" ON public.article_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Readers remove article likes" ON public.article_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  status public.comment_status NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.comments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved comments are public" ON public.comments FOR SELECT USING (status = 'approved');
CREATE POLICY "Readers view their comments" ON public.comments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Readers post comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Readers edit their comments" ON public.comments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Readers delete their comments" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Editors moderate comments" ON public.comments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'editor')) WITH CHECK (public.has_role(auth.uid(), 'editor'));
CREATE INDEX comments_article_idx ON public.comments(article_id, created_at DESC);
CREATE TRIGGER comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.comment_likes (
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
GRANT SELECT ON public.comment_likes TO anon, authenticated;
GRANT INSERT, DELETE ON public.comment_likes TO authenticated;
GRANT ALL ON public.comment_likes TO service_role;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comment likes are public" ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY "Readers like comments" ON public.comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Readers remove comment likes" ON public.comment_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.followers (
  user_id uuid PRIMARY KEY,
  receive_updates boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.followers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.followers TO authenticated;
GRANT ALL ON public.followers TO service_role;
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Follower total is public" ON public.followers FOR SELECT USING (true);
CREATE POLICY "Readers follow" ON public.followers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Readers update follow preferences" ON public.followers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Readers unfollow" ON public.followers FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.newsletter_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.newsletter_subscriptions TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.newsletter_subscriptions TO authenticated;
GRANT ALL ON public.newsletter_subscriptions TO service_role;
ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can subscribe" ON public.newsletter_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Editors manage subscriptions" ON public.newsletter_subscriptions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'editor')) WITH CHECK (public.has_role(auth.uid(), 'editor'));

CREATE OR REPLACE FUNCTION public.increment_article_view(article_slug text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_count bigint;
BEGIN
  UPDATE public.articles SET view_count = view_count + 1
  WHERE slug = article_slug AND status = 'published'
  RETURNING view_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;
GRANT EXECUTE ON FUNCTION public.increment_article_view(text) TO anon, authenticated;

INSERT INTO public.categories(name, slug, description) VALUES
('LOST', 'lost', 'Lost civilizations, settlements and forgotten worlds.'),
('HIDDEN', 'hidden', 'Secret documents, artifacts and discoveries.'),
('UNSOLVED', 'unsolved', 'Disappearances and unexplained historical events.'),
('MISSING', 'missing', 'Lost treasures and vanished objects.'),
('DECIPHERED', 'deciphered', 'Ancient manuscripts, codes and mysterious writings.'),
('ANCIENT', 'ancient', 'Mysteries surrounding ancient civilizations and discoveries.');

INSERT INTO public.articles(category_id, title, subtitle, slug, excerpt, topic, tags, image_key, image_alt, content, published_date, status, is_featured, reading_time, view_count) VALUES
((SELECT id FROM public.categories WHERE slug='deciphered'), 'THE BOOK THAT REFUSES TO SPEAK', 'The Voynich Manuscript', 'the-book-that-refuses-to-speak', 'An unknown writing system, impossible plants and a century of failed solutions: the Voynich Manuscript remains one of history’s most eloquent silences.', 'Voynich Manuscript cryptography medieval books', ARRAY['manuscript','code','medieval','cryptography'], 'voynich', 'The Voynich Manuscript open to pages of botanical drawings and unknown script', '[{"type":"heading","text":"THE DISCOVERY"},{"type":"paragraph","text":"In 1912, rare-book dealer Wilfrid Voynich acquired a vellum codex from a Jesuit collection near Rome. Its pages held an elegant, unknown script flowing around plants no botanist could confidently name. The book appeared deliberate, ordered and internally consistent—yet it refused every attempt at translation."},{"type":"quote","text":"The mystery is not that the writing looks strange. It is that it behaves so much like language."},{"type":"heading","text":"WHAT WE KNOW"},{"type":"paragraph","text":"Radiocarbon testing dates the parchment to the early fifteenth century. The pigments and construction are consistent with that period. Statistical studies find recurring word patterns, positional rules and sections with distinct vocabularies. Whatever the text records, its maker invested extraordinary time and material in it."},{"type":"timeline","items":[{"year":"c. 1404–1438","text":"The vellum is produced."},{"year":"1666","text":"Johannes Marcus Marci sends the manuscript to Athanasius Kircher."},{"year":"1912","text":"Wilfrid Voynich purchases the codex."},{"year":"1969","text":"The manuscript enters Yale’s Beinecke Library."}]},{"type":"heading","text":"THE QUESTIONS"},{"type":"paragraph","text":"Is the script a cipher, an invented language, a compressed notation system or an elaborate fabrication? Why do its botanical, astronomical and anatomical illustrations resist secure identification? And who possessed both the resources and motive to create it?"},{"type":"heading","text":"THEORIES"},{"type":"paragraph","text":"Researchers have proposed encrypted medical knowledge, a women’s health manual, a constructed language and a sophisticated hoax. None has produced a complete, repeatable reading. Claims of solution arrive regularly; consensus does not."},{"type":"heading","text":"THE EVIDENCE"},{"type":"paragraph","text":"The strongest evidence is material and statistical rather than interpretive. The parchment is genuinely medieval. The script follows constraints too structured for casual nonsense, while remaining unlike any securely identified writing system. Those facts narrow the field without closing the case."},{"type":"heading","text":"WHAT REMAINS UNSOLVED"},{"type":"paragraph","text":"The author, language, purpose and intended reader remain unknown. The manuscript survives not as a blank, but as a message whose structure can be measured while its meaning remains just beyond reach."}]'::jsonb, '2026-10-14', 'published', true, 12, 2400),
((SELECT id FROM public.categories WHERE slug='lost'), 'THE COLONY THAT VANISHED', 'The Lost Colony of Roanoke', 'the-colony-that-vanished', 'When John White returned to Roanoke, every colonist was gone. One carved word was the only clear message they left behind.', 'Roanoke Lost Colony colonial America', ARRAY['colony','disappearance','roanoke'], 'roanoke', 'The remains of a timber settlement on fogbound Roanoke Island', '[{"type":"heading","text":"THE DISCOVERY"},{"type":"paragraph","text":"In August 1590, governor John White stepped ashore on Roanoke Island after a three-year absence. The settlement was dismantled, the houses gone and the people missing. On a post, the letters CROATOAN had been carved with care."},{"type":"heading","text":"WHAT WE KNOW"},{"type":"paragraph","text":"The colonists had agreed to leave a sign if they relocated and a cross if they departed under duress. No cross was found. Storms prevented White from sailing to Croatoan Island, and the documentary trail ended."},{"type":"heading","text":"THEORIES"},{"type":"paragraph","text":"Possibilities include integration with Indigenous communities, movement inland, starvation, conflict or a divided migration. Archaeological finds suggest contact and dispersal, but no single site accounts for the entire colony."},{"type":"heading","text":"WHAT REMAINS UNSOLVED"},{"type":"paragraph","text":"The carved word may have been a destination, an alliance or a final instruction. What happened after the colonists left Roanoke remains beyond the surviving record."}]'::jsonb, '2026-09-28', 'published', false, 9, 1800),
((SELECT id FROM public.categories WHERE slug='hidden'), 'THE PRISONER WITHOUT A NAME', 'The Man in the Iron Mask', 'the-prisoner-without-a-name', 'A closely guarded prisoner, a concealed face and a royal secret transformed one French captive into an enduring historical cipher.', 'Man in the Iron Mask France Louis XIV', ARRAY['france','prisoner','royal-court'], 'iron-mask', 'An iron mask beside sealed French royal documents', '[{"type":"heading","text":"THE DISCOVERY"},{"type":"paragraph","text":"For decades, a prisoner moved between French fortresses under the custody of Bénigne de Saint-Mars. His identity was protected, his correspondence controlled and, according to later accounts, his face concealed."},{"type":"heading","text":"WHAT WE KNOW"},{"type":"paragraph","text":"The prisoner died in the Bastille in 1703 under the name Marchioly. Contemporary records confirm unusual secrecy, though the famous iron mask was more likely black velvet in early accounts."},{"type":"heading","text":"THEORIES"},{"type":"paragraph","text":"Candidates range from the valet Eustache Dauger to the Italian diplomat Ercole Matthioli. Royal twins and hidden heirs belong largely to later literature, powerful stories unsupported by contemporary evidence."},{"type":"heading","text":"WHAT REMAINS UNSOLVED"},{"type":"paragraph","text":"The state’s effort to conceal one ordinary-seeming captive remains the central fact. His name is uncertain; the reason for the secrecy is more uncertain still."}]'::jsonb, '2026-09-19', 'published', false, 8, 1300),
((SELECT id FROM public.categories WHERE slug='ancient'), 'THE MACHINE BEFORE ITS TIME', 'The Antikythera Mechanism', 'the-machine-before-its-time', 'Recovered from a Roman-era shipwreck, a corroded assembly of gears revealed an ancient command of astronomy no one expected to find.', 'Antikythera Mechanism ancient Greek astronomy', ARRAY['mechanism','astronomy','greece','shipwreck'], 'antikythera', 'Corroded bronze gears of the Antikythera Mechanism', '[{"type":"heading","text":"THE DISCOVERY"},{"type":"paragraph","text":"Sponge divers working off Antikythera in 1901 recovered bronze fragments from an ancient wreck. A gear embedded in the corrosion hinted that the object was not sculpture, weapon or coin—but a machine."},{"type":"heading","text":"WHAT WE KNOW"},{"type":"paragraph","text":"Imaging has revealed a complex geared calculator made in the Hellenistic world. Its dials tracked celestial cycles, eclipses and calendrical events with remarkable mechanical sophistication."},{"type":"heading","text":"THE EVIDENCE"},{"type":"paragraph","text":"Inscribed fragments function as both labels and instructions. Reconstructed gear trains model astronomical relationships. The mechanism was not magic or anomaly; it was the surviving representative of a technical tradition mostly lost to us."},{"type":"heading","text":"WHAT REMAINS UNSOLVED"},{"type":"paragraph","text":"Who commissioned it, which workshop made it and how widespread such instruments were remain open questions. The wreck preserved one machine—and exposed the scale of what time erased."}]'::jsonb, '2026-09-07', 'published', false, 10, 3100);
