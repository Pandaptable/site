import asyncio
import logging
import sys
from pathlib import Path

import discord
import sentry_sdk
import uvicorn
from litestar import Litestar, Request, get
from litestar.contrib.jinja import JinjaTemplateEngine
from litestar.response import Redirect, Response, Template
from litestar.static_files import StaticFilesConfig
from litestar.template import TemplateConfig
from litestar.types import ASGIApp, Receive, Scope, Send
from loguru import logger
from sentry_sdk.integrations.litestar import LitestarIntegration

from utils import Website

website = Website()


sentry_sdk.init(
	dsn=website.env["SENTRY_DSN"],
	integrations=[LitestarIntegration()],
	traces_sample_rate=1.0,
	profiles_sample_rate=0.5,
	send_default_pii=True,
)

LOG_LEVEL = website.env["LOG_LEVEL"]


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


async def lifespan_startup(app: Litestar):
	await website.login()
	age_task._age_task = asyncio.create_task(age_task.age_task())
	logger.info("Website & API ready")


async def lifespan_shutdown(app: Litestar):
	await website.client.close()
	logger.info("Shut down website & API")


class AgeMiddleware:
	def __init__(self, app: ASGIApp):
		self.app = app

	async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
		if scope["type"] != "http":
			await self.app(scope, receive, send)
			return

		body_chunks: list[bytes] = []
		response_started: dict = {}

		async def send_wrapper(message):
			if message["type"] == "http.response.start":
				response_started.update(message)
			elif message["type"] == "http.response.body":
				body_chunks.append(message.get("body", b""))
				if not message.get("more_body", False):
					content_type = ""
					for name, value in response_started.get("headers", []):
						if name == b"content-type":
							content_type = value.decode()
							break

					full_body = b"".join(body_chunks)

					if any(ct in content_type for ct in ("text/html", "application/json")):
						full_body = full_body.replace(b"%%AGE%%", str(website.age).encode())

					new_headers = [
						h for h in response_started.get("headers", []) if h[0] != b"content-length"
					]
					new_headers.append((b"content-length", str(len(full_body)).encode()))

					await send({
						"type": "http.response.start",
						"status": response_started["status"],
						"headers": new_headers,
					})
					await send({
						"type": "http.response.body",
						"body": full_body,
						"more_body": False,
					})

		await self.app(scope, receive, send_wrapper)


@get("/info")
async def info_handler() -> str:
	return f"Up since: {website.up_since} (UTC)"


@get("/s/{code:str}")
async def redirector(code: str) -> Redirect:
	if not website.links.get(code):
		await website.reload_links()
	if not website.links.get(code):
		return Redirect("/")
	return Redirect(website.links.get(code))


@get("/fuck/{fuckery:str}")
async def fuck_everything(request: Request, fuckery: str) -> Template | Response:
	lmao = "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123456789/+"

	def check(word: str):
		return all(i in lmao for i in word)

	if check(fuckery):
		return Template("fuck.html", context={"x": fuckery.replace("+", " ")})
	else:
		return Template(
			"error.html",
			context={
				"title": "400",
				"message": "Invalid Characters.\nYou can use + for spaces.",
			},
			status_code=400,
		)


@get("/av/{user_id:str}")
async def user_avatar(user_id: str) -> Redirect:
	if user_id == "@me":
		user_id = str(website.env["OWNER_ID"])
	if not user_id.isdigit():
		return Redirect("/")
	try:
		user: discord.User = await website.client.fetch_user(user_id)
	except (discord.NotFound, discord.HTTPException):
		return Redirect("/")
	return Redirect(user.display_avatar.with_size(4096).url)


@get("/teapot")
async def teapot() -> Response:
	return Response(status_code=418)


@get("/banner/{user_id:str}")
async def user_banner(user_id: str) -> Redirect:
	if user_id == "@me":
		user_id = str(website.env["OWNER_ID"])
	if not user_id.isdigit():
		return Redirect("/")
	try:
		user: discord.User = await website.client.fetch_user(user_id)
	except (discord.NotFound, discord.HTTPException):
		return Redirect("/")
	if not user.banner:
		return Redirect("/")
	return Redirect(user.banner.with_size(4096).url)


@get("/meow.json")
async def meow_json() -> dict:
	return {
		"type": "link",
		"version": "1.0",
		"author_name": f"{website.age} y/o catgirl",
	}


app = Litestar(
	route_handlers=[
		info_handler,
		redirector,
		fuck_everything,
		user_avatar,
		teapot,
		user_banner,
		meow_json,
	],
	middleware=[AgeMiddleware],
	on_startup=[lifespan_startup],
	on_shutdown=[lifespan_shutdown],
	static_files_config=[
		StaticFilesConfig(directories=["dist"], path="/", html_mode=True),
	],
	template_config=TemplateConfig(
		directory=Path(__file__).parent / "jinja",
		engine=JinjaTemplateEngine,
	),
)


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
