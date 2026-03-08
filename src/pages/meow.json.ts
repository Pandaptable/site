import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
	const bday = new Date("2006-02-17");

	const nowEST = new Date(
		new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
	);

	let calculated_age = nowEST.getFullYear() - bday.getFullYear();
	const m = nowEST.getMonth() - bday.getMonth();
	if (m < 0 || (m === 0 && nowEST.getDate() < bday.getDate())) {
		calculated_age--;
	}

	const data = {
		type: "link",
		version: "1.0",
		author_name: `${calculated_age} y/o catgirl`,
	};

	return new Response(JSON.stringify(data), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
		},
	});
};
