# PROMPT

## How this was built

- Model: Claude Opus 5.5 in Claude Code (desktop app), 2026-11-18.
- Input 1, the hero image: a crimson food poster showing a stack of glazed chilli potato on a fork, with baked-in "SPICY BITE" lettering and contact details. All of the baked-in text was removed, the real-world contact details included. The food itself was left untouched.
- Input 2, the reference: a Pinterest pin with a 7.8-second mockup video of a pasta restaurant site. It opens on a fork hero, then the ingredients spiral apart with labels as the page goes from red to cream, and it ends on a plate with a CTA.
- Image and video work was done on Higgsfield:
  - bytedance 4K upscale
  - grok-imagine-image-2.0 edit to remove the text
  - outpaint to 16:9, with the original pasted back in by template matching
  - nano_banana_pro end keyframes
  - three minimax_h3 2K video legs
- The subject cutout uses the macOS Vision framework. Everything else is hand-written HTML, CSS and JS.

## The original prompts (the user's words)

> hey, let's build amazing animated website with this image as the hero, it's for a fictional restaurant. check out this reference: https://www.pinterest.com/pin/1144899536560475426/ tell me your ideas first

Then, during the build:

> you have access to higgfields btw

> i'd added credit to higgsfield, i want more animation like the ref.

## A prompt that recreates this project

Build a static, no-build-step landing page for a fictional Indo-Chinese street kitchen called Spicy Bite. Use a deep crimson palette: #6e0b16, #3d0309, cream #f4e6cf and glaze orange #c24a12. Set headlines in Archivo, accents in Instrument Serif italic and body text in Outfit.

1. **Hero.** A chilli-potato stack on a fork against crimson. Live "SPICY BITE" type sits behind a cutout of the food, so the food overlaps BITE. Small glaze drips grow from the letters on load, and chilli flakes and sesame on a canvas move away from the cursor.
2. **Scroll story.** A pinned stage about 10 screens tall scrubs three image-to-video legs that are frame-locked end to start:
   - the stack explodes into a labelled ingredient spiral, with SVG leader lines anchored in 1920x1080 video space
   - the pieces orbit like they are being tossed in a wok
   - everything drops into a black bowl
   Three text beats go with the legs (The anatomy, The toss, The landing) and end on an "Explore the menu" CTA.
3. **Transition.** An SVG drip wipe takes the page from dark crimson to cream.
4. **Menu.** Seven dishes, each with a rupee price and a heat rating out of 5. Rows turn crimson on hover, and there is a demo order bag.
5. **Heat dial.** A 1 to 5 range (Mild hum, Warm, Proper kick, Fire drill, Volcano). It recolours the section, adds chilli icons and speeds up a canvas of embers.
6. **Finish.** A marquee, a "Follow the smoke" visit section with made-up hours and location, and a footer that says it is a fictional restaurant.

Load the videos as blobs so seeking is instant, coalesce seeks, and smooth scroll progress. Ship lighter video files and a portrait letterbox layout for phones, and respect prefers-reduced-motion.
