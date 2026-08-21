import { describe, expect, it } from "vitest";

import { rateLimitKeyForIp } from "~/lib/server/rate-limit";

describe("rateLimitKeyForIp", () => {
	it("passes IPv4 through unchanged", () => {
		expect(rateLimitKeyForIp("203.0.113.7")).toBe("203.0.113.7");
	});

	it("collapses IPv6 to its /64", () => {
		expect(rateLimitKeyForIp("2001:db8:aaaa:bbbb:cccc:dddd:eeee:ffff")).toBe("2001:db8:aaaa:bbbb");
	});

	it("expands :: before taking the prefix", () => {
		expect(rateLimitKeyForIp("2001:db8::1")).toBe("2001:db8:0:0");
		expect(rateLimitKeyForIp("::1")).toBe("0:0:0:0");
	});
});
