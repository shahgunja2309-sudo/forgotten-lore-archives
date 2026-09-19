import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Search, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const nav = [{ to: "/", label: "Home" }, { to: "/stories", label: "Stories" }, { to: "/categories", label: "Categories" }, { to: "/about", label: "About" }] as const;

export function PublicationShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const editorial = pathname.startsWith("/admin") || pathname === "/auth";
  if (editorial) return <>{children}</>;
  return <div className="min-h-screen bg-background text-foreground">
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-background/88 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[1480px] items-center justify-between px-5 lg:px-10">
        <Link to="/" className="font-display text-lg uppercase tracking-[0.14em] text-foreground sm:text-xl">The Hidden Chronicle</Link>
        <nav className="hidden items-center gap-9 lg:flex">{nav.map((item) => <Link key={item.to} to={item.to} activeOptions={{ exact: item.to === "/" }} className="nav-link" activeProps={{ className: "nav-link text-accent" }}>{item.label}</Link>)}</nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" aria-label="Search stories"><Link to="/search"><Search className="size-4" /></Link></Button>
          <Button variant="ghost" size="icon" aria-label={open ? "Close menu" : "Open menu"} className="lg:hidden" onClick={() => setOpen(!open)}>{open ? <X className="size-5" /> : <Menu className="size-5" />}</Button>
        </div>
      </div>
      {open && <nav className="border-t border-border px-5 py-6 lg:hidden">{nav.map((item) => <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className="block py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.label}</Link>)}</nav>}
    </header>
    <main>{children}</main>
    <footer className="border-t border-border py-14">
      <div className="mx-auto grid max-w-[1480px] gap-10 px-5 md:grid-cols-2 lg:px-10">
        <div><p className="font-display text-2xl uppercase tracking-[0.12em]">The Hidden Chronicle</p><p className="mt-3 text-sm text-muted-foreground">Forgotten stories. Unanswered questions.</p></div>
        <div className="flex flex-wrap gap-x-7 gap-y-3 md:justify-end">{["Stories","Categories","About","Contact"].map((label) => <Link key={label} to={`/${label.toLowerCase()}` as "/stories"} className="text-xs uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground">{label}</Link>)}</div>
      </div>
      <div className="mx-auto mt-10 flex max-w-[1480px] justify-between border-t border-border px-5 pt-6 text-[10px] uppercase tracking-[0.15em] text-muted-foreground lg:px-10"><span>Independent historical journal</span><span>© 2026</span></div>
    </footer>
  </div>;
}
