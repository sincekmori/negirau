/** The one device-position call: promisified, with a shared timeout. */

const POSITION_TIMEOUT_MS = 10_000;

export function currentPosition(): Promise<GeolocationPosition> {
	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) {
			reject(new Error("geolocation unavailable"));
			return;
		}
		navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: POSITION_TIMEOUT_MS });
	});
}
