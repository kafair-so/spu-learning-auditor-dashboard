import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url));

test("extension download page reconstructs the complete verified ZIP", () => {
  const parts = Array.from({ length: 24 }, (_, index) => read(`extension-0.13.30.part${index + 1}`));
  assert.deepEqual(parts.map(part => part.length), [...Array(23).fill(400000), 153971]);
  const archive = Buffer.concat(parts);
  assert.equal(archive.length, 9353971);
  assert.equal(crypto.createHash("sha256").update(archive).digest("hex").toUpperCase(), "321265EFEF62BB8345F28F3DB92510957634A14EA3391B573D16ABB949E0EC24");
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
  assert.match(downloader, /const EXPECTED_SIZE=9353971/);
});

