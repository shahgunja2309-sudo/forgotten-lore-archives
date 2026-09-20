import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { getHomeData } from "@/lib/publication.functions";
import { formatDate, imageFor } from "@/lib/publication";
import { StoryCard } from "@/components/story-card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import hero from "@/assets/hero-archive.jpg";

export const Route = createFileRoute("/")({
  loader: () => getHomeData(),
  head: () => ({ meta: [{ title: "The Hidden Chronicle — Historical Mysteries" },{ name:"description",content:"Stories history didn’t finish telling: historical mysteries, lost artifacts, ancient puzzles and unanswered questions."},{property:"og:title",content:"The Hidden Chronicle"},{property:"og:description",content:"Stories history didn’t finish telling."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}] }),
  component: HomePage,
});
function HomePage() {
  const { articles } = Route.useLoaderData();
  const featured = articles.find((item) => item.is_featured) ?? articles[0];
  const latest = articles.filter((item) => item.id !== featured?.id).slice(0,3);
  const [email,setEmail]=useState(""); const [notice,setNotice]=useState("");
  async function subscribe(e:React.FormEvent){e.preventDefault();const {error}=await supabase.from("newsletter_subscriptions").insert({email});setNotice(error?.code==="23505"?"You are already in the archive.":error?"Please enter a valid email.":"Welcome to the archive.");if(!error)setEmail("");}
  if(!featured) return null;
  return <>
    <section className="relative flex min-h-[88vh] items-end overflow-hidden pt-20">
      <img src={hero} alt="The Voynich Manuscript on an archival table" width={1600} height={1008} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/15" />
      <div className="relative mx-auto w-full max-w-[1480px] px-5 pb-16 lg:px-10 lg:pb-24">
        <p className="eyebrow">An independent journal of historical mysteries</p>
        <h1 className="mt-5 max-w-5xl font-display text-5xl uppercase leading-[.88] sm:text-7xl lg:text-[7.8rem]">The Hidden<br/>Chronicle</h1>
        <div className="mt-8 grid gap-6 border-t border-border pt-6 md:grid-cols-2"><p className="font-display text-2xl italic text-foreground">Stories history didn’t finish telling.</p><div className="md:text-right"><p className="text-sm text-muted-foreground">Forgotten evidence. Lost stories. Questions that survived centuries.</p><Button asChild variant="link" className="mt-3 h-auto p-0 uppercase tracking-[.16em] text-accent"><Link to="/stories">Explore the stories <ArrowRight /></Link></Button></div></div>
      </div>
    </section>
    <section className="mx-auto max-w-[1480px] px-5 py-24 lg:px-10 lg:py-36"><div className="section-rule">Featured investigation</div>
      <div className="mt-10 grid items-center gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-20"><div><p className="eyebrow">{featured.categories?.name} · {formatDate(featured.published_date)}</p><h2 className="mt-5 font-display text-5xl uppercase leading-[.95] lg:text-7xl">{featured.title}</h2><p className="mt-4 font-display text-2xl italic text-muted-foreground">{featured.subtitle}</p><p className="mt-7 max-w-xl text-sm leading-7 text-muted-foreground">{featured.excerpt}</p><Button asChild variant="outline" className="mt-8"><Link to="/stories/$slug" params={{slug:featured.slug}}>Read the investigation <ArrowRight /></Link></Button></div><Link to="/stories/$slug" params={{slug:featured.slug}} className="block overflow-hidden"><img src={imageFor(featured.image_key)} alt={featured.image_alt} width={1600} height={1008} loading="lazy" className="aspect-[16/10] w-full object-cover sepia-[.15] transition duration-700 hover:scale-[1.02]" /></Link></div>
    </section>
    <section className="border-y border-border bg-card/25"><div className="mx-auto max-w-[1480px] px-5 py-24 lg:px-10 lg:py-32"><div className="flex items-end justify-between"><div><p className="eyebrow">Recently published</p><h2 className="mt-3 font-display text-5xl uppercase">Latest stories</h2></div><Link to="/stories" className="hidden text-xs uppercase tracking-[.16em] text-muted-foreground hover:text-accent md:block">View all stories →</Link></div><div className="mt-12 grid gap-14 md:grid-cols-3">{latest.map((article)=><StoryCard key={article.id} article={article}/>)}</div></div></section>
    <section className="mx-auto max-w-3xl px-5 py-28 text-center lg:py-40"><p className="eyebrow">Private correspondence</p><h2 className="mt-4 font-display text-5xl uppercase">Enter the archive</h2><p className="mt-4 font-display text-xl italic text-muted-foreground">Occasional stories from the forgotten corners of history.</p><form onSubmit={subscribe} className="mx-auto mt-9 flex max-w-lg border-b border-border"><input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="YOUR EMAIL ADDRESS" className="min-w-0 flex-1 bg-transparent py-4 text-xs tracking-[.12em] outline-none placeholder:text-muted-foreground"/><Button type="submit" variant="ghost">Subscribe →</Button></form>{notice&&<p className="mt-4 text-xs text-accent">{notice}</p>}</section>
  </>;
}
