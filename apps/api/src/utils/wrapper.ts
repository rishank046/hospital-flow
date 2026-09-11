import type { RequestHandler } from "express";

export default function wrapper(handler: RequestHandler): RequestHandler {
	return (request, response, next) => {
		Promise.resolve()
			.then(() => handler(request, response, next))
			.catch(next);
	};
}