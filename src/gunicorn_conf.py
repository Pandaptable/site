from typing import Final

bind: Final[str] = "0.0.0.0:8000"

# Worker Options
# single async worker: the discord client logs in exactly once and every
# request shares it; static file reads still parallelize via the threadpool
workers: Final[int] = 1
worker_class: Final[str] = "uvicorn.workers.UvicornWorker"
