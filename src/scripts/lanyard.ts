const DISCORD_USER_ID = "97153209843335168";
const ACTIVITY_TYPE = [
	"Playing",
	"Streaming to",
	"Listening to",
	"Watching",
	"Custom status",
	"Competing in",
	"Hang Status",
] as const;
const STATUS_COLOR: Record<string, string> = {
	online: "#a6e3a1",
	idle: "#f9e2af",
	dnd: "#f38ba8",
	offline: "#a6adc8",
};

interface LanyardActivity {
	type: number;
	name: string;
	details?: string;
	state?: string;
	application_id?: string;
	assets?: {
		large_image?: string;
		large_text?: string;
		small_image?: string;
		small_text?: string;
	};
	timestamps?: { start?: number; end?: number };
}

interface LanyardData {
	discord_status: string;
	activities?: LanyardActivity[];
}

const rpcBox = document.querySelector<HTMLElement>(".discord-rpc")!;
const rpcImages = document.querySelector<HTMLElement>(".discord-rpc-images")!;
const errorCanvasHost = document.querySelector<HTMLElement>(".rpc-error")!;
const colorDot = document.querySelector<HTMLElement>(".discord-color-dot")!;
const statusText = document.querySelector<HTMLElement>(".discord-status-text")!;
const activityText = document.querySelector<HTMLElement>(
	".discord-activity .rpc-text",
)!;
const detailsText = document.querySelector<HTMLElement>(
	".discord-details .rpc-text",
)!;
const stateText = document.querySelector<HTMLElement>(
	".discord-state .rpc-text",
)!;
const timestampEl = document.querySelector<HTMLElement>(".discord-timestamp")!;
const progressEl = document.querySelector<HTMLElement>(".discord-progress")!;
const progressBar = document.querySelector<HTMLElement>(
	".discord-progress-bar",
)!;
const navLeft = document.querySelector<HTMLButtonElement>(".discord-nav-left")!;
const navRight =
	document.querySelector<HTMLButtonElement>(".discord-nav-right")!;
const largeImage = document.querySelector<HTMLElement>(".discord-large-image")!;
const smallImage = document.querySelector<HTMLElement>(".discord-small-image")!;
const imageMask = document.querySelector<HTMLElement>(
	".discord-image-container foreignObject",
)!;

let timestampInterval: number | null = null;
let progressInterval: number | null = null;
let cachedTimestamp = "";
let currentActivities: LanyardActivity[] = [];
let currentActivityIndex = 0;

function setRpcTimestamp(start?: number, end?: number) {
	const key = `${start} ${end}`;
	if (cachedTimestamp === key) return;
	cachedTimestamp = key;

	if (timestampInterval) {
		clearInterval(timestampInterval);
		timestampInterval = null;
	}

	if (!start && !end) {
		timestampEl.textContent = "";
		return;
	}

	function tick() {
		const now = Date.now();
		let diff: number;

		if (end) {
			diff = Math.max(0, end - now);
		} else if (start) {
			diff = now - start;
		} else return;

		const hrs = Math.floor(diff / 3600000);
		const mins = Math.floor((diff % 3600000) / 60000);
		const secs = Math.floor((diff % 60000) / 1000);

		let text: string;
		if (end) {
			text =
				hrs > 0
					? `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")} left`
					: `${mins}:${String(secs).padStart(2, "0")} left`;
		} else {
			text =
				hrs > 0
					? `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")} elapsed`
					: `${mins}:${String(secs).padStart(2, "0")} elapsed`;
		}

		timestampEl.textContent = text;
	}

	tick();
	timestampInterval = window.setInterval(tick, 1000);
}

function setProgress(activityType: number, start?: number, end?: number) {
	if (progressInterval) {
		clearInterval(progressInterval);
		progressInterval = null;
	}

	const showProgress =
		(activityType === 2 || activityType === 3) && start && end;

	if (!showProgress) {
		progressEl.style.display = "none";
		return;
	}

	progressEl.style.display = "";

	function updateBar() {
		if (!start || !end) return;
		const now = Date.now();
		const total = end - start;
		const elapsed = now - start;
		const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
		progressBar.style.width = `${pct}%`;
	}

	updateBar();
	progressInterval = window.setInterval(updateBar, 1000);
}

function updateMarquees() {
	document
		.querySelectorAll<HTMLElement>(".discord-rpc-info > span")
		.forEach((outer) => {
			const inner = outer.querySelector<HTMLElement>(".rpc-text");
			if (!inner) return;
			inner.classList.remove("rpc-scroll");
			const overflow = inner.scrollWidth - outer.clientWidth;
			if (overflow > 8 && outer.clientWidth > 0) {
				inner.style.setProperty(
					"--rpc-scroll-dist",
					`${-(overflow + 16)}px`,
				);
				inner.style.setProperty(
					"--rpc-scroll-duration",
					`${Math.max(6, overflow / 25)}s`,
				);
				inner.classList.add("rpc-scroll");
			}
		});
}

function displayActivity(a: LanyardActivity) {
	cachedTimestamp = "";

	statusText.textContent = ACTIVITY_TYPE[a.type] || "";

	(["large", "small"] as const).forEach(async (s) => {
		const img = s === "large" ? largeImage : smallImage;
		const size = s === "large" ? 160 : 60;
		let imageUrl = a.assets?.[`${s}_image`];

		if (!imageUrl) {
			if (s === "large" && a.application_id) {
				try {
					const { icon } = await fetch(
						`https://discord.com/api/v10/applications/${a.application_id}/rpc`,
					).then((r) => r.json());
					if (icon) {
						img.setAttribute(
							"style",
							`background-image: url(https://cdn.discordapp.com/app-icons/${a.application_id}/${icon}.png?size=${size})`,
						);
						return;
					}
				} catch {}
			}
			img.setAttribute("style", "");
			img.setAttribute("title", "");
			if (s === "small") imageMask.removeAttribute("mask");
			return;
		}

		if (imageUrl.startsWith("mp:"))
			imageUrl = `https://media.discordapp.net/${imageUrl.slice(3)}?width=${size}&height=${size}`;
		else if (imageUrl.startsWith("spotify:"))
			imageUrl = `https://i.scdn.co/image/${imageUrl.slice(8)}`;
		else
			imageUrl = `https://cdn.discordapp.com/app-assets/${a.application_id}/${imageUrl}.png?size=${size}`;

		img.setAttribute("style", `background-image: url(${imageUrl})`);
		img.setAttribute("title", a.assets?.[`${s}_text`] || "");
		if (s === "small")
			imageMask.setAttribute("mask", "url(#mask-large-image)");
	});

	activityText.textContent = a.name ?? "";
	detailsText.textContent = a.details ?? "";
	stateText.textContent = a.state ?? "";

	setRpcTimestamp(a.timestamps?.start, a.timestamps?.end);
	setProgress(a.type, a.timestamps?.start, a.timestamps?.end);
	requestAnimationFrame(updateMarquees);
}

function updateNavArrows() {
	const show = currentActivities.length > 1;
	navLeft.style.display = show ? "" : "none";
	navRight.style.display = show ? "" : "none";
}
let error3d: { stop: () => void } | null = null;
const fontDataPromise = fetch("/verdana.json")
	.then((r) => r.json())
	.catch(() => null);

async function showError3d() {
	if (error3d) return;
	const hostWidth = errorCanvasHost.clientWidth;
	const hostHeight = errorCanvasHost.clientHeight;
	if (!hostWidth || !hostHeight) return;

	const fontData = await fontDataPromise;
	if (!fontData) throw new Error("fontData prefetch failed");

	const parseThreeFont = (font: any, text = "ERROR") => {
		const fontScale = 40 / (font.resolution || 1000);
		const curveSegments = 3;
		const bevelSize = 1;
		const horizontalScale = 0.75;
		const verticalScale = 1.3;

		let currentOffsetX = 0;
		const rawGlyphRings: number[][][] = [];

		for (const character of text) {
			const glyphData = font.glyphs[character] || font.glyphs["R"];
			if (!glyphData?.o) continue;

			const commandTokens = glyphData.o.trim().split(/\s+/);
			let polygonRing: number[][] = [];
			let currentX = 0;
			let currentY = 0;

			const appendPoint = (fontX: number, fontY: number) => {
				const scaledX = (fontX + currentOffsetX) * fontScale;
				const scaledY = -fontY * fontScale;
				if (
					!polygonRing.length ||
					Math.hypot(
						scaledX - polygonRing[polygonRing.length - 1][0],
						scaledY - polygonRing[polygonRing.length - 1][1],
					) > 1e-3
				) {
					polygonRing.push([scaledX, scaledY]);
				}
			};

			const closeRing = () => {
				if (polygonRing.length >= 3) {
					if (
						Math.hypot(
							polygonRing[0][0] -
								polygonRing[polygonRing.length - 1][0],
							polygonRing[0][1] -
								polygonRing[polygonRing.length - 1][1],
						) < 1e-2
					) {
						polygonRing.pop();
					}
					if (polygonRing.length >= 3)
						rawGlyphRings.push(polygonRing);
				}
				polygonRing = [];
			};

			for (let tokenIndex = 0; tokenIndex < commandTokens.length;) {
				const command = commandTokens[tokenIndex++];
				if (command === "m") {
					closeRing();
					currentX = +commandTokens[tokenIndex++];
					currentY = +commandTokens[tokenIndex++];
					appendPoint(currentX, currentY);
				} else if (command === "l") {
					currentX = +commandTokens[tokenIndex++];
					currentY = +commandTokens[tokenIndex++];
					appendPoint(currentX, currentY);
				} else if (command === "q") {
					const endX = +commandTokens[tokenIndex++];
					const endY = +commandTokens[tokenIndex++];
					const controlX = +commandTokens[tokenIndex++];
					const controlY = +commandTokens[tokenIndex++];
					const startX = currentX;
					const startY = currentY;

					for (let step = 1; step <= curveSegments; step++) {
						const bezierParam = step / curveSegments;
						const oneMinusT = 1 - bezierParam;
						appendPoint(
							oneMinusT * oneMinusT * startX +
								2 * oneMinusT * bezierParam * controlX +
								bezierParam * bezierParam * endX,
							oneMinusT * oneMinusT * startY +
								2 * oneMinusT * bezierParam * controlY +
								bezierParam * bezierParam * endY,
						);
					}
					currentX = endX;
					currentY = endY;
				} else if (command === "b") {
					const endX = +commandTokens[tokenIndex++];
					const endY = +commandTokens[tokenIndex++];
					const control1X = +commandTokens[tokenIndex++];
					const control1Y = +commandTokens[tokenIndex++];
					const control2X = +commandTokens[tokenIndex++];
					const control2Y = +commandTokens[tokenIndex++];
					const startX = currentX;
					const startY = currentY;

					for (let step = 1; step <= curveSegments; step++) {
						const bezierParam = step / curveSegments;
						const oneMinusT = 1 - bezierParam;
						appendPoint(
							oneMinusT * oneMinusT * oneMinusT * startX +
								3 *
									oneMinusT *
									oneMinusT *
									bezierParam *
									control1X +
								3 *
									oneMinusT *
									bezierParam *
									bezierParam *
									control2X +
								bezierParam * bezierParam * bezierParam * endX,
							oneMinusT * oneMinusT * oneMinusT * startY +
								3 *
									oneMinusT *
									oneMinusT *
									bezierParam *
									control1Y +
								3 *
									oneMinusT *
									bezierParam *
									bezierParam *
									control2Y +
								bezierParam * bezierParam * bezierParam * endY,
						);
					}
					currentX = endX;
					currentY = endY;
				} else if (command === "z") {
					closeRing();
				}
			}
			closeRing();
			currentOffsetX += glyphData.ha || 650;
		}

		let minX = Infinity,
			maxX = -Infinity,
			minY = Infinity,
			maxY = -Infinity;

		rawGlyphRings.forEach((ring) =>
			ring.forEach(([x, y]) => {
				if (x < minX) minX = x;
				if (x > maxX) maxX = x;
				if (y < minY) minY = y;
				if (y > maxY) maxY = y;
			}),
		);

		const centerX = (minX + maxX) / 2;
		const centerY = (minY + maxY) / 2;
		const normalizedRings = rawGlyphRings.map((ring) =>
			ring.map(([x, y]) => [x - centerX, y - centerY]),
		);

		const offsetRing = (ringPoints: number[][], distance: number) => {
			let polygonArea = 0;
			ringPoints.forEach(([x1, y1], index) => {
				const [x2, y2] = ringPoints[(index + 1) % ringPoints.length];
				polygonArea += x1 * y2 - x2 * y1;
			});
			const windingDirection = polygonArea >= 0 ? 1 : -1;

			return ringPoints.map((point, index) => {
				const previousPoint =
					ringPoints[
						(index - 1 + ringPoints.length) % ringPoints.length
					];
				const nextPoint = ringPoints[(index + 1) % ringPoints.length];
				const length1 =
					Math.hypot(
						point[0] - previousPoint[0],
						point[1] - previousPoint[1],
					) || 1;
				const length2 =
					Math.hypot(
						nextPoint[0] - point[0],
						nextPoint[1] - point[1],
					) || 1;

				const normal1X =
					(windingDirection * (point[1] - previousPoint[1])) /
					length1;
				const normal1Y =
					(-windingDirection * (point[0] - previousPoint[0])) /
					length1;
				const normal2X =
					(windingDirection * (nextPoint[1] - point[1])) / length2;
				const normal2Y =
					(-windingDirection * (nextPoint[0] - point[0])) / length2;

				const averageNormalX = normal1X + normal2X;
				const averageNormalY = normal1Y + normal2Y;
				const normalLength =
					Math.hypot(averageNormalX, averageNormalY) || 1;

				return [
					(point[0] + (averageNormalX / normalLength) * distance) *
						horizontalScale,
					(point[1] + (averageNormalY / normalLength) * distance) *
						verticalScale,
				];
			});
		};

		const outerRings = normalizedRings.map((ring) =>
			offsetRing(ring, bevelSize),
		);
		const frontCapRings = normalizedRings.map((ring) =>
			ring.map(([x, y]) => [x * horizontalScale, y * verticalScale]),
		);

		const wallSegments: any[] = [];
		outerRings.forEach((outerRing, ringIndex) => {
			const frontCapRing = frontCapRings[ringIndex];
			outerRing.forEach(([startX, startY], index) => {
				const nextIndex = (index + 1) % outerRing.length;
				wallSegments.push({
					startX,
					startY,
					endX: outerRing[nextIndex][0],
					endY: outerRing[nextIndex][1],
					capX1: frontCapRing[index][0],
					capY1: frontCapRing[index][1],
					capX2: frontCapRing[nextIndex][0],
					capY2: frontCapRing[nextIndex][1],
				});
			});
		});

		return { capRings: frontCapRings, segs: wallSegments };
	};

	const { capRings, segs } = parseThreeFont(fontData, "ERROR");
	const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);

	const canvas = document.createElement("canvas");
	canvas.width = hostWidth * devicePixelRatio;
	canvas.height = hostHeight * devicePixelRatio;
	canvas.style.cssText = `width:${hostWidth}px;height:${hostHeight}px;display:block;`;
	errorCanvasHost.replaceChildren(canvas);

	const ctx = canvas.getContext("2d")!;
	const focalLength =
		canvas.height / 2 / Math.tan((45 / 2) * (Math.PI / 180));
	const halfCanvasWidth = canvas.width / 2;
	const halfCanvasHeight = canvas.height / 2;
	const halfBodyDepth = 7.5;
	const halfTotalDepth = 8.5;

	let animationFrameId = 0;
	let isAnimationRunning = true;
	let rotationY = 0;
	let lastFrameTime = performance.now();

	const animate = () => {
		if (!isAnimationRunning) return;
		animationFrameId = requestAnimationFrame(animate);

		const now = performance.now();
		const deltaTime = (now - lastFrameTime) / 1000;
		lastFrameTime = now;

		rotationY += 0.9 * deltaTime;

		const currentTime = Date.now();
		const rotationX = -Math.sin(currentTime * 0.001) * 0.15;

		const cyclePos = (currentTime % 1400) / 700;
		const triangleWave = 1 - Math.abs(cyclePos - 1);

		const flashProgress = Math.pow(triangleWave, 1.4);

		const minRed = 0x38;
		const redChannel = Math.round(minRed + (0xff - minRed) * flashProgress);
		const hexColor = `#${redChannel.toString(16).padStart(2, "0")}0000`;

		const cosineY = Math.cos(rotationY);
		const sineY = Math.sin(rotationY);
		const cosineX = Math.cos(rotationX);
		const sineX = Math.sin(rotationX);

		const projectPoint = (x: number, y: number, z: number) => {
			const rotatedX = x * cosineY + z * sineY;
			const rotatedZ = -x * sineY + z * cosineY;
			const transformedY = y * cosineX - rotatedZ * sineX;
			const transformedZ = y * sineX + rotatedZ * cosineX;
			const perspectiveScale = focalLength / (120 - transformedZ);
			return {
				screenX: halfCanvasWidth + rotatedX * perspectiveScale,
				screenY: halfCanvasHeight + transformedY * perspectiveScale,
				depthZ: transformedZ,
			};
		};

		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = hexColor;

		const drawCap = (depthZ: number) => {
			ctx.beginPath();
			capRings.forEach((ring) => {
				ring.forEach(([x, y], index) => {
					const projectedPoint = projectPoint(x, y, depthZ);
					index
						? ctx.lineTo(
								projectedPoint.screenX,
								projectedPoint.screenY,
							)
						: ctx.moveTo(
								projectedPoint.screenX,
								projectedPoint.screenY,
							);
				});
				ctx.closePath();
			});
			ctx.fill("evenodd");
		};

		const backCapZ =
			projectPoint(0, 0, halfTotalDepth).depthZ <
			projectPoint(0, 0, -halfTotalDepth).depthZ
				? halfTotalDepth
				: -halfTotalDepth;
		drawCap(backCapZ);

		const extrusionQuads: any[] = [];
		segs.forEach((segment) => {
			const frontPoint1 = projectPoint(
				segment.startX,
				segment.startY,
				halfBodyDepth,
			);
			const frontPoint2 = projectPoint(
				segment.endX,
				segment.endY,
				halfBodyDepth,
			);
			const backPoint2 = projectPoint(
				segment.endX,
				segment.endY,
				-halfBodyDepth,
			);
			const backPoint1 = projectPoint(
				segment.startX,
				segment.startY,
				-halfBodyDepth,
			);

			const frontCap1 = projectPoint(
				segment.capX1,
				segment.capY1,
				halfTotalDepth,
			);
			const frontCap2 = projectPoint(
				segment.capX2,
				segment.capY2,
				halfTotalDepth,
			);
			const backCap1 = projectPoint(
				segment.capX1,
				segment.capY1,
				-halfTotalDepth,
			);
			const backCap2 = projectPoint(
				segment.capX2,
				segment.capY2,
				-halfTotalDepth,
			);

			extrusionQuads.push(
				{
					p1: frontPoint1,
					p2: frontPoint2,
					p3: backPoint2,
					p4: backPoint1,
					z:
						(frontPoint1.depthZ +
							frontPoint2.depthZ +
							backPoint2.depthZ +
							backPoint1.depthZ) *
						0.25,
				},
				{
					p1: frontPoint1,
					p2: frontPoint2,
					p3: frontCap2,
					p4: frontCap1,
					z:
						(frontPoint1.depthZ +
							frontPoint2.depthZ +
							frontCap2.depthZ +
							frontCap1.depthZ) *
						0.25,
				},
				{
					p1: backPoint2,
					p2: backPoint1,
					p3: backCap1,
					p4: backCap2,
					z:
						(backPoint2.depthZ +
							backPoint1.depthZ +
							backCap1.depthZ +
							backCap2.depthZ) *
						0.25,
				},
			);
		});

		extrusionQuads
			.sort((a, b) => a.z - b.z)
			.forEach((quad) => {
				ctx.beginPath();
				ctx.moveTo(quad.p1.screenX, quad.p1.screenY);
				ctx.lineTo(quad.p2.screenX, quad.p2.screenY);
				ctx.lineTo(quad.p3.screenX, quad.p3.screenY);
				ctx.lineTo(quad.p4.screenX, quad.p4.screenY);
				ctx.closePath();
				ctx.fill();
			});

		drawCap(-backCapZ);
	};

	animate();
	rpcBox.classList.add("rpc-3d");
	error3d = {
		stop: () => {
			isAnimationRunning = false;
			cancelAnimationFrame(animationFrameId);
			errorCanvasHost.replaceChildren();
			rpcBox.classList.remove("rpc-3d");
			error3d = null;
		},
	};
}

function updateLanyard(data: LanyardData) {
	const { discord_status, activities } = data;

	document
		.querySelectorAll(".rpc-static-error, .rpc-static-hint")
		.forEach((el) =>
			el.classList.remove("rpc-static-error", "rpc-static-hint"),
		);

	colorDot.setAttribute(
		"style",
		`border-color: ${STATUS_COLOR[discord_status] || STATUS_COLOR.offline}`,
	);

	const filtered = (activities || []).filter(
		(a) => a.type !== 4 && a.type !== 6,
	);

	if (!filtered.length) {
		currentActivities = [];
		currentActivityIndex = 0;
		setRpcTimestamp();
		setProgress(-1);
		updateNavArrows();
		statusText.textContent = "";
		activityText.textContent = "";
		detailsText.textContent = "";
		stateText.textContent = "";
		requestAnimationFrame(updateMarquees);
		rpcBox.classList.add("rpc-idle");
		const boot3d = () => setTimeout(() => void showError3d(), 500);
		if (document.readyState === "complete") boot3d();
		else window.addEventListener("load", boot3d, { once: true });
		rpcImages.style.visibility = "hidden";
		return;
	}
	error3d?.stop();
	rpcBox.classList.remove("rpc-idle");
	rpcImages.style.visibility = "";
	currentActivities = filtered;

	if (currentActivityIndex >= filtered.length) {
		currentActivityIndex = 0;
	}

	updateNavArrows();
	displayActivity(filtered[currentActivityIndex]);
}

function connectLanyard() {
	const ws = new WebSocket("wss://api.lanyard.rest/socket");

	ws.addEventListener("open", () =>
		ws.send(
			JSON.stringify({
				op: 2,
				d: { subscribe_to_id: DISCORD_USER_ID },
			}),
		),
	);

	ws.addEventListener("message", ({ data }) => {
		const msg = JSON.parse(data);
		if (msg.op === 1) {
			setInterval(
				() => ws.send(JSON.stringify({ op: 3 })),
				msg.d.heartbeat_interval,
			);
		}
		if (msg.t === "INIT_STATE" || msg.t === "PRESENCE_UPDATE") {
			updateLanyard(msg.d);
		}
	});

	ws.addEventListener("error", () => ws.close());
	ws.addEventListener("close", () => setTimeout(connectLanyard, 1000));
}

navLeft.addEventListener("click", () => {
	if (currentActivities.length <= 1) return;
	currentActivityIndex =
		(currentActivityIndex - 1 + currentActivities.length) %
		currentActivities.length;
	displayActivity(currentActivities[currentActivityIndex]);
});

navRight.addEventListener("click", () => {
	if (currentActivities.length <= 1) return;
	currentActivityIndex =
		(currentActivityIndex + 1) % currentActivities.length;
	displayActivity(currentActivities[currentActivityIndex]);
});

connectLanyard();
