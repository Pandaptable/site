import time

import aiohttp

TIME_UNITS = [
	("year", 31536000),
	("month", 2592000),
	("week", 604800),
	("day", 86400),
	("hour", 3600),
	("minute", 60),
	("second", 1),
]


def relative_time(timestamp: int) -> str:
	"""Converts a Unix timestamp to a relative time string."""
	diff = int(time.time()) - timestamp
	for unit, value in TIME_UNITS:
		amount = diff // value
		if amount > 0:
			plural = "s" if amount > 1 else ""
			return f"{amount} {unit}{plural} ago"
	return "just now"


def format_status(activity: dict) -> str:
	"""Formats the status and progress of an activity."""
	status = activity.get("status") or ""
	progress = activity.get("progress") or ""

	raw = f"{status} {progress}".strip()
	if raw:
		return raw[0].upper() + raw[1:]
	return ""


async def fetch_anilist_data(user_id: int = 713317, page: int = 1) -> dict:
	"""Fetches data from AniList via aiohttp and outputs the exact target JSON structure."""
	query = """
	query ($userId: Int, $page: Int) {
		Page(page: $page, perPage: 4) {
			activities(userId: $userId, sort: ID_DESC) {
				... on ListActivity {
					createdAt
					status
					progress
					media {
						coverImage { extraLarge }
						title { english romaji }
					}
				}
			}
		}
	}
	"""

	data = {}
	try:
		async with (
			aiohttp.ClientSession() as session,
			session.post("https://graphql.anilist.co", json={"query": query, "variables": {"userId": user_id, "page": page}}, headers={"Content-Type": "application/json"}) as response,
		):
			response.raise_for_status()
			data = await response.json()
	except aiohttp.ClientError as e:
		print(f"Failed to fetch AniList data: {e}")

	raw_activities = data.get("data", {}).get("Page", {}).get("activities", [])
	activities = [a for a in raw_activities if a.get("media")]

	dynamic_data = []

	for i in range(1, 5):
		if i - 1 < len(activities):
			activity = activities[i - 1]
			media = activity["media"]

			image_url = media["coverImage"]["extraLarge"]
			title = media["title"]["english"] or media["title"]["romaji"]

			status_text = format_status(activity)
			time_text = relative_time(activity["createdAt"])
			description = f"{status_text} | {time_text}"
		else:
			image_url = "temp"
			title = "temp"
			description = "temp"

		dynamic_data.extend([
			{"type": 3, "name": f"anilist-{i}", "value": {"url": image_url}},
			{"type": 1, "name": f"anilist-{i}-title", "value": title},
			{"type": 1, "name": f"anilist-{i}-description", "value": description},
		])

	dynamic_data.append({"type": 1, "name": "title", "value": "Recently consumed"})

	return {"data": {"dynamic": dynamic_data}}
