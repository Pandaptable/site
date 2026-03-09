FROM oven/bun:alpine as base
WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install

COPY . ./
RUN bun run build

FROM ghcr.io/astral-sh/uv:alpine
WORKDIR /app

COPY --from=base /app/dist ./dist
COPY . ./

EXPOSE 7911
ENTRYPOINT ["uv", "run", "gunicorn --pythonpath /app/src main:app"]