import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
	const data = {
		type: "link",
		version: "1.0",
		author_name: "%%AGE%% y/o catgirl",
	};

	return new Response(JSON.stringify(data), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
		},
	});
};
