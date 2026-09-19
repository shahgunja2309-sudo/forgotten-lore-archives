import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Eye } from "lucide-react";
import type { Article } from "@/lib/publication.functions";
import { compactNumber, formatDate, imageFor } from "@/lib/publication";

export function StoryCard({ article }: { article: Article }) {
  return <article className="group">
    <Link to="/stories/$slug" params={{ slug: article.slug }} className="block overflow-hidden bg-muted aspect-[4/3]"><img src={imageFor(article.image_key)} alt={article.image_alt} width={1408} height={1008} loading="lazy" className="h-full w-full object-cover sepia-[.18] transition duration-700 group-hover:scale-[1.025] group-hover:sepia-0" /></Link>
    <div className="mt-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-accent"><span>{article.categories?.name}</span><span className="h-px w-6 bg-border" /></div>
    <h3 className="mt-4 font-display text-3xl leading-[1.05] uppercase"><Link to="/stories/$slug" params={{ slug: article.slug }} className="transition-colors hover:text-accent">{article.title}</Link></h3>
    {article.subtitle && <p className="mt-2 font-display text-lg italic text-muted-foreground">{article.subtitle}</p>}
    <p className="mt-4 line-clamp-3 text-sm leading-7 text-muted-foreground">{article.excerpt}</p>
    <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4 text-[10px] uppercase tracking-[0.12em] text-muted-foreground"><span>{formatDate(article.published_date)}</span><span>·</span><span>{article.reading_time} min read</span><span className="inline-flex items-center gap-1"><Eye className="size-3" /> {compactNumber(article.view_count)}</span></div>
    <Link to="/stories/$slug" params={{ slug: article.slug }} className="mt-5 inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-foreground transition-colors hover:text-accent">Read story <ArrowUpRight className="size-3.5" /></Link>
  </article>;
}
