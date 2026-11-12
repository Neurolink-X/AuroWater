import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transpileModule, ModuleKind, ScriptTarget, JsxEmit, createSourceFile, ScriptKind, isImportDeclaration } from 'typescript';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function loadComponent(path, dependencies) {
  const exports = {};
  const code = transpileModule(read(path), {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022, jsx: JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require: id => Object.hasOwn(dependencies, id) ? dependencies[id] : require(id) });
  return exports;
}

const palette = {
  'emerald-50': '#ecfdf5', 'emerald-800': '#065f46', 'emerald-900': '#064e3b',
  'emerald-950': '#022c22', 'cyan-800': '#155e75',
};
const luminance = hex => {
  const channels = hex.slice(1).match(/../g).map(channel => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (foreground, background) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

for (const role of ['customer', 'seller', 'agent']) {
  test(`${role} confirmation renders readable contact and locality details on its own opaque surface`, () => {
    let stateIndex = 0;
    const states = [{ phone: '9876543210', area: 'Thiruvananthapuram', pincode: '695001' }, false, true, ''];
    const { default: Panel } = loadComponent('src/components/ui/WaitlistPanel.tsx', {
      react: { ...React, useState: () => [states[stateIndex++], () => {}], useRef: () => ({ current: null }), useEffect() {} },
      '@/lib/waitlist-client': {}, '@/lib/cities': {},
    });
    const html = renderToStaticMarkup(React.createElement(Panel, {
      cityName: 'Thiruvananthapuram', cityId: null, role, onClose() {},
    }));
    assert.match(html, /role="status"/);
    assert.match(html, /bg-emerald-50/);
    assert.match(html, /9876543210/);
    assert.match(html, /Thiruvananthapuram/);
    assert.match(html, /PIN code:.*695001/);
    assert.match(html, /break-words/);
    assert.match(html, /Go back/);
    assert.doesNotMatch(html, /text-white|text-slate-[234]00|bg-emerald-400\/10/);
    const colors = [...html.matchAll(/(?:^|\s)text-((?:emerald|cyan)-\d+)/g)].map(match => match[1]);
    assert.ok(colors.length >= 5);
    for (const color of colors) {
      assert.ok(palette[color], `Unknown confirmation color ${color}`);
      assert.ok(contrast(palette[color], palette['emerald-50']) >= 4.5, `${color} lacks text contrast`);
    }
  });
}

function descendants(element) {
  if (!React.isValidElement(element)) return [];
  return [element, ...React.Children.toArray(element.props.children).flatMap(descendants)];
}

test('changing waitlist city gets a fresh form and cannot relabel an old success receipt', () => {
  let city = '';
  const DeferredPanel = () => null;
  const { default: Waitlist } = loadComponent('src/components/booking/BookingWaitlist.tsx', {
    react: { ...React, useState: () => [city, value => { city = value; }] },
    'next/dynamic': { default: () => DeferredPanel },
  });
  const initial = descendants(Waitlist());
  assert.equal(initial.some(element => element.type === DeferredPanel), false);
  initial.find(element => element.type === 'input').props.onChange({ target: { value: ' Kolkata ' } });
  const first = descendants(Waitlist()).find(element => element.type === DeferredPanel);
  assert.equal(first.props.cityName, 'Kolkata');
  assert.equal(first.props.source, 'book');
  descendants(Waitlist()).find(element => element.type === 'input').props.onChange({ target: { value: 'Kerala' } });
  const second = descendants(Waitlist()).find(element => element.type === DeferredPanel);
  assert.equal(second.props.cityName, 'Kerala');
  assert.notEqual(first.key, second.key);
});

test('booking does not eagerly import waitlist submission or delivery-window UI', () => {
  const wizard = read('src/components/booking/BookingWizard.tsx');
  const ast = createSourceFile('BookingWizard.tsx', wizard, ScriptTarget.Latest, true, ScriptKind.TSX);
  const runtimeImports = ast.statements.filter(statement => isImportDeclaration(statement) && !statement.importClause?.isTypeOnly)
    .map(statement => statement.moduleSpecifier.text);
  assert.ok(!runtimeImports.includes('@/components/ui/WaitlistPanel'));
  assert.ok(!runtimeImports.includes('@/components/booking/TimeSlotPicker'));
  assert.match(wizard, /dynamic\(\(\) => import\('@\/components\/booking\/TimeSlotPicker'\)/);
  const waitlist = read('src/components/booking/BookingWaitlist.tsx');
  assert.match(waitlist, /dynamic\(\(\) => import\('@\/components\/ui\/WaitlistPanel'\)/);
  const activeWizard = wizard.split('\n').filter(line => !line.trimStart().startsWith('//')).join('\n');
  assert.doesNotMatch(activeWizard, /\[waitlistCity, setWaitlistCity\]/);
});

test('checkout callbacks and validation remain wired after splitting optional UI', () => {
  const wizard = read('src/components/booking/BookingWizard.tsx');
  assert.match(wizard, /<TimeSlotPicker[\s\S]*?onChange=\{onSlotChange\}/);
  assert.match(wizard, /customerOrderCreate\(/);
  assert.match(wizard, /if \(settings\.maintenance_mode\)/);
  assert.match(wizard, /customerServiceability\(draft\.addressId!, draft\.serviceKey\)/);
  assert.match(wizard, /selectedReferralRewardId/);
  assert.match(wizard, /selectedLoyaltyReward/);
  const active = wizard.split('\n').filter(line => !line.trimStart().startsWith('//')).join('\n');
  const keyframes = /@keyframes bk-in\{(.+?)\}\.bk-in/.exec(active)?.[1];
  assert.ok(keyframes);
  assert.doesNotMatch(keyframes, /opacity/);
});
