import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
// Cache each production release atomically; old tabs keep their matching assets.
const assets = (await readdir("dist/assets")).map((name) => "/assets/" + name);
const files = ["/", "/index.html", "/data/catalog.json", ...assets];
const hash = createHash("sha256");
for (const path of files.filter((p) => p !== "/"))
  hash.update(await readFile("dist" + path));
const version = "fieldnotes-" + hash.digest("hex").slice(0, 12);
await writeFile(
  "dist/sw.js",
  `
const CACHE=${JSON.stringify(version)};
const FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('fieldnotes-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const cached=await cache.match(request.mode==='navigate'?'/index.html':request);
  if(cached)return cached;
  return fetch(request);
 }));
});
`,
);
console.log("Offline app shell:", version);
