import asyncio
import logging
import sys

import discord
import sentry_sdk
import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from loguru import logger
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from starlette.middleware.base import BaseHTTPMiddleware

from utils import Website


class AgeHandler:
	def __init__(self):
		self.age = 0
		self._age_task = None

	async def age_task(self) -> None:
		try:
			while True:
				self.age = website.calculate_age()
				print(f"Updated age to {self.age}")
				await asyncio.sleep(86400)
		except asyncio.CancelledError:
			pass


age_task = AgeHandler()


async def lifespan(_):
	await website.login()
	age_task._age_task = asyncio.create_task(age_task.age_task())
	logger.info("Website & API ready")
	yield
	await website.client.close()
	logger.info("Shut down website & API")


website = Website()

sentry_sdk.init(
	dsn=website.env["SENTRY_DSN"],
	integrations=[FastApiIntegration(), StarletteIntegration()],
	traces_sample_rate=1.0,
	profiles_sample_rate=0.5,
	send_default_pii=True,
)

app = FastAPI(lifespan=lifespan)

LOG_LEVEL = website.env["LOG_LEVEL"]


class AgeMiddleware(BaseHTTPMiddleware):
	async def dispatch(self, request: Request, call_next):
		response = await call_next(request)
		content_type = response.headers.get("content-type", "")
		if not any(ct in content_type for ct in ("text/html", "application/json")):
			return response

		body = b""
		async for chunk in response.body_iterator:
			body += chunk if isinstance(chunk, bytes) else chunk.encode()

		age = str(website.age)
		body = body.replace(b"%%AGE%%", age.encode())

		headers = dict(response.headers)
		headers.pop("content-length", None)  # Remove the old length

		return Response(
			content=body,
			status_code=response.status_code,
			headers=headers,
			media_type=response.media_type,
		)


app.add_middleware(AgeMiddleware)


@app.get("/info")
async def info_handler():
	return f"Up since: {website.up_since} (UTC)"


@app.get("/s/{code}")
async def redirector(code: str):
	if not website.links.get(code):
		await website.reload_links()
	if not website.links.get(code):
		return RedirectResponse("/")
	return RedirectResponse(website.links.get(code))


@app.get("/fuck/{fuckery}")
async def fuck_everything(request: Request, fuckery: str):
	lmao = "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123456789/+"

	def check(word: str):
		return all(i in lmao for i in word)

	if check(fuckery):
		return website.jinja_template.TemplateResponse(
			name="fuck.html",
			context={"request": request, "x": fuckery.replace("+", " ")},
		)
	else:
		return website.jinja_template.TemplateResponse(
			name="error.html",
			context={
				"request": request,
				"title": "400",
				"message": "Invalid Characters.\nYou can use + for spaces.",
			},
			status_code=400,
		)


@app.get("/av/{user_id}")
async def user_avatar(user_id: str):
	if user_id == "@me":
		user_id = str(website.env["OWNER_ID"])
	if not user_id.isdigit():
		return RedirectResponse("/")
	try:
		user: discord.User = await website.client.fetch_user(user_id)
	except (discord.NotFound, discord.HTTPException):
		return RedirectResponse("/")
	return RedirectResponse(user.display_avatar.with_size(4096).url)


@app.get("/teapot")
async def teapot():
	return Response(status_code=418)


@app.get("/banner/{user_id}")
async def user_banner(user_id: str):
	if user_id == "@me":
		user_id = str(website.env["OWNER_ID"])
	if not user_id.isdigit():
		return RedirectResponse("/")
	try:
		user: discord.User = await website.client.fetch_user(user_id)
	except (discord.NotFound, discord.HTTPException):
		return RedirectResponse("/")
	if not user.banner:
		return RedirectResponse("/")
	return RedirectResponse(user.banner.with_size(4096).url)


@app.get("/meow.json")
async def meow_json():
	return {
		"type": "link",
		"version": "1.0",
		"author_name": f"{website.age} y/o catgirl",
	}


app.mount("/", StaticFiles(directory="dist", html=True), name="static")


class InterceptHandler(logging.Handler):
	"""Routes stdlib logging through loguru."""

	def emit(self, record):
		try:
			level = logger.level(record.levelname).name
		except ValueError:
			level = record.levelno

		frame, depth = sys._getframe(6), 6
		while frame and frame.f_code.co_filename == logging.__file__:
			frame = frame.f_back
			depth += 1

		logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def setup_logging():
	logger.remove()

	logger.add(
		sys.stderr,
		level=LOG_LEVEL,
		colorize=True,
	)

	logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)


if __name__ == "__main__":
	setup_logging()
	uvicorn.run(app, host="0.0.0.0", port=website.env["PORT"], log_level=LOG_LEVEL.lower())
