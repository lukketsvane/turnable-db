# TURNABLE

Interactive 3D gallery of Norwegian chairs from the National Museum of Norway.

70 chairs. Drag to rotate. Pinch to expand.

## Stack

Next.js 15 · React 19 · Tailwind 4 · Vercel

## How it works

Each chair is a short looping video. Dragging scrubs through frames, creating a turntable effect. No WebGL, no 3D engine — just video.

**Grid** — static thumbnails on mobile, proximity-activated video on desktop.
**Detail** — fixed turntable fades on scroll, metadata card slides over. Adjacent videos preloaded for instant swipe navigation.

## Run locally

```
npm install
npm run dev
```

## Data

Chair metadata and media sourced from [Nasjonalmuseet](https://www.nasjonalmuseet.no/).
