# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=optional

RUN ROLLDOWN_VERSION=$(node -p "require('rolldown/package.json').version") \
 && npm install --no-save --ignore-scripts --force --omit=optional \
      "@rolldown/binding-wasm32-wasi@${ROLLDOWN_VERSION}"

RUN npm pack --pack-destination /tmp @tailwindcss/oxide-wasm32-wasi@4.2.4 \
 && mkdir -p node_modules/@tailwindcss/oxide-wasm32-wasi \
 && tar -xzf /tmp/tailwindcss-oxide-wasm32-wasi-4.2.4.tgz \
      -C node_modules/@tailwindcss/oxide-wasm32-wasi --strip-components=1 \
 && rm /tmp/tailwindcss-oxide-wasm32-wasi-4.2.4.tgz

ENV NAPI_RS_FORCE_WASI=true
ENV NODE_OPTIONS=--max-old-space-size=2048

RUN node -e "const l=require('lightningcss'); const out=l.transform({filename:'x.css',code:Buffer.from('a{color:red}'),minify:true}); if(!out.code) process.exit(1); console.log('lightningcss-wasm ok')"
RUN node -e "require('@tailwindcss/oxide'); console.log('oxide-wasi ok')"
RUN node -e "const r=require('rollup'); if(typeof r.rollup!=='function') process.exit(1); console.log('rollup-wasm ok')"
RUN node -e "const r=require('rolldown'); if(typeof r.rolldown!=='function') process.exit(1); console.log('rolldown-wasm ok')"

COPY . .
RUN --mount=type=secret,id=env,target=/run/secrets/env \
    set -a && . /run/secrets/env && set +a && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/build ./build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["node", "build/index.js"]
