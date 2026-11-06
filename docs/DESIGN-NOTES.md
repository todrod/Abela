# Design notes: research-informed homepage (v2)

Research date: November 6, 2026. Most sources are agency roundups and trend articles, which are directional rather than usability studies. The session's network policy blocked live visits to the reference sites (One Medical, Parsley Health, Function Health, Sollis, NYCVA, NN/g), so the observations below come from search summaries of those sites.

## What the research says, and what we did with it

| Pattern seen in 2026 healthcare sites | Evidence | Applied here |
|---|---|---|
| Warmer, human palettes that move away from sterile white-on-blue toward warm beige, soft greens and coral | Veza Digital, Orbix, Designity trend roundups | Kept navy for trust. Added warm sand sections and a muted clay accent (`--clay #b14f36`) for arrows, step numbers and the heart-rhythm line. |
| Trust signals just below the fold. Specific beats generic ("best", "leading") | Parsley Health critiques (Webstacks, Colorlib) | Credentials strip under the hero, drawn from the content record. No outcome statistics, ratings or superlatives. |
| Symptom-based navigation | Parsley Health and Function Health ("filter by condition") | "What brings you in?" lists plain-language symptoms that link to the matching Areas of Care section. |
| Explain the care model and the next step clearly | Concierge medicine case studies (SoHo Concierge, Priority Physicians) | Three steps, "From first call to a clear plan", which echoes the tagline, plus an office-vs-hospital note. |
| One clear primary call to action, mobile-first | One Medical reviews and general 2026 guidance | Phone is the primary CTA everywhere, and a bar with Call and Directions stays at the bottom of the screen on mobile. |
| Motion that is functional, not decorative, and respects reduced motion | Veza Digital, Orbix | One heart-rhythm line drawn in the hero, gentle fade-ins on scroll, and arrow nudges on hover. All are disabled under `prefers-reduced-motion`. |
| Readability for older patients, a core cardiology audience | NN/g *UX Design for Seniors* report | Base text increased to 18px, tap targets of at least 48px, high contrast, and an FAQ built from native `<details>` elements. |
| FAQ to answer pre-visit questions | Common across roundups | Its answers come from `site.json`. Unanswered questions (referral, insurance) appear only as staging placeholders. |

## Homepage flow (top to bottom)
1. Hero: tagline, call and directions buttons, new-patient status
2. Credentials strip: trust
3. "What brings you in?": symptom-based routing
4. Areas of care: cards labelled by office or hospital setting
5. What to expect: three steps
6. Meet Dr. Abela: navy band
7. Common questions
8. Visit the office: contact strip

## Applied across the rest of the site (v2.1)
- **Page headers** use the same warm gradient as the homepage hero.
- **Meet Dr. Abela** shows the credentials strip directly under the header.
- **Areas of Care** has jump-to buttons for each condition. On mobile they form one row you can swipe sideways. The symptom links on the homepage land on these same sections.
- **Patient Information** opens with the three visit steps and ends with the full FAQ (`#faq`). The homepage shows the first three questions and links to the full list.
- **Closing call to action**: every interior page except Contact ends with a sand panel reading "Questions about your heart health?" with Call and Directions buttons.
- **Scroll fade-ins** apply only to content below the first screen, so nothing visible at load ever fades in.

## Next design upgrades once assets arrive
- An approved portrait replaces the "OA" monogram panel, which is the single biggest gain in warmth and trust. The hero chip will sit over the photo.
- Real office photography (exterior, waiting room) on the Contact page helps first-time visitors recognize the building.
- A proper logo and, optionally, a licensed web font pairing. The current system serif and sans keep the site fast and free of third-party requests.

## Sources
- https://www.vezadigital.com/post/healthcare-web-design-trends
- https://www.orbix.studio/blogs/healthcare-web-design-trends
- https://www.designity.com/blog/healthcare-design-what-you-need-to-know-about-the-latest-trends
- https://www.webstacks.com/blog/healthcare-website-design
- https://colorlib.com/wp/healthcare-website-designs/
- https://webflow.com/blog/web-design-for-healthcare
- https://leadtoconversion.com/blog/website-design-for-concierge-doctors/
- https://borshoff.biz/work/priority-physicians-rebrand/
- https://getdeardoc.com/blog/medical-practice-website-design
- https://www.nngroup.com/reports/senior-citizens-on-the-web/
