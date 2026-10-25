import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import JourneyPage from "../../pages/JourneyPage";
import WalletPage from "../../pages/WalletPage";
import { getTripById } from "../../data/tripLookup";
import { DelaySimulation } from "./DelaySimulation";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const walletCss = readFileSync(new URL("../wallet/wallet.css", import.meta.url), "utf8");
const themeCss = readFileSync(createRequire(import.meta.url).resolve("tailwindcss/theme.css"), "utf8");

const green = "#4f7a2f", lime = "#d7ef95";
const hex = (value) => [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
const luminance = (rgb) => rgb.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
function theme(name) {
  const value = themeCss.match(new RegExp(`--color-${name}\\s*:\\s*oklch\\(\\s*([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)\\s*\\)`));
  if (!value) throw new Error(`Missing installed Tailwind theme color ${name}`);
  const L = +value[1] / 100, C = +value[2], h = +value[3] * Math.PI / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s]
    .map((linear) => Math.max(0, Math.min(1, linear)))
    .map((linear) => linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055);
}
const white = hex("#ffffff"), panel = hex("#eef2ee");
const fadedOld = hex("#ad5b00").map((channel, index) => 0.65 * channel + 0.35 * panel[index]);
const rows = [
  { name: "Journey dark Wallet/back link", before: theme("slate-950"), beforeSurface: hex("#fbfcfe"), after: hex(lime), afterSurface: theme("slate-950") },
  { name: "Journey dark link / delay hover", before: theme("slate-950"), beforeSurface: white, after: hex(lime), afterSurface: theme("slate-700") },
  { name: "Start demo", before: theme("emerald-950"), beforeSurface: theme("emerald-50"), after: hex(lime), afterSurface: theme("emerald-700") },
  { name: "Start demo hover", before: theme("emerald-950"), beforeSurface: theme("emerald-50"), after: hex(lime), afterSurface: theme("emerald-800") },
  { name: "Previous / Next / Reset", before: theme("emerald-950"), beforeSurface: theme("emerald-50"), after: hex(green), afterSurface: theme("emerald-50") },
  { name: "Inactive delay / ticket links", before: theme("slate-950"), beforeSurface: theme("slate-50"), after: hex(green), afterSurface: theme("slate-50") },
  { name: "Active delay", before: theme("slate-950"), beforeSurface: theme("slate-50"), after: hex(lime), afterSurface: theme("slate-900") },
  { name: "Trip-details toggle / white cards", before: theme("slate-950"), beforeSurface: white, after: hex(green), afterSurface: white },
  { name: "Wallet dark ticket / back / empty-state buttons", before: hex("#ad5b00"), beforeSurface: white, after: hex(lime), afterSurface: hex("#184e3e") },
  { name: "Wallet checkbox / checked card", before: hex("#ad5b00"), beforeSurface: hex("#f3faf4"), after: hex(green), afterSurface: hex("#f3faf4") },
  { name: "Wallet feed link / enabled Refresh", before: hex("#ad5b00"), beforeSurface: panel, after: hex(green), afterSurface: panel },
  { name: "Wallet loading Refresh (65% opacity before)", before: fadedOld, beforeSurface: panel, after: hex(green), afterSurface: panel },
];

function assertJourneyFocus(html) {
  const controls = [...html.matchAll(/<(a|button)\b([^>]*)>/g)];
  expect(controls.length).toBeGreaterThan(0);
  for (const [, , attributes] of controls) {
    expect(attributes).toContain("focus-visible:outline-3");
    expect(attributes).toContain("focus-visible:outline-solid");
    expect(attributes).not.toContain("focus:outline-none");
    expect(attributes).toMatch(/focus-visible:outline-\[#(?:4f7a2f|d7ef95)\]/);
    if (attributes.includes("bg-slate-950") || attributes.includes("bg-emerald-700")) {
      expect(attributes).toContain("focus-visible:outline-[#d7ef95]");
      expect(attributes).toContain("focus-visible:outline-offset-[-5px]");
    }
  }
}

describe("P2-JOURNEY-FOCUS declared CSS contrast and thickness (not browser pixel evidence)", () => {
  it("uses correct reference contrast and logs reproducible before/after palette ratios", () => {
    expect(contrast(hex("#000000"), white)).toBe(21);
    console.info("Source CSS palette audit only: " + JSON.stringify(rows.map((row) => ({ control: row.name,
      before: contrast(row.before, row.beforeSurface).toFixed(2), after: contrast(row.after, row.afterSurface).toFixed(2) }))));
    expect(contrast(fadedOld, panel)).toBeLessThan(3);
  });
  it.each(rows)("keeps the proposed $name indicator at least 3:1 against its declared landing surface", (row) => {
    expect(contrast(row.after, row.afterSurface)).toBeGreaterThanOrEqual(3);
  });

  it.each(["regional-connection", "amtrak-connection", "invalid-trip"])("gives each %s Journey control an explicit solid 3px indicator", (id) => {
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={[`/journey/${id}`]}><Routes><Route path="/journey/:tripId" element={<JourneyPage />} /></Routes></MemoryRouter>);
    assertJourneyFocus(html);
  });
  it.each([false, true])("covers delay simulator active=%s with correct inset/outset placement", (isActive) => {
    const html = renderToStaticMarkup(<DelaySimulation affectedLeg={getTripById("regional-connection").legs[0]} isActive={isActive} onToggle={() => {}} />);
    assertJourneyFocus(html);
    expect(html).toContain(isActive ? "focus-visible:outline-[#d7ef95]" : "focus-visible:outline-[#4f7a2f]");
  });
  it("covers all Wallet links/buttons/checkboxes, including a focusable loading Refresh", () => {
    const html = renderToStaticMarkup(<MemoryRouter><WalletPage tripId="regional-connection" /></MemoryRouter>);
    expect(html).toContain('aria-disabled="true"');
    expect(html.match(/type="checkbox"/g)).toHaveLength(4);
    expect(walletCss).toMatch(/\.oneline-wallet :focus-visible\s*\{\s*outline:3px solid #4f7a2f;\s*outline-offset:4px;/);
    expect(walletCss).toMatch(/\.ol-button:not\(\.ol-secondary\):focus-visible\s*\{\s*outline-color:#d7ef95;\s*outline-offset:-5px;/);
    expect(walletCss).toMatch(/\.ol-button\[aria-disabled=true\]:focus-visible\s*\{\s*opacity:1;/);
  });
});
