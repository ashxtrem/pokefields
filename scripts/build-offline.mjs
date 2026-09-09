import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
// Cache each production release atomically; old tabs keep their matching assets.
// Do not precache /index.html: Cloudflare Pages 308s it to /, and browsers
// refuse to replay a redirected response for navigations (ERR_FAILED).
const assets = (await readdir("dist/assets")).map((name) => "/assets/" + name);
const files = ["/", "/data/catalog.json", ...assets];
const hash = createHash("sha256");
hash.update("v2-no-redirected-index");
hash.update(await readFile("dist/index.html"));
for (const path of files.filter((p) => p !== "/"))
  hash.update(await readFile("dist" + path));
const version = "fieldnotes-" + hash.digest("hex").slice(0, 12);
await writeFile(
  "dist/sw.js",
  `
const CACHE=${JSON.stringify(version)};
const FILES=${JSON.stringify(files)};
function copy(response){
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers:response.headers});
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await Promise.all(FILES.map(async path=>{
  const response=await fetch(path);
  if(!response.ok) throw new Error('Failed to cache '+path);
  await cache.put(path,copy(response));
 }));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('fieldnotes-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const cached=await cache.match(request.mode==='navigate'?'/':request);
  if(cached) return cached.redirected?copy(cached):cached;
  return fetch(request);
 })());
});
`,
);
console.log("Offline app shell:", version);
