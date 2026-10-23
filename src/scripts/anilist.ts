const ANILIST_USER_ID = 713317;
let currentPage = 1;
let isFetching = false;

const TIME_UNITS: [string, number][] = [
	["year", 31536000],
	["month", 2592000],
	["week", 604800],
	["day", 86400],
	["hour", 3600],
	["minute", 60],
	["second", 1],
];

function relativeTime(timestamp: number): string {
	const diff = Math.floor(Date.now() / 1000) - timestamp;
	for (const [unit, value] of TIME_UNITS) {
		const amount = Math.floor(diff / value);
		if (amount > 0) return `${amount} ${unit}${amount > 1 ? "s" : ""} ago`;
	}
	return "just now";
}

function formatStatus(activity: any): string {
	const raw = `${activity.status}${activity.progress ? ` ${activity.progress}` : ""}`;
	return raw.charAt(0).toUpperCase() + raw.slice(1);
}

async function loadAniList(page: number = 1) {
	if (isFetching) return;
	isFetching = true;

	const grid = document.getElementById("anilist-grid");
	const prevBtn = document.getElementById(
		"anilist-prev",
	) as HTMLButtonElement | null;
	const nextBtn = document.getElementById(
		"anilist-next",
	) as HTMLButtonElement | null;

	if (!grid) return;

	if (page > 1) grid.style.opacity = "0.5";

	const query = `query {
			Page(page: ${page}, perPage: 4) {
				pageInfo {
					hasNextPage
				}
				activities(userId: ${ANILIST_USER_ID}, sort: ID_DESC) {
					... on ListActivity {
						createdAt
						status
						progress
						media {
							coverImage {
								medium
							}
							title {
								english
								romaji
							}
							siteUrl
						}
					}
				}
			}
		}`;

	try {
		const res = await fetch("https://graphql.anilist.co", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ query }),
		}).then((r) => r.json());

		if (!res.data) return;

		const pageInfo = res.data.Page.pageInfo;
		const activities = res.data.Page.activities.filter((a: any) => a.media);

		grid.innerHTML = activities
			.map(
				(activity: any) => `
				<a href="${activity.media.siteUrl}" target="_blank" rel="noopener noreferrer" class="anilist-activity">
					<div class="anilist-cover" style="background-image: url(${activity.media.coverImage.medium})"></div>
					<div class="anilist-info">
						<span class="anilist-title">${activity.media.title.english || activity.media.title.romaji}</span>
						<span class="anilist-status">${formatStatus(activity)}</span>
						<time class="anilist-time"
							data-timestamp="${activity.createdAt}"
							datetime="${new Date(activity.createdAt * 1000).toISOString()}"
							title="${new Date(activity.createdAt * 1000).toLocaleString()}">
							${relativeTime(activity.createdAt)}
						</time>
					</div>
				</a>`,
			)
			.join("");

		if (prevBtn) prevBtn.disabled = page === 1;
		if (nextBtn) nextBtn.disabled = !pageInfo.hasNextPage;
	} catch (e) {
		console.error("Failed to fetch AniList data:", e);
	} finally {
		grid.style.opacity = "1";
		isFetching = false;
	}
}

function updateTimes() {
	document
		.querySelectorAll<HTMLTimeElement>(".anilist-time[data-timestamp]")
		.forEach((el) => {
			const timestamp = parseInt(el.dataset.timestamp || "0", 10);
			el.textContent = relativeTime(timestamp);
		});
}

document.getElementById("anilist-prev")?.addEventListener("click", (e) => {
	e.preventDefault();
	e.stopPropagation();
	if (currentPage > 1) {
		currentPage--;
		loadAniList(currentPage);
	}
});

document.getElementById("anilist-next")?.addEventListener("click", (e) => {
	e.preventDefault();
	e.stopPropagation();
	currentPage++;
	loadAniList(currentPage);
});

loadAniList(1);
setInterval(updateTimes, 60000);
