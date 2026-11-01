import test from 'node:test';
import assert from 'node:assert/strict';
import {pricingIsVerified} from '../src/lib/pricing/readiness.ts';
import {pricingLabel,pricingEntries,pricingChanges} from '../src/lib/pricing/presentation.ts';
test('default and cached prices cannot become verified before a live response',()=>{
 assert.equal(pricingIsVerified(null,null),false);
 assert.equal(pricingIsVerified(8,null),false);
 assert.equal(pricingIsVerified(8,'global'),true);
 assert.equal(pricingIsVerified(8,'global','Noida'),false);
 assert.equal(pricingIsVerified(8,'noida',' Noida '),true);
 assert.equal(pricingIsVerified(8,'kanpur','Noida'),false);
});
test('history exposes non-water changes and the complete service book',()=>{
 const before={water_normal:25,services:{plumbing:149,tank_cleaning:599}};
 const after={water_normal:25,services:{plumbing:199,tank_cleaning:799},city_overrides:{noida:{delivery_fee:0}}};
 assert.deepEqual(pricingChanges(before,after).map(x=>x.field),['city_overrides.noida.delivery_fee','services.plumbing','services.tank_cleaning']);
 assert.equal(pricingLabel('services.tank_cleaning'),'Tank Cleaning');
 assert.equal(pricingLabel('city_overrides.noida.delivery_fee'),'Noida → Delivery Fee');
 assert.ok(pricingEntries(after).some(x=>x.field==='services.plumbing'&&x.value===199));
});
