const stage = document.querySelector(".ad-frame");
const ads = [...document.querySelectorAll<HTMLElement>(".ad")];

if (stage && ads.length > 1) {
	let current = ads.findIndex((a) => a.classList.contains("ad-active"));
	if (current === -1) current = 0;

	const rotate = () => {
		let next = Math.floor(Math.random() * ads.length);
		if (next === current)
			next =
				(next + 1 + Math.floor(Math.random() * (ads.length - 1))) %
				ads.length;
		ads[current].classList.remove("ad-active");
		ads[next].classList.add("ad-active");
		current = next;
	};

	rotate();
	setInterval(rotate, 7000);
}
