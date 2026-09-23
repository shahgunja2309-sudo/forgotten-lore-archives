import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type ArticleRow = Database["public"]["Tables"]["articles"]["Row"];
export type Article = ArticleRow & { categories: Category | null; like_count: number; comment_count: number; image_url: string | null };
export type ContentBlock = { type: "heading" | "paragraph" | "quote" | "timeline"; text?: string; items?: Array<{ year: string; text: string }> };

export const ARTICLE_BUCKET = "article-images";

function publicClient() {
  return createClient<Database>(process.env['SUPABASE_URL']!, process.env['SUPABASE_PUBLISHABLE_KEY']!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function signImages(admin: AdminClient, rows: Array<{ image_key: string }>) {
  const paths = [...new Set(rows.map((r) => r.image_key).filter((k) => k.startsWith("upload:")).map((k) => k.slice(7)))];
  if (!paths.length) return {} as Record<string, string>;
  const { data } = await admin.storage.from(ARTICLE_BUCKET).createSignedUrls(paths, 60 * 60 * 24 * 7);
  const map: Record<string, string> = {};
  (data ?? []).forEach((item) => { if (item.path && item.signedUrl) map[`upload:${item.path}`] = item.signedUrl; });
  return map;
}

async function enrich(_client: ReturnType<typeof publicClient>, rows: Array<ArticleRow & { categories: Category | null }>) {
  if (!rows.length) return [] as Article[];
  const ids = rows.map((row) => row.id);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: likes }, { data: comments }, signed] = await Promise.all([
    supabaseAdmin.from("article_likes").select("article_id").in("article_id", ids),
    supabaseAdmin.from("comments").select("article_id").in("article_id", ids).eq("status", "approved"),
    signImages(supabaseAdmin, rows),
  ]);
  return rows.map((row) => ({
    ...row,
    like_count: likes?.filter((item) => item.article_id === row.id).length ?? 0,
    comment_count: comments?.filter((item) => item.article_id === row.id).length ?? 0,
    image_url: signed[row.image_key] ?? null,
  }));
}


export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const client = publicClient();
  const [{ data: rows, error }, { data: categories }] = await Promise.all([
    client.from("articles").select("*, categories(*)").eq("status", "published").order("published_date", { ascending: false }),
    client.from("categories").select("*").order("name"),
  ]);
  if (error) throw new Error(error.message);
  return { articles: await enrich(client, rows ?? []), categories: categories ?? [] };
});

export const getArticle = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const client = publicClient();
    const { data: row, error } = await client.from("articles").select("*, categories(*)").eq("slug", data.slug).eq("status", "published").maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const article = (await enrich(client, [row]))[0]!;
    const { data: relatedRows } = await client.from("articles").select("*, categories(*)").eq("status", "published").eq("category_id", row.category_id).neq("id", row.id).limit(3);
    let related = await enrich(client, relatedRows ?? []);
    if (related.length < 3) {
      const { data: fallback } = await client.from("articles").select("*, categories(*)").eq("status", "published").neq("id", row.id).limit(3);
      related = await enrich(client, fallback ?? []);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: commentRows } = await supabaseAdmin.from("comments").select("*, comment_likes(user_id)").eq("article_id", row.id).eq("status", "approved").order("created_at");
    const authorIds = [...new Set((commentRows ?? []).map((c) => c.user_id))];
    const { data: profiles } = authorIds.length ? await supabaseAdmin.from("profiles").select("id, display_name").in("id", authorIds) : { data: [] };
    const comments = (commentRows ?? []).map((c) => ({ ...c, profiles: { display_name: profiles?.find((p) => p.id === c.user_id)?.display_name ?? "Reader" } }));
    return { article, related: related.slice(0, 3), comments };

  });

export const getCategory = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const client = publicClient();
    const { data: category } = await client.from("categories").select("*").eq("slug", data.slug).maybeSingle();
    if (!category) return null;
    const { data: rows } = await client.from("articles").select("*, categories(*)").eq("status", "published").eq("category_id", category.id).order("published_date", { ascending: false });
    return { category, articles: await enrich(client, rows ?? []) };
  });

export const searchArticles = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ query: z.string().max(100) }).parse(data))
  .handler(async ({ data }) => {
    const client = publicClient();
    const query = data.query.trim();
    if (!query) return [] as Article[];
    const safe = query.replace(/[,%()]/g, " ");
    const { data: rows, error } = await client.from("articles").select("*, categories(*)").eq("status", "published").or(`title.ilike.%${safe}%,subtitle.ilike.%${safe}%,excerpt.ilike.%${safe}%,topic.ilike.%${safe}%`).order("published_date", { ascending: false });
    if (error) throw new Error(error.message);
    const direct = rows ?? [];
    if (direct.length) return enrich(client, direct);
    const { data: all } = await client.from("articles").select("*, categories(*)").eq("status", "published").order("published_date", { ascending: false });
    return enrich(client, (all ?? []).filter((item) => item.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase())) || item.categories?.name.toLowerCase().includes(query.toLowerCase())));
  });

export const recordView = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: article } = await supabaseAdmin.from("articles").select("view_count,status").eq("id", data.id).maybeSingle();
    if (!article || article.status !== "published") return { count: 0 };
    const count = article.view_count + 1;
    await supabaseAdmin.from("articles").update({ view_count: count }).eq("id", data.id);
    return { count };
  });

const articleInput = z.object({
  id: z.string().uuid().optional(), title: z.string().min(3), subtitle: z.string().optional(), slug: z.string().min(3), excerpt: z.string().min(20),
  category_id: z.string().uuid(), topic: z.string(), tags: z.array(z.string()), image_key: z.string(), image_alt: z.string(), published_date: z.string(),
  status: z.enum(["draft", "published"]), is_featured: z.boolean(), reading_time: z.number().int().positive(), content: z.custom<Json>(),
});

export const getAdminData = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: role } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "editor").maybeSingle();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count: editorCount } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "editor");
  if (!role && (editorCount ?? 0) === 0) await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "editor" });
  else if (!role) throw new Error("Editor access required");
  const [{ data: articles }, { data: categories }, { count: followers }, { count: comments }] = await Promise.all([
    supabaseAdmin.from("articles").select("*, categories(*)").order("updated_at", { ascending: false }),
    supabaseAdmin.from("categories").select("*").order("name"),
    supabaseAdmin.from("followers").select("user_id", { count: "exact", head: true }),
    supabaseAdmin.from("comments").select("id", { count: "exact", head: true }),
  ]);
  return { articles: articles ?? [], categories: categories ?? [], followers: followers ?? 0, comments: comments ?? 0 };
});

export const saveArticle = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => articleInput.parse(data)).handler(async ({ data, context }) => {
  const { data: role } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "editor").maybeSingle();
  if (!role) throw new Error("Editor access required");
  const { id, subtitle, ...rest } = data;
  const payload = { ...rest, subtitle: subtitle ?? null };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const query = id ? supabaseAdmin.from("articles").update(payload).eq("id", id).select().single() : supabaseAdmin.from("articles").insert(payload).select().single();

  const { data: saved, error } = await query;
  if (error) throw new Error(error.message);
  return saved;
});

export const deleteArticle = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data)).handler(async ({ data, context }) => {
  const { data: role } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "editor").maybeSingle();
  if (!role) throw new Error("Editor access required");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("articles").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
});

// ---- Guest (no sign-in) interactions ----
const visitor = z.string().uuid();

export const toggleFollow = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ visitorId: visitor }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("followers").select("user_id").eq("user_id", data.visitorId).maybeSingle();
    if (existing) await supabaseAdmin.from("followers").delete().eq("user_id", data.visitorId);
    else await supabaseAdmin.from("followers").insert({ user_id: data.visitorId });
    return { following: !existing };
  });


export const toggleArticleLike = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ articleId: z.string().uuid(), visitorId: visitor }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("article_likes").select("article_id").eq("article_id", data.articleId).eq("user_id", data.visitorId).maybeSingle();
    if (existing) await supabaseAdmin.from("article_likes").delete().eq("article_id", data.articleId).eq("user_id", data.visitorId);
    else await supabaseAdmin.from("article_likes").insert({ article_id: data.articleId, user_id: data.visitorId });
    const { count } = await supabaseAdmin.from("article_likes").select("article_id", { count: "exact", head: true }).eq("article_id", data.articleId);
    return { liked: !existing, count: count ?? 0 };
  });

export const toggleCommentLike = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ commentId: z.string().uuid(), visitorId: visitor }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("comment_likes").select("comment_id").eq("comment_id", data.commentId).eq("user_id", data.visitorId).maybeSingle();
    if (existing) await supabaseAdmin.from("comment_likes").delete().eq("comment_id", data.commentId).eq("user_id", data.visitorId);
    else await supabaseAdmin.from("comment_likes").insert({ comment_id: data.commentId, user_id: data.visitorId });
    const { count } = await supabaseAdmin.from("comment_likes").select("comment_id", { count: "exact", head: true }).eq("comment_id", data.commentId);
    return { liked: !existing, count: count ?? 0 };
  });

export const postComment = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    articleId: z.string().uuid(), visitorId: visitor, body: z.string().min(1).max(4000),
    name: z.string().max(60).optional(), parentId: z.string().uuid().nullable().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const displayName = data.name?.trim() || "Reader";
    await supabaseAdmin.from("profiles").upsert({ id: data.visitorId, display_name: displayName });
    const { data: saved, error } = await supabaseAdmin.from("comments")
      .insert({ article_id: data.articleId, user_id: data.visitorId, parent_id: data.parentId ?? null, body: data.body.trim(), status: "approved" })
      .select("*").single();
    if (error) throw new Error(error.message);
    return { ...saved, comment_likes: [] as Array<{ user_id: string }>, profiles: { display_name: displayName } };
  });
