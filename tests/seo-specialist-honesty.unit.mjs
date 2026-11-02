import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('SEO no longer claims guaranteed live specialists or unverified reviews',()=>{
 const page=read('../src/app/(public)/technicians/page.tsx');
 assert.doesNotMatch(page,/Book verified plumbers, RO service/);
 assert.doesNotMatch(page,/Ratings, jobs done, city and skills on every profile/);
 assert.match(page,/Check current local coverage/);
});
test('dynamic service pages use concise titles and exact booking eligibility language',()=>{
 const page=read('../src/app/(public)/services/[slug]/page.tsx');
 assert.match(page,/Book in Available Areas/);
 assert.doesNotMatch(page,/title = `\$\{service\.title\} in \$\{cityNames\}/);
});
