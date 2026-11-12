import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { STUDIO_ROUTES } from "./manifest";

const root = resolve(process.cwd(), "app");
function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? pages(path) : entry.name === "page.tsx" ? [path] : [];
  });
}
const routeFor = (file: string) => "/" + relative(root, file).replace(/\/page\.tsx$/, "").split("/").filter(Boolean).join("/");
const matches = (pattern: string, path: string) => new RegExp("^" + pattern.replace(/\[[^/]+\]/g, "[^/]+") + "$").test(path);
describe("developer studio route inventory", () => {
  it("lists every page route once, including dynamic and private routes", () => {
    const actual = pages(root).map(routeFor).map((route) => route === "/page.tsx" ? "/" : route.replace(/\/page$/, ""));
    // app/page.tsx becomes /; nested pages become their directory routes.
    expect(STUDIO_ROUTES).toHaveLength(actual.length);
    for (const pattern of actual) expect(STUDIO_ROUTES.filter((entry) => matches(pattern, entry.path)), pattern).toHaveLength(1);
    for (const entry of STUDIO_ROUTES) expect(actual.some((pattern) => matches(pattern, entry.path)), entry.path).toBe(true);
    expect(STUDIO_ROUTES.filter((entry) => entry.preview && ["Account", "Guided journey", "Developer"].includes(entry.group))).toEqual([]);
  });
});
