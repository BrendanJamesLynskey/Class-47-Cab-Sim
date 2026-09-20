# Class 47 Cab Simulator

Drive a real British diesel from the driver's seat. This is a first-person train
simulator that you can change yourself.

[Play it here](https://brendanjameslynskey.github.io/Class-47-Cab-Sim/)

*(Work in progress: right now the page only shows an empty blue sky. The cab and the railway are coming.)*

## Start the game

1. Open a terminal in this folder.
2. Type `./run` and press Enter.
3. It prints two addresses. On the Raspberry Pi, open Chromium and type in the
   one that says **Network** (it looks like `http://192.168.1.132:5173`).

Leave `./run` going while you work. Every time you save a file, the game on the
TV changes by itself. Press `Ctrl+C` in the terminal to stop it.

## Where things live

| File | What is in it |
|------|---------------|
| [`src/config.js`](src/config.js) | All the numbers and colours you can tweak |
| [`src/main.js`](src/main.js) | Starts the game |

## Save your work

```
./save "what I changed"
```

This sends your changes to GitHub, and the game on the internet updates a minute later.

## Notes for grown-ups

- Built with [Three.js](https://threejs.org/) and Vite in plain JavaScript. Needs Node 22+.
- The Pi only shows the game: it runs Chromium pointed at the dev server on the
  Ubuntu box, or at the GitHub Pages address above.
- Pushing to `main` builds the game and publishes it to GitHub Pages
  ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).
- `npm run build` makes a `dist/` folder; `npm run preview` serves it locally.
