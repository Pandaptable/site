from multiprocessing import cpu_count
from typing import Final

bind: Final[str] = "0.0.0.0:8000"

# Worker Options
workers: Final[int] = cpu_count() + 1
worker_class: Final[str] = 'uvicorn.workers.UvicornWorker'