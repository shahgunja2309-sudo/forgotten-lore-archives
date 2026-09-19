# THE HIDDEN CHRONICLE

## Goal
Build a premium historical-mystery publication with a cinematic public reading experience and a secure editorial workspace for managing an unlimited article archive.

## Public experience
- Establish a charcoal, ivory, sepia, and restrained antique-gold design system with editorial serif headlines, modern sans-serif text, subtle archival texture, film grain, fine rules, and restrained motion.
- Add shared navigation, search access, publication follow control, and a minimal footer.
- Build distinct Home, Stories, Categories, About, Contact, Search, Category, and Article pages with unique sharing and search metadata.
- Keep the homepage focused: cinematic publication introduction, one featured investigation, three latest stories, and a minimal newsletter invitation.
- Create category archives for Lost, Hidden, Unsolved, Missing, Deciphered, and Ancient.
- Build a distraction-free article layout with structured sections, rich media blocks, captions, pull quotes, timelines, documents, maps, videos, related links, and three related stories.
- Add account screens so everyone can read while signed-in readers can comment, reply, like comments, like articles, and follow the publication.
- Add responsive search by title, keyword, category, tag, and topic.

## Persistent publication features
- Store articles, sections/content blocks, categories, tags, images, publication-selected dates, featured status, drafts, and published status.
- Preserve the editor-selected display date everywhere without tying it to upload or edit time.
- Persist article likes, nested comments, comment likes, view totals, followers, and newsletter subscriptions.
- Increment article views safely and update engagement totals throughout article, home, category, and search views.
- Provide native sharing where available, plus a compact copy-link menu.
- Protect reader-owned actions and editorial actions with database access rules.

## Editorial workspace
- Add a protected management area for creating, editing, deleting, drafting, publishing, featuring, categorizing, tagging, and dating articles.
- Support image uploads and ordered article content blocks.
- Add overview screens for article status, likes, comments, views, followers, and comment moderation.
- Keep publication roles in a dedicated secure role table; only editors can access management tools.

## Initial editorial content
- Seed the Voynich Manuscript as the featured investigation.
- Seed the Lost Colony of Roanoke, the Man in the Iron Mask, and the Antikythera Mechanism as latest stories.
- Include substantial, clearly structured sample investigations so article pages demonstrate the intended reading experience.
- Generate a cohesive set of original sepia archival images for the publication and initial stories.

## Technical details
- Use Lovable Cloud for the database, authentication, image storage, and access rules.
- Enable email/password and managed Google sign-in.
- Use stable article slugs so editing dates or content never changes article URLs.
- Apply public read access only to published content; reader interactions require an account; editorial writes require a server-verified editor role.
- Add database functions for safe counters and engagement actions, and indexes for archive/search performance.
- Verify the key flows on desktop and mobile: browsing, search, article reading, sharing, account entry, engagement, and editorial article management.
