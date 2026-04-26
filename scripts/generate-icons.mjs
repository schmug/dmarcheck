/**
 * Generates favicon binary assets (ICO, PNG) from the adaptive SVG,
 * plus the Open Graph PNG served at /og-image.png and the 1280×640
 * PNG uploaded manually to GitHub's "Social preview" setting.
 *
 * For raster formats, a dark rounded-rect background is added since
 * PNG/ICO can't support CSS prefers-color-scheme.
 *
 * Usage: node scripts/generate-icons.mjs
 * Output:
 *   - Prints base64 constants to paste into src/views/favicon.ts.
 *   - Writes docs/github-social-preview.png (commit this; upload to
 *     GitHub → Settings → General → Social preview).
 */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// SVG with dark background for raster formats (PNG/ICO)
const rasterSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="16" fill="#0a0a0f"/>
  <text x="50" y="82" font-family="monospace" font-size="90" fill="#f97316" text-anchor="middle">@</text>
  <circle cx="37" cy="38" r="10" fill="white" stroke="#f97316" stroke-width="2.5"/>
  <circle cx="61" cy="38" r="10" fill="white" stroke="#f97316" stroke-width="2.5"/>
  <circle cx="38" cy="39" r="5" fill="#0a0a0f"/>
  <circle cx="62" cy="39" r="5" fill="#0a0a0f"/>
</svg>`;

const svgBuffer = Buffer.from(rasterSvg);

// Open Graph card — kept in sync with the /og-image.svg handler in src/index.ts.
// Intrinsic size 1200×630 matches the OG spec's preferred 1.91:1 aspect ratio.
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0a0a0f"/>
  <text x="340" y="310" font-family="monospace" font-size="180" fill="#f97316" text-anchor="middle">@</text>
  <circle cx="300" cy="220" r="22" fill="white"/>
  <circle cx="375" cy="220" r="22" fill="white"/>
  <circle cx="305" cy="226" r="11" fill="#0a0a0f"/>
  <circle cx="380" cy="226" r="11" fill="#0a0a0f"/>
  <rect x="290" y="370" width="16" height="32" rx="6" fill="#ea580c"/>
  <rect x="330" y="370" width="16" height="26" rx="6" fill="#ea580c"/>
  <rect x="370" y="370" width="16" height="32" rx="6" fill="#ea580c"/>
  <text x="500" y="300" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" font-weight="800" font-size="72">
    <tspan fill="#e4e4e7">dmar</tspan><tspan fill="#f97316">check</tspan>
  </text>
  <text x="500" y="350" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" font-size="24" fill="#71717a">DNS Email Security Analyzer</text>
  <text x="500" y="400" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" font-size="18" fill="#f97316">Meet DMarcus — your email security sidekick</text>
</svg>`;

const ogSvgBuffer = Buffer.from(ogSvg);

/**
 * Build a minimal ICO file from PNG buffers.
 * ICO format: 6-byte header + 16-byte directory entry per image + PNG data.
 */
function buildIco(pngBuffers) {
  const numImages = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * numImages;

  // Calculate offsets
  let dataOffset = headerSize + dirSize;
  const entries = pngBuffers.map((png, i) => {
    const offset = dataOffset;
    dataOffset += png.length;
    return { png, offset };
  });

  const totalSize = dataOffset;
  const buf = Buffer.alloc(totalSize);

  // ICO header: reserved(2) + type=1(2) + count(2)
  buf.writeUInt16LE(0, 0); // reserved
  buf.writeUInt16LE(1, 2); // type: 1 = ICO
  buf.writeUInt16LE(numImages, 4); // image count

  // Directory entries
  entries.forEach(({ png, offset }, i) => {
    const size = i === 0 ? 16 : 32; // first is 16px, second is 32px
    const pos = headerSize + i * dirEntrySize;
    buf.writeUInt8(size === 256 ? 0 : size, pos); // width (0 = 256)
    buf.writeUInt8(size === 256 ? 0 : size, pos + 1); // height
    buf.writeUInt8(0, pos + 2); // color palette
    buf.writeUInt8(0, pos + 3); // reserved
    buf.writeUInt16LE(1, pos + 4); // color planes
    buf.writeUInt16LE(32, pos + 6); // bits per pixel
    buf.writeUInt32LE(png.length, pos + 8); // image size
    buf.writeUInt32LE(offset, pos + 12); // data offset
  });

  // Image data
  entries.forEach(({ png, offset }) => {
    png.copy(buf, offset);
  });

  return buf;
}

async function generate() {
  console.log("Generating icon assets from SVG...\n");

  // Generate PNGs at various sizes
  const [png16, png32, png180, png192, png512, ogPng1200, ogPng1280] =
    await Promise.all([
      sharp(svgBuffer).resize(16, 16).png().toBuffer(),
      sharp(svgBuffer).resize(32, 32).png().toBuffer(),
      sharp(svgBuffer).resize(180, 180).png().toBuffer(),
      sharp(svgBuffer).resize(192, 192).png().toBuffer(),
      sharp(svgBuffer).resize(512, 512).png().toBuffer(),
      // OG card served by the Worker at /og-image.png (1200×630 = native viewBox).
      sharp(ogSvgBuffer, { density: 288 })
        .resize(1200, 630)
        .png()
        .toBuffer(),
      // GitHub Social preview — 1280×640 (2:1), letterboxed from the 1200×630
      // source so text positions and aspect ratio stay intact.
      sharp(ogSvgBuffer, { density: 288 })
        .resize(1280, 640, { fit: "contain", background: "#0a0a0f" })
        .png()
        .toBuffer(),
    ]);

  // Build ICO from 16x16 and 32x32
  const ico = buildIco([png16, png32]);

  // Output base64 constants
  console.log("// Paste these into src/views/favicon.ts\n");
  console.log(
    `export const FAVICON_ICO_BASE64 = "${ico.toString("base64")}";\n`,
  );
  console.log(
    `export const APPLE_TOUCH_ICON_BASE64 = "${png180.toString("base64")}";\n`,
  );
  console.log(
    `export const ICON_192_BASE64 = "${png192.toString("base64")}";\n`,
  );
  console.log(
    `export const ICON_512_BASE64 = "${png512.toString("base64")}";\n`,
  );
  console.log(
    `export const OG_IMAGE_PNG_BASE64 = "${ogPng1200.toString("base64")}";\n`,
  );

  // Write the GitHub Social preview PNG to disk so it can be committed and
  // uploaded manually (GitHub's social preview field has no API).
  const githubPreviewPath = resolve(repoRoot, "docs/github-social-preview.png");
  writeFileSync(githubPreviewPath, ogPng1280);

  // Size report
  console.log("// Size report:");
  console.log(`//   ICO (16+32): ${ico.length} bytes`);
  console.log(`//   180x180 PNG: ${png180.length} bytes`);
  console.log(`//   192x192 PNG: ${png192.length} bytes`);
  console.log(`//   512x512 PNG: ${png512.length} bytes`);
  console.log(`//   1200x630 OG PNG: ${ogPng1200.length} bytes`);
  console.log(`//   1280x640 GitHub preview: ${ogPng1280.length} bytes`);
  console.log(
    `//   Total base64 (favicon.ts): ~${Math.round(((ico.length + png180.length + png192.length + png512.length + ogPng1200.length) * 4) / 3 / 1024)}KB`,
  );
  console.log(`//   Wrote: ${githubPreviewPath}`);
}

generate().catch(console.error);
