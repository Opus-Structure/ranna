import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint } from "@/lib/push/endpoints";

describe("isAllowedPushEndpoint", () => {
  it("accepts the real browser push services", () => {
    for (const url of [
      "https://fcm.googleapis.com/fcm/send/abc:def",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
      "https://web.push.apple.com/QGuQyavXutnMei",
      "https://api.push.apple.com/3/device/x",
      "https://wns2-par02p.notify.windows.com/w/?token=x",
    ]) {
      expect(isAllowedPushEndpoint(url), url).toBe(true);
    }
  });

  it("refuses anything that could point the server elsewhere", () => {
    for (const url of [
      "http://fcm.googleapis.com/fcm/send/x", // not https
      "https://fcm.googleapis.com:8443/x", // explicit port
      "https://user:pass@fcm.googleapis.com/x", // credentials
      "https://fcm.googleapis.com.evil.test/x", // suffix trick
      "https://evilfcm.googleapis.com.test/x",
      "https://push.apple.com.evil.test/x",
      "https://127.0.0.1/x",
      "https://localhost/x",
      "https://169.254.169.254/latest/meta-data",
      "https://example.com/push",
      "not a url",
      "",
    ]) {
      expect(isAllowedPushEndpoint(url), url).toBe(false);
    }
  });
});
