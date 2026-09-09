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
const IMAGES='fieldnotes-images';
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('fieldnotes-')&&k!==CACHE&&k!==IMAGES).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin===self.location.origin){
  if(url.pathname.startsWith('/images/')){
   event.respondWith((async()=>{
    const cache=await caches.open(IMAGES);
    const cached=await cache.match(request);
    if(cached) return cached;
    const response=await fetch(request);
    if(response.ok) cache.put(request,response.clone());
    return response;
   })());
   return;
  }
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   const cached=await cache.match(request.mode==='navigate'?'/':request);
   if(cached) return cached.redirected?copy(cached):cached;
   return fetch(request);
  })());
  return;
 }
 if(request.destination!=='image')return;
 if(!/(^|\\.)(pokopiapi\\.com|serebii\\.net|githubusercontent\\.com|jsdelivr\\.net)$/.test(url.hostname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(IMAGES);
  const cached=await cache.match(request);
  if(cached) return cached;
  const response=await fetch(request);
  if(response.ok||response.type==='opaque') cache.put(request,response.clone());
  return response;
 })());
});
`,
);
console.log("Offline app shell:", version);
