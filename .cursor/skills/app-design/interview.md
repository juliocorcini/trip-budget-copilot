# Design Interview — Question Set for New Apps

> When no existing wireframes exist, use these questions to define the visual identity.
> ALL questions MUST be asked in a SINGLE AskQuestion call (Rule 1: minimize requests).
> If using AskQuestion, max 10 questions. If more context needed, create a markdown
> document with all questions and ask the user to answer everything at once.

---

## AskQuestion Format (10 questions, 1 request)

```
Question 1: App Personality
  Options: Modern-Minimal / Modern-Bold / Classic-Refined / Playful-Friendly / Technical-Dense / Organic-Warm

Question 2: Emotional Tone
  Options: Professional-Confident / Casual-Approachable / Premium-Exclusive / Energetic-Dynamic / Calm-Trustworthy

Question 3: Color Direction (text input or multiple choice)
  Options: Violet-Purple / Blue-Ocean / Green-Nature / Orange-Warm / Red-Bold / Neutral-Monochrome / "I'll describe" (free text)

Question 4: Theme Mode
  Options: Dark / Light / Both (dark primary)

Question 5: Visual Density
  Options: Spacious-Gallery (density 1-3) / Balanced-Standard (density 4-6) / Dense-Data-Heavy (density 7-10)

Question 6: Layout Style
  Options: Sidebar-Navigation / Top-Navigation / Hybrid (sidebar + top bar) / Full-Width-Minimal

Question 7: Inspiration Apps (multiple select)
  Options: Linear / Notion / Stripe / Luma / Vercel / Apple / Figma / Spotify / Discord / GitHub / "Other (I'll describe)"

Question 8: Special Effects (multiple select)
  Options: Glassmorphism / Gradient-Accents / Tonal-Layering / Animated-Transitions / Micro-Interactions / None-Keep-Clean

Question 9: Mobile Priority
  Options: Mobile-First / Desktop-First-Responsive / Balanced-Equal

Question 10: Typography Vibe
  Options: Geometric-Clean (like Manrope, Satoshi) / Humanist-Warm (like Nunito, Source Sans) / Editorial-Serif (for headings) / Monospace-Technical / "Keep existing" (if app has brand fonts)
```

---

## Extended Questions (if creating a document)

When AskQuestion isn't enough, create a markdown file `{App}/brain/documents/design-interview-answers.md` with these sections for the user to fill:

```markdown
# Design Interview — {App Name}

## 1. Brand Identity
- In 3 words, how should the app FEEL to users?
- What should this app explicitly NOT look like? (anti-references)
- If this app were a physical space, what would it be? (museum, coffee shop, lab, boutique, library...)

## 2. Visual Direction
- Color preference: [describe your ideal dominant color]
- Dark or light mode? Or both?
- Density: spacious and airy, or compact and data-rich?
- Layout: sidebar navigation, top bar, or hybrid?

## 3. References
- List 2-3 apps whose visual style you admire. What specifically about each?
- List 1-2 apps whose visual style you want to AVOID. What specifically?

## 4. Typography
- Do you have brand fonts already? If yes, which?
- Serif or sans-serif for headings?
- Do you want a monospace font for code/data elements?

## 5. Special Requests
- Glassmorphism, gradients, or keep it flat?
- How much animation? (subtle only / moderate / cinematic)
- Any specific UI pattern you love? (bento grids, card stacks, floating nav, etc.)
- Mobile-first or desktop-first?

## 6. Constraints
- Must support accessibility (WCAG AA)?
- Must work in specific browsers?
- Must integrate with an existing design system or component library?
```

---

## Processing Answers

After receiving answers, map them to concrete design parameters:

| Answer Category | Maps To |
|---|---|
| Personality + Tone | Font selection, spacing scale, border-radius |
| Color direction | Primary palette, neutral tinting, accent colors |
| Theme mode | Background/surface tokens, text contrast |
| Visual density | Taste Skill VISUAL_DENSITY dial (1-10) |
| Layout style | Page structure templates (sidebar/top/hybrid) |
| Inspirations | Design reference points for ambiguity |
| Special effects | Motion intensity, glassmorphism, gradients |
| Mobile priority | Breakpoint strategy, responsive approach |
| Typography vibe | Font pairing (display + body) |

### Font Selection (follow Impeccable procedure)

1. Write down 3 concrete words for the brand voice from the answers
2. List the 3 fonts you would normally reach for
3. Reject any from the Impeccable reflex_fonts_to_reject list (Inter, DM Sans, Plus Jakarta Sans, Space Grotesk, Outfit, Instrument Sans, etc.)
4. Browse for alternatives that match the brand as a physical object
5. Cross-check: the right font for "elegant" is NOT necessarily a serif

### Color Palette Construction

1. Start with the user's color direction
2. Build palette using OKLCH for perceptual uniformity
3. Create semantic tokens: surface, surface-container, primary, on-primary, on-surface, etc.
4. Tint neutrals toward brand hue (even subtle chroma creates cohesion)
5. Follow 60-30-10 rule: 60% neutral, 30% secondary, 10% accent

### Taste Skill Dials

Map user answers to the 3 dials:

| User Answer | DESIGN_VARIANCE | MOTION_INTENSITY | VISUAL_DENSITY |
|---|---|---|---|
| Modern-Minimal | 4-5 | 3-4 | 3-4 |
| Modern-Bold | 7-8 | 6-7 | 5-6 |
| Classic-Refined | 3-4 | 2-3 | 4-5 |
| Playful-Friendly | 6-7 | 7-8 | 4-5 |
| Technical-Dense | 3-4 | 2-3 | 8-9 |
| Organic-Warm | 5-6 | 4-5 | 3-4 |
