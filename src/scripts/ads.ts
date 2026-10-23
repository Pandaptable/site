const stage = document.querySelector(".billboard-frame");
const ads = [...document.querySelectorAll<HTMLElement>(".billboard")];

if (stage && ads.length > 1) {
	let current = ads.findIndex((a) => a.classList.contains("billboard-on"));
	if (current === -1) current = 0;

	const rotate = () => {
		let next = Math.floor(Math.random() * ads.length);
		if (next === current)
			next =
				(next + 1 + Math.floor(Math.random() * (ads.length - 1))) %
				ads.length;
		ads[current].classList.remove("billboard-on");
		ads[next].classList.add("billboard-on");
		current = next;
	};

	rotate();
	setInterval(rotate, 7000);
}
