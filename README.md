# Pixel Perfect Replica

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pixel-perfect-render-48361.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4ede06e4-bfcd-4ffd-857e-5506b35066df).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Netlify previews

This application uses TanStack Start server-side rendering, not a static SPA.
The Nitro `netlify` preset generates the server function in
`.netlify/functions-internal` and publishes browser assets to `dist`.
`netlify.toml` keeps the build command and publish directory consistent for
production and deploy previews. Page requests and server functions are handled
by the generated server, so no SPA redirect to `index.html` is needed.
