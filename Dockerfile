FROM oven/bun:alpine AS base
WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install

COPY . ./
RUN bun run build

FROM ghcr.io/astral-sh/uv:alpine
WORKDIR /app

COPY --from=base /app/dist ./dist
COPY . ./

EXPOSE 8000
ENTRYPOINT ["uv", "run", "--with", "gunicorn", "gunicorn", "--bind", "0.0.0.0:8000", "--pythonpath", "/app/src", "main:app"]