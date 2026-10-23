FROM oven/bun:alpine AS base
RUN apk add --no-cache \
	imagemagick \
	imagemagick-heic \
	imagemagick-jxl \
	exiftool \
	ffmpeg \
	libjxl-tools
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
ENTRYPOINT ["uv", "run", "--with", "gunicorn", "--with", "uvicorn", "gunicorn", "-c", "/app/src/gunicorn_conf.py", "--pythonpath", "/app/src", "main:app"]
