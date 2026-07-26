# Hit Predictor — Channel Strip

A dark, mixing-console-themed dashboard for the Spotify hit-prediction backend.
Sliders read like faders, and the result renders as a segmented VU meter plus
a mastering-engineer "HIT / PASS" stamp.

## Files
- `tailwind.config.ts` — merge the `theme.extend` additions (custom colors,
  fonts, keyframes) into your existing config.
- `app/layout.tsx` — loads three fonts (Space Grotesk for display, IBM Plex
  Mono for data/labels, Inter for body) and sets the dark background.
- `app/page.tsx` — renders the dashboard.
- `app/components/HitPredictorConsole.tsx` — the full component: 9 fader
  cards, the predict button, and the VU-meter result panel.

## Before it'll work

1. **Tailwind v3.4+** is required — the sliders are styled with
   `[&::-webkit-slider-thumb]:` arbitrary variants, which need a recent
   Tailwind version.

2. **Enable CORS on the FastAPI backend**, since the browser will be calling
   `localhost:8000` from a different origin (`localhost:3000`):

   ```python
   from fastapi.middleware.cors import CORSMiddleware

   app.add_middleware(
       CORSMiddleware,
       allow_origins=["http://localhost:3000"],
       allow_methods=["POST"],
       allow_headers=["*"],
   )
   ```

   Alternatively, skip CORS entirely by proxying through Next.js: add a
   rewrite in `next.config.js` pointing `/api/predict` at
   `http://localhost:8000/predict`, then change `API_URL` in
   `HitPredictorConsole.tsx` to `/api/predict`.

## Notes
- Slider defaults are seeded with roughly "typical hit song" values — adjust
  `FEATURES` in the component to change ranges, steps, or starting points.
- The VU meter's green/amber/red zones are just a classic meter ladder for
  the confidence magnitude; the HIT/PASS stamp is what reflects the actual
  `is_hit` classification.
