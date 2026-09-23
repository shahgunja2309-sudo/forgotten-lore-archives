import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, MessageCircle, Eye, Share2, Check, UserPlus } from "lucide-react";
import { getArticle, recordView, toggleArticleLike, toggleCommentLike, toggleFollow, postComment, type ContentBlock } from "@/lib/publication.functions";
import { compactNumber, formatDate, imageFor } from "@/lib/publication";
import { StoryCard } from "@/components/story-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/stories/$slug")({
  loader: async ({ params }) => {
    const data = await getArticle({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const a = loaderData?.article;
    return { meta: [
      { title: a ? `${a.title} — The Hidden Chronicle` : "Story unavailable" },
      { name: "description", content: a?.excerpt ?? "Historical investigation." },
      { property: "og:title", content: a?.title ?? "The Hidden Chronicle" },
      { property: "og:description", content: a?.excerpt ?? "Historical investigation." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ] };
  },
  component: ArticlePage,
});

type LoadedComment = Awaited<ReturnType<typeof getArticle>> extends { comments: Array<infer C> } | null ? C : never;

function readerId() {
  if (typeof localStorage === "undefined") return "";
  let id = localStorage.getItem("chronicle:reader");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("chronicle:reader", id); }
  return id;
}

function ArticlePage() {
  const { article, related, comments: initialComments } = Route.useLoaderData();
  const [visitorId, setVisitorId] = useState("");
  const [likes, setLikes] = useState(article.like_count);
  const [liked, setLiked] = useState(false);
  const [views, setViews] = useState(article.view_count);
  const [following, setFollowing] = useState(false);
  const [comments, setComments] = useState<LoadedComment[]>(initialComments as LoadedComment[]);
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const id = readerId();
    setVisitorId(id);
    setLiked(Boolean(id) && localStorage.getItem(`liked:${article.id}`) === "1");
    setFollowing(localStorage.getItem("chronicle:following") === "1");
    const key = `viewed:${article.id}`;
    if (typeof sessionStorage !== "undefined" && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      void recordView({ data: { id: article.id } }).then((r) => { if (r.count) setViews(r.count); });
    }
  }, [article.id]);

  async function onToggleLike() {
    if (!visitorId) return;
    const res = await toggleArticleLike({ data: { articleId: article.id, visitorId } });
    setLiked(res.liked);
    setLikes(res.count);
    localStorage.setItem(`liked:${article.id}`, res.liked ? "1" : "0");
  }

  async function onToggleFollow() {
    if (!visitorId) return;
    const res = await toggleFollow({ data: { visitorId } });
    setFollowing(res.following);
    localStorage.setItem("chronicle:following", res.following ? "1" : "0");
  }

  async function onLikeComment(id: string) {
    if (!visitorId) return;
    const res = await toggleCommentLike({ data: { commentId: id, visitorId } });
    setComments((list) => list.map((c) => (c.id === id ? { ...c, comment_likes: Array.from({ length: res.count }, () => ({ user_id: "" })) } : c)));
  }

  async function onPostComment(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !visitorId || sending) return;
    setSending(true);
    try {
      const saved = await postComment({ data: { articleId: article.id, visitorId, body, name: name.trim() || undefined, parentId: replyTo } });
      setComments((list) => [...list, saved as unknown as LoadedComment]);
      setBody("");
      setReplyTo(null);
    } finally { setSending(false); }
  }

  async function share() {
    if (navigator.share) { await navigator.share({ title: article.title, url: location.href }); }
    else { await navigator.clipboard.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }

  const blocks = article.content as unknown as ContentBlock[];

  return <article className="pb-28 pt-32">
    <header className="mx-auto max-w-5xl px-5 text-center">
      <p className="eyebrow">{article.categories?.name} · {formatDate(article.published_date)} · {article.reading_time} min read</p>
      <h1 className="mt-7 font-display text-5xl uppercase leading-[.92] sm:text-7xl lg:text-8xl">{article.title}</h1>
      {article.subtitle && <p className="mt-5 font-display text-3xl italic text-muted-foreground">{article.subtitle}</p>}
      <div className="mt-8 flex justify-center"><Button variant={following ? "secondary" : "outline"} onClick={onToggleFollow}><UserPlus />{following ? "Following" : "Follow publication"}</Button></div>
    </header>
    <figure className="mx-auto mt-16 max-w-[1480px] px-0 lg:px-10">
      <img src={imageFor(article.image_key, article.image_url)} alt={article.image_alt} width={1600} height={1008} className="aspect-[16/9] w-full object-cover sepia-[.12]" />
      <figcaption className="mt-3 px-5 text-[10px] uppercase tracking-[.14em] text-muted-foreground lg:px-0">{article.image_alt} · Archive reconstruction</figcaption>
    </figure>
    <div className="sticky top-20 z-30 mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-1 border-y border-border bg-background/95 px-3 py-3 backdrop-blur">
      <Button variant="ghost" onClick={onToggleLike} className={liked ? "text-accent" : ""}><Heart className={liked ? "fill-current" : ""} />{liked ? "Liked" : "Like"} · {compactNumber(likes)}</Button>
      <Button variant="ghost" asChild><a href="#comments"><MessageCircle /> {comments.length}</a></Button>
      <span className="inline-flex h-9 items-center gap-2 px-4 text-xs text-muted-foreground"><Eye className="size-4" />{compactNumber(views)}</span>
      <Button variant="ghost" onClick={share}>{copied ? <Check /> : <Share2 />}{copied ? "Copied" : "Share"}</Button>
    </div>
    <div className="article-copy mx-auto max-w-[720px] px-5 pt-14">{blocks.map((b, i) => b.type === "heading" ? <h2 key={i}>{b.text}</h2> : b.type === "paragraph" ? <p key={i}>{b.text}</p> : b.type === "quote" ? <blockquote key={i}>{b.text}</blockquote> : <div key={i} className="my-12 border-y border-border py-3">{b.items?.map((item) => <div key={item.year} className="grid grid-cols-[110px_1fr] gap-5 border-b border-border/50 py-4 last:border-0"><span className="text-xs text-accent">{item.year}</span><span className="text-sm leading-6 text-muted-foreground">{item.text}</span></div>)}</div>)}</div>
    <section className="mx-auto mt-20 max-w-3xl border-y border-border px-5 py-14 text-center">
      <p className="font-display text-3xl italic">Did this mystery leave you with questions?</p>
      <div className="mt-6 flex justify-center gap-2">
        <Button variant="ghost" onClick={onToggleLike}><Heart className={liked ? "fill-current" : ""} /> Like</Button>
        <Button variant="ghost" asChild><a href="#comments"><MessageCircle /> Comment</a></Button>
        <Button variant="ghost" onClick={share}><Share2 /> Share</Button>
      </div>
    </section>
    <section id="comments" className="mx-auto max-w-3xl px-5 pt-20">
      <div className="section-rule">{comments.length} Comments</div>
      <form onSubmit={onPostComment} className="mt-8">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" className="mb-3 bg-card" maxLength={60} />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={replyTo ? "Write your reply…" : "Add to the record…"} className="min-h-28 bg-card" />
        <div className="mt-3 flex items-center justify-between">
          {replyTo ? <Button type="button" variant="ghost" onClick={() => setReplyTo(null)}>Cancel reply</Button> : <span />}
          <Button type="submit" disabled={sending}>{sending ? "Posting…" : "Post comment"}</Button>
        </div>
      </form>
      <div className="mt-10 space-y-5">{comments.map((c) => <div key={c.id} className={`border-t border-border py-6 ${c.parent_id ? "ml-8 md:ml-14" : ""}`}>
        <div className="flex justify-between text-[10px] uppercase tracking-[.13em] text-muted-foreground"><span>{c.profiles?.display_name ?? "Reader"}</span><span>{new Date(c.created_at).toLocaleDateString()}</span></div>
        <p className="mt-3 text-sm leading-7">{c.body}</p>
        <div className="mt-3 flex gap-4">
          <button type="button" onClick={() => onLikeComment(c.id)} className="text-xs text-muted-foreground">♡ {c.comment_likes?.length ?? 0}</button>
          <button type="button" onClick={() => setReplyTo(c.id)} className="text-xs text-muted-foreground">Reply</button>
        </div>
      </div>)}</div>
    </section>
    <section className="mx-auto mt-28 max-w-[1480px] px-5 lg:px-10"><div className="section-rule">Related stories</div><div className="mt-12 grid gap-12 md:grid-cols-3">{related.map((a) => <StoryCard key={a.id} article={a} />)}</div></section>
  </article>;
}
