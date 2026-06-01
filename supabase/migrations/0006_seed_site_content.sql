-- 0006_seed_site_content.sql
-- Phase 4 / Plan 01 / Task 2 — idempotent site_content seed (D-18).
--
-- Sorts after 0001 (public.site_content: key text primary key, value text) and 0002
-- (site_content_public_read / site_content_admin_write RLS). Seeds the seven editable
-- keys from the current hardcoded strings (Hero.tsx, OurStory.tsx, Footer.tsx) so the
-- ADMIN-05/06 site-content editor and the D-20 public useSiteContent rewire have rows
-- to read. our_story_body is composed as a single sanitized HTML string using ONLY the
-- tags TipTap/DOMPurify allow in Plan 07: p, strong, em, ul, ol, li, h2, h3, br, a.
--
-- Net invariant: seeds the seven editable site_content keys from current code; idempotent
-- — `on conflict (key) do nothing` means re-running never clobbers later owner edits.
-- Single quotes in the body are doubled per SQL string escaping.

insert into public.site_content (key, value) values
  ('hero_title',     'Formulas Born From The Purity of Earth'),
  ('hero_subtitle',  'Experience earthen luxury with our handcrafted botanical skincare. Nourishing soaps, revitalizing scrubs, and rich creams.'),
  ('hero_cta',       'Explore Collection'),
  ('our_story_body',
   '<p>That is the idea behind <strong>Sutravan</strong>, a name that means <em>formulas born from the purity of nature.</em></p>'
   '<p>But Sutravan didn''t begin as a business. It began as a <strong>personal search for healing.</strong></p>'
   '<p>For many years, I struggled with marks on my face — from accidents, acne, pimples and everyday skin issues. Like many people, I tried several cosmetic products. Some worked for a while, but often the results didn''t last. When I stopped using them, the problems slowly came back.</p>'
   '<p>Then something unexpected happened.</p>'
   '<h2>The Discovery</h2>'
   '<p>During a visit to villages in Rajasthan, I noticed something fascinating. In places where there were no beauty stores, no cosmetic brands and sometimes not even proper houses, people still had a deep understanding of caring for their skin and body.</p>'
   '<p>Women there used simple ingredients from their kitchens and surroundings: <strong>besan, multani mitti, chandan, neem leaves, haldi</strong> and even the <strong>peels of vegetables and fruits</strong> like potato, cucumber, onion, orange and lemon.</p>'
   '<p>Nothing was wasted. Everything from nature had a purpose.</p>'
   '<p>These natural ingredients were used to clean the face, nourish the skin, strengthen the hair and maintain overall well-being. That moment stayed with me.</p>'
   '<h2>Three Years of Patience</h2>'
   '<p>I thought, <em>if these natural methods have worked for generations, why not try them myself?</em></p>'
   '<p>So I started experimenting. Slowly. Carefully. Patiently.</p>'
   '<p>Over the last <strong>three years</strong>, I began creating small formulations using natural ingredients. I tested them on myself first and gradually shared them with family, friends, relatives and colleagues.</p>'
   '<p>The results were encouraging. With consistent use, marks began fading, skin started improving naturally and the biggest difference was this:</p>'
   '<p>When people stopped using these products, the improvements did not reverse immediately, unlike many chemical-based cosmetics.</p>'
   '<p>Because the goal wasn''t just temporary beauty. The goal was <strong>natural skin repair and long-term balance.</strong></p>'
   '<h2>What We Create</h2>'
   '<p>This journey led to the creation of our first products:</p>'
   '<ul><li>Natural soaps</li><li>Gentle scrubs</li><li>Nourishing creams</li></ul>'
   '<p>All made with <strong>earth-inspired ingredients and traditional wisdom.</strong></p>'
   '<h2>Our Belief</h2>'
   '<p>At <strong>Sutravan</strong>, we believe skincare should not fight your skin. It should <strong>work with it</strong>. Our products are chemical-free, simple and honest, designed to support your skin''s natural ability to heal and renew.</p>'
   '<p>What started as a personal experiment is now something we want to share with others. Because sometimes the most powerful solutions are not new inventions. They are <strong>old wisdom rediscovered.</strong></p>'),
  ('email',          'sutravan.in@gmail.com'),
  ('instagram_url',  'https://www.instagram.com/sutravan.in'),
  ('youtube_url',    'https://youtube.com/@sutravan?si=0ne7zUvFEh70AF6j')
on conflict (key) do nothing;
