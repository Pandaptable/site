FROM node:alpine AS base
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./
RUN npm run build

FROM ghcr.io/astral-sh/uv:alpine
WORKDIR /app

COPY --from=base /app/dist ./dist
COPY . ./

EXPOSE 8000
ENTRYPOINT ["uv", "run", "uvicorn", "main:app", "--app-dir", "/app/src", "--host", "0.0.0.0", "--port", "8000"]