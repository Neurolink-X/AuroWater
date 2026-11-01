import test from 'node:test';
import assert from 'node:assert/strict';
import {pricingChanges,pricingFaqs,pricingValue} from '../src/lib/pricing/presentation.ts';
import {resolveEffectivePriceBook} from '../src/lib/pricing/resolve-effective.ts';
test('history includes fee tax service city changes and removed overrides',()=>{
 const before={convenience_fee:10,gst_rate:0,city_overrides:{noida:{delivery_fee:20}}};
 const after={convenience_fee:20,gst_rate:0.18,services:{plumbing:199}};
 const changes=pricingChanges(before,after);
 assert.equal(changes.find(c=>c.field==='convenience_fee').after,20);
 assert.equal(changes.find(c=>c.field==='city_overrides.noida.delivery_fee').after,'Not set / inherits global');
 assert.equal(pricingValue('gst_rate',0.18),'18%');
 assert.equal(before.convenience_fee,10);
});
test('FAQ uses current rates and fees without fictitious price locks',()=>{
 const faq=pricingFaqs({default_can_price:25,chilled_can_price:30,subscription_can_price:20,convenience_fee:20,delivery_fee:20,gst_rate:0.18,service_base_prices:{plumbing:199,tank_cleaning:799}});
 assert.match(faq[0].a,/₹25/);assert.match(faq[0].a,/18%/);assert.match(faq[3].a,/₹199/);
 assert.doesNotMatch(faq.map(f=>f.a).join(' '),/Delivery is included|lock.*months/);
});
test('city overrides preserve explicit zero fees and inherit global service changes',()=>{
 const input={water_normal:25,convenience_fee:20,services:{plumbing:199},city_overrides:{noida:{convenience_fee:0,services:{tank_cleaning:899}}}};
 const noida=resolveEffectivePriceBook(input,'Noida');
 assert.equal(noida.convenience_fee,0);assert.equal(noida.services.plumbing,199);assert.equal(noida.services.tank_cleaning,899);
 assert.equal(resolveEffectivePriceBook(input,'Kanpur').convenience_fee,20);
 assert.equal(input.services.plumbing,199);
});
