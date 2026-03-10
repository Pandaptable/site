import datetime
import tomllib
from pathlib import Path
from zoneinfo import ZoneInfo

import discord
from fastapi import FastAPI
from fastapi.templating import Jinja2Templates
from lru import LRU

CONFIG_PATH = Path(__file__).parent / "../config.toml"
EST = ZoneInfo("America/New_York")


class Website(FastAPI):
	def __init__(self) -> None:
		with open(CONFIG_PATH, "rb") as f:
			config = tomllib.load(f)
		self.birthday: datetime.date = config["site"]["BIRTHDAY"]
		self.client: discord.Client = discord.Client(intents=discord.Intents.all())
		self.jinja_template = Jinja2Templates("./src/jinja")
		self.up_since: str = datetime.datetime.now(datetime.timezone.utc).strftime("%m/%d/%Y, %H:%M:%S")
		self.links: dict = LRU(30)
		self.env: dict = {
			"BASE_URL": config["site"]["BASE_URL"],
			"CHANNEL_ID": config["discord"]["CHANNEL_ID"],
			"MESSAGE_ID": config["discord"]["MESSAGE_ID"],
			"OWNER_ID": int(config["discord"]["OWNER_ID"]),
			"PORT": config["site"]["PORT"],
			"TOKEN": config["discord"]["TOKEN"],
			"SENTRY_DSN": config["sentry"]["SENTRY_DSN"],
			"LOG_LEVEL": config["site"]["LOG_LEVEL"],
		}

	def calculate_age(self) -> int:
		"""Calculates current age based on birthday in Eastern time."""
		today = datetime.datetime.now(EST).date()
		age = today.year - self.birthday.year
		if (today.month, today.day) < (self.birthday.month, self.birthday.day):
			age -= 1
		return age

	async def login(self) -> None:
		"""Logs in the client."""
		await self.client.login(self.env["TOKEN"])

	def redirect(self, url: str) -> dict:
		"""Redirects to a URL."""
		return {
			"status_code": 307,
			"body": "",
			"type": "text",
			"headers": {"Location": url},
		}

	async def reload_links(self) -> None:
		"""Reloads the shortened links."""
		message = await self.client.http.get_message(self.env["CHANNEL_ID"], self.env["MESSAGE_ID"])
		for link in message["content"].split("\n"):
			self.links[link.split(" ")[0]] = link.split(" ")[1]
