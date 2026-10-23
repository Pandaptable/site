declare global {
	interface Window {
		__titleMarquee?: boolean;
	}
}
export {};

if (!window.__titleMarquee) {
	window.__titleMarquee = true;

	const BLANK = "\u2800";
	let text = `${document.title.trim()}${BLANK}${BLANK}`;

	setInterval(() => {
		text = text.substring(1) + text[0];
		document.title = text;
	}, 180);
}
