import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDreamworksServer } from "../server.js";
import { createOfficeTourAuthService } from "../office-tour-auth.js";
import { createStrategyAuthService } from "../strategy-auth.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const tourRoot = join(ROOT, "office-tour");
const tour = JSON.parse(readFileSync(join(tourRoot, "data/tour.json"), "utf8"));
const mainHtml = readFileSync(join(ROOT, "index.html"), "utf8");
const mainApp = readFileSync(join(ROOT, "js/app.js"), "utf8");
const tourHtml = readFileSync(join(tourRoot, "index.html"), "utf8");

assert.equal(tour.sections.length, 14, "The integrated tour must retain all 14 sections");
assert.equal(tour.source.photoCount, 87, "The manifest must retain the reviewed 87-photo count");
assert.equal(tour.sections.reduce((total, section) => total + section.photos.length, 0), 87, "All section photos must be represented in the manifest");
assert.deepEqual(tour.sections.map(section => Number(section.id)), Array.from({ length: 14 }, (_, index) => index + 1), "Tour section IDs must be sequential");

for (const section of tour.sections) {
  for (const photo of section.photos) {
    for (const key of ["src", "thumb"]) {
      const relative = String(photo[key]).replace(/^\//, "");
      assert(existsSync(join(tourRoot, relative)), `Missing ${key} derivative for section ${section.id}: ${relative}`);
    }
  }
}

for (const required of ["index.html", "app.js", "navigation.js", "scene.js", "styles.css", "vendor/three/three.module.js"]) {
  assert(existsSync(join(tourRoot, required)), `Missing office-tour runtime file: ${required}`);
}
assert(mainHtml.includes('href="/office-tour/"'), "Main navigation must expose the production tour route");
assert(mainHtml.includes("企业参访"), "Main navigation must label the tour entry");
assert(mainApp.includes("if (!link.dataset.page) return;"), "Main SPA router must allow real sub-application links");
assert(tourHtml.includes('id="tour-logout"'), "Protected tour must expose an explicit logout control");

const officeEnv = {
  OFFICE_TOUR_PUBLIC: "false",
  OFFICE_TOUR_USERNAME: "visitor@example.test",
  OFFICE_TOUR_PASSWORD: "office-password-2026",
  OFFICE_TOUR_SESSION_SECRET: "office-tour-test-secret-at-least-thirty-two-characters",
  OFFICE_TOUR_SESSION_TTL_SECONDS: "3600"
};
const strategyEnv = {
  STRATEGY_CASES_USERNAME: "cases@example.test",
  STRATEGY_CASES_PASSWORD: "cases-password-2026",
  STRATEGY_AUTH_SESSION_SECRET: "strategy-test-secret-at-least-thirty-two-characters"
};
const officeAuthService = createOfficeTourAuthService({ env: officeEnv });
const strategyAuthService = createStrategyAuthService({ env: strategyEnv });

assert.equal(officeAuthService.authenticate(officeEnv.OFFICE_TOUR_USERNAME, officeEnv.OFFICE_TOUR_PASSWORD).ok, true);
assert.equal(officeAuthService.authenticate(officeEnv.OFFICE_TOUR_USERNAME, "wrong").ok, false);
assert.equal(createOfficeTourAuthService({ env: {} }).configured(), false, "A missing office credential set must fail closed");
assert.equal(createOfficeTourAuthService({ env: { OFFICE_TOUR_PUBLIC: "true" } }).status({ headers: {} }).public, true, "Explicit public mode must be supported for post-review release");

const server = createDreamworksServer({
  officeTourAuthService: officeAuthService,
  strategyAuthService,
  agentService: { status: () => ({ configured: false }) }
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const base = `http://127.0.0.1:${server.address().port}`;
const request = (path, options = {}) => fetch(base + path, { redirect: "manual", ...options });

try {
  const redirect = await request("/office-tour");
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get("location"), "/office-tour/");

  const gateResponse = await request("/office-tour/");
  const gate = await gateResponse.text();
  assert.equal(gateResponse.status, 200);
  assert(gate.includes("企业线上参访"));
  assert(!gate.includes("空间索引"), "Unauthenticated HTML must not contain the tour application");
  assert.match(gateResponse.headers.get("cache-control") || "", /no-store/);
  assert.match(gateResponse.headers.get("content-security-policy") || "", /default-src 'self'/);

  const firstPhoto = String(tour.sections[0].photos[0].src).replace(/^\//, "");
  const blockedMedia = await request(`/office-tour/${firstPhoto}`);
  assert.equal(blockedMedia.status, 404, "Office media must not be retrievable before office authentication");
  assert.match(blockedMedia.headers.get("cache-control") || "", /no-store/);

  const wrongLogin = await request("/api/office-tour-auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: officeEnv.OFFICE_TOUR_USERNAME, password: "wrong" })
  });
  assert.equal(wrongLogin.status, 401);
  assert(!JSON.stringify(await wrongLogin.json()).includes(officeEnv.OFFICE_TOUR_USERNAME), "Office auth errors must not echo usernames");

  const login = await request("/api/office-tour-auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: officeEnv.OFFICE_TOUR_USERNAME, password: officeEnv.OFFICE_TOUR_PASSWORD })
  });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get("set-cookie") || "";
  assert(setCookie.startsWith("dw_office_tour="), "Office login must issue only its dedicated cookie");
  assert(!setCookie.includes("dw_auth_"), "Office login must not mutate business authentication cookies");
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  const officeCookie = setCookie.split(";")[0];

  const status = await (await request("/api/office-tour-auth/status", { headers: { Cookie: officeCookie } })).json();
  assert.equal(status.authenticated, true);
  assert.equal(status.public, false);

  const tourResponse = await request("/office-tour/", { headers: { Cookie: officeCookie } });
  const integratedTour = await tourResponse.text();
  assert.equal(tourResponse.status, 200);
  assert(integratedTour.includes("空间索引"));
  assert.match(tourResponse.headers.get("cache-control") || "", /private, no-store/);
  assert.match(tourResponse.headers.get("vary") || "", /Cookie/);

  const mediaResponse = await request(`/office-tour/${firstPhoto}`, { headers: { Cookie: officeCookie } });
  assert.equal(mediaResponse.status, 200);
  assert.equal(mediaResponse.headers.get("content-type"), "image/webp");
  assert.match(mediaResponse.headers.get("cache-control") || "", /private, no-store/);

  const missingAsset = await request("/office-tour/not-found.js", { headers: { Cookie: officeCookie } });
  assert.equal(missingAsset.status, 404, "Missing tour assets must not fall through to main SPA HTML");
  assert.equal(missingAsset.headers.get("content-type"), "text/plain; charset=utf-8");

  const strategyStatusWithOfficeCookie = await (await request("/api/strategy-auth/status", { headers: { Cookie: officeCookie } })).json();
  assert.equal(Object.values(strategyStatusWithOfficeCookie.grants).some(Boolean), false, "Office authentication must not unlock any business system");

  const strategyLogin = await request("/api/strategy-auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope: "cases", username: strategyEnv.STRATEGY_CASES_USERNAME, password: strategyEnv.STRATEGY_CASES_PASSWORD })
  });
  assert.equal(strategyLogin.status, 200);
  const strategyCookie = String(strategyLogin.headers.get("set-cookie") || "").split(";")[0];
  assert(strategyCookie.startsWith("dw_auth_cases="));
  const gateWithStrategyCookie = await (await request("/office-tour/", { headers: { Cookie: strategyCookie } })).text();
  assert(gateWithStrategyCookie.includes("企业线上参访"), "Business authentication must not unlock the office tour");
  assert(!gateWithStrategyCookie.includes("空间索引"));

  const logout = await request("/api/office-tour-auth/logout", { method: "POST", headers: { Cookie: officeCookie } });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie") || "", /^dw_office_tour=;/);
  assert.match(logout.headers.get("set-cookie") || "", /Max-Age=0/);
} finally {
  await new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections?.();
  });
}

console.log("Office tour production integration checks passed.");
