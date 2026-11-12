import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url));

test("extension download page reconstructs the complete verified ZIP", () => {
  const parts = Array.from({ length: 24 }, (_, index) => read(`downloads/dashboard/0.13.34/parts/extension-0.13.34.part${index + 1}`));
  assert.deepEqual(parts.map(part => part.length), [...Array(23).fill(400000), 160081]);
  const archive = Buffer.concat(parts);
  assert.equal(archive.length, 9360081);
  assert.equal(crypto.createHash("sha256").update(archive).digest("hex").toUpperCase(), "AB5FBAD939C744A4FEDE5A40B241136B95FF78208A8D19A7C70AA7C091BB0F1F");
  assert.equal(archive.subarray(0, 2).toString("ascii"), "PK");
});

test("dashboard routes the download button through the verified assembler", () => {
  const html = read("audit-review.html").toString("utf8");
  const script = read("audit-review.js").toString("utf8");
  const downloader = read("download-extension.html").toString("utf8");
  assert.match(html, /href="download-extension\.html"/);
  assert.match(script, /link\.href="download-extension\.html"/);
  assert.match(downloader, /crypto\.subtle\.digest\("SHA-256",merged\)/);
  assert.match(downloader, /bytes\.byteLength!==PARTS\[index\]\.size/);
  assert.match(downloader, /const EXPECTED_SIZE=9360081/);
  assert.match(downloader, /downloads\/dashboard\/0\.13\.34\/parts\/extension-0\.13\.34\.part/);
});

