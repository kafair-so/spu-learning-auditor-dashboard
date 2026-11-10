import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url));

test("extension download page reconstructs the complete verified ZIP", () => {
  const first = read("extension-0.13.28.part1");
  const second = read("extension-0.13.28.part2");
  assert.equal(first.length, 4500000);
  assert.equal(second.length, 4853370);
  const archive = Buffer.concat([first, second]);
  assert.equal(archive.length, 9353370);
  assert.equal(crypto.createHash("sha256").update(archive).digest("hex").toUpperCase(), "B03D7BE26D727099158BB044B3A5AB951A8B42D6C1BCC93102BCABAED291CD81");
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
});

