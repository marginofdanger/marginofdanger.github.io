import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function decodeText(value) {
  return value.replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos|nbsp);/gi, (m, n, named) => {
    if (n) { const cp = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1),16) : Number(n); return cp > 0 && cp <= 0x10ffff && !(cp>=0xd800 && cp<=0xdfff) ? String.fromCodePoint(cp) : m; }
    return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[named.toLowerCase()];
  }).replace(/\s+/g,' ').trim();
}
export function pageTitle(html, filename) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  return match ? decodeText(match[1].replace(/<[^>]*>/g,'')) : filename.replace(/\.html$/i,'').replace(/[-_]+/g,' ');
}
export function pageKind(filename) { return /^yt-/i.test(filename) ? 'YouTube' : /^expert-/i.test(filename) ? 'Expert call' : 'Transcript'; }
export function collectPages(root, git = (args) => execFileSync('git', args, {cwd:root,encoding:'utf8'})) {
  const files = git(['ls-files','-z','--','reader/shares']).split('\0').filter(Boolean);
  return files.filter(file => /^reader\/shares\/[^/]+\.html$/i.test(file) && path.posix.basename(file).toLowerCase() !== 'index.html').map(file => {
    const filename=path.posix.basename(file), html=fs.readFileSync(path.join(root,file),'utf8');
    const stamp=git(['log','-1','--format=%cI','--',file]).trim();
    const date=stamp && Number.isFinite(Date.parse(stamp)) ? new Date(stamp).toISOString() : '';
    return {filename,title:pageTitle(html,filename),kind:pageKind(filename),date};
  }).sort((a,b)=> b.date.localeCompare(a.date)||a.title.localeCompare(b.title));
}
export function renderIndex(pages) {
  const rows=pages.map(p=>`<li class="entry" data-kind="${escapeHtml(p.kind)}"><a class="entry-link" href="shares/${encodeURIComponent(p.filename)}"><span class="entry-title">${escapeHtml(p.title)}</span><span class="entry-meta"><span class="badge">${escapeHtml(p.kind)}</span><span>${p.date?`Shared / updated ${escapeHtml(p.date.slice(0,10))} UTC`:'Share date unavailable'}</span><span class="arrow" aria-hidden="true">&#8599;</span></span></a></li>`).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Shared Reader Library | Margin of Danger</title><style>
*{box-sizing:border-box}body{margin:0;background:#f8f7f4;color:#20242a;font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:940px;margin:auto;padding:36px 24px 64px}a{color:inherit}.back{font-size:12px;text-decoration:none;color:#666}.eyebrow{margin:30px 0 5px;text-transform:uppercase;letter-spacing:.14em;font-size:11px;color:#85734d}h1{font:600 32px/1.2 Georgia,serif;letter-spacing:-.5px;margin:0 0 12px}.intro{color:#666;max-width:670px;margin:0 0 24px;font-size:13px}.controls{display:flex;gap:10px;margin:0 0 12px}input,select{font:inherit;border:1px solid #d8d7d2;border-radius:7px;padding:10px 12px;background:white;color:#20242a}input{min-width:0;flex:1}select{max-width:180px}input:focus,select:focus,a:focus-visible{outline:2px solid #8a7142;outline-offset:3px}.count{color:#777;font-size:12px;margin:0 0 10px}ul{list-style:none;margin:0;padding:0;border:1px solid #deddd7;border-radius:9px;background:white;overflow:hidden}.entry+.entry{border-top:1px solid #ecebe6}.entry-link{display:block;text-decoration:none;padding:15px 18px}.entry-link:hover{background:#f5f2eb}.entry-title{font-weight:600;font-size:15px}.entry-meta{display:flex;align-items:center;gap:12px;color:#777;font-size:11px;margin-top:6px}.badge{color:#6a5836;background:#f2eee5;border-radius:4px;padding:2px 6px}.arrow{margin-left:auto;color:#8a7142;font-size:18px}.empty{padding:20px;color:#777;font-size:13px}.note{font-size:11px;color:#888;margin-top:18px}[hidden]{display:none!important}@media(max-width:480px){main{padding:24px 16px}h1{font-size:28px}.controls{flex-direction:column}select{max-width:none}.entry-link{padding:13px}.entry-title{font-size:14px}.entry-meta{gap:7px;flex-wrap:wrap}}
</style></head><body><main><a class="back" href="../">&#8592; Margin of Danger</a><p class="eyebrow">Reader / shared archive</p><h1>Shared Reader Library</h1><p class="intro">The pages you chose to share from Reader, in one place. New shares appear after the site finishes publishing. Your unshared local library and highlights are not included.</p><div class="controls"><label for="search" hidden>Search shared pages</label><input id="search" type="search" placeholder="Search titles" autocomplete="off" aria-label="Search shared titles"><select id="kind" aria-label="Filter by type"><option value="">All types</option><option>YouTube</option><option>Expert call</option><option>Transcript</option></select></div><p id="count" class="count" aria-live="polite">${pages.length} shared pages</p><ul id="pages">${rows}</ul><p id="empty" class="empty" ${pages.length?'hidden':''}>No matching shared pages.</p><p class="note">Dates reflect the most recent saved share in the publishing repository, not the date of the underlying call or article. This index uses the site's existing password protection.</p></main><script>
(()=>{const search=document.getElementById('search'),kind=document.getElementById('kind'),rows=[...document.querySelectorAll('.entry')];function filter(){const q=search.value.trim().toLowerCase();let n=0;for(const row of rows){const show=(!kind.value||row.dataset.kind===kind.value)&&row.querySelector('.entry-title').textContent.toLowerCase().includes(q);row.hidden=!show;if(show)n++;}document.getElementById('count').textContent=n+' of '+rows.length+' shared pages';document.getElementById('empty').hidden=n!==0;}search.addEventListener('input',filter);kind.addEventListener('change',filter);})();
</script></body></html>`;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
 const root=process.cwd(), pages=collectPages(root), target=path.join(root,'reader','index.html');
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,renderIndex(pages),'utf8');
 console.log('Built encrypted-deployment Reader index: '+pages.length+' already-shared pages');
}
