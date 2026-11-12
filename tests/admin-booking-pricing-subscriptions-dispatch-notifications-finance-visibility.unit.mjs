import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transpileModule, ModuleKind, ScriptTarget, JsxEmit, createSourceFile, ScriptKind, isImportDeclaration, isCallExpression, isArrowFunction, isFunctionDeclaration, forEachChild } from 'typescript';

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

const wizardSource = read('src/components/booking/BookingWizard.tsx');
const wizardTree = createSourceFile('BookingWizard.tsx', wizardSource, ScriptTarget.Latest, true, ScriptKind.TSX);
function findSyntax(predicate) {
  let found;
  const visit = node => {
    if (predicate(node)) found = node;
    else forEachChild(node, visit);
  };
  visit(wizardTree);
  assert.ok(found, 'Expected booking preload integration');
  return found;
}
function runFunction(source, globals) {
  const exports = {};
  const code = transpileModule(`export const run = ${source}`, {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, ...globals });
  return exports.run;
}

function preloadEffect({ hydrated = true, pricingReady = true, view = 1 } = {}) {
  const effect = findSyntax(node => isCallExpression(node) && node.expression.getText(wizardTree) === 'useEffect' &&
    isArrowFunction(node.arguments[0]) && node.arguments[0].getText(wizardTree).includes('whenIdle(preloadDeliveryWindowsWhenIdle'));
  const frames = new Map();
  const idle = new Map();
  const requests = [];
  let sequence = 0;
  let warmCount = 0;
  const run = runFunction(effect.arguments[0].getText(wizardTree), {
    hydrated, pricingReady, view,
    window: {
      requestAnimationFrame(callback) { const id = ++sequence; frames.set(id, callback); return id; },
      cancelAnimationFrame(id) { frames.delete(id); },
    },
    whenIdle(callback, timeout) {
      requests.push(timeout);
      const id = ++sequence;
      idle.set(id, callback);
      return () => idle.delete(id);
    },
    preloadDeliveryWindowsWhenIdle() { warmCount++; },
  });
  return { frames, idle, requests, count: () => warmCount, run };
}

test('slot warming waits for hydrated Step 1 and its next render frame', () => {
  for (const state of [{ hydrated: false, view: 1 }, { hydrated: true, pricingReady: false, view: 1 }, { hydrated: true, view: 2 }, { hydrated: true, view: 4 }]) {
    const effect = preloadEffect(state);
    assert.equal(effect.run(), undefined);
    assert.equal(effect.frames.size, 0);
  }
  const effect = preloadEffect();
  effect.run();
  assert.equal(effect.count(), 0);
  assert.equal(effect.idle.size, 0);
  assert.equal(effect.frames.size, 1);
  [...effect.frames.values()][0]();
  assert.equal(effect.count(), 0);
  assert.deepEqual(effect.requests, [1500]);
  [...effect.idle.values()][0]();
  assert.equal(effect.count(), 1);
});

test('leaving Step 1 cancels queued frame and idle warming', () => {
  const beforeFrame = preloadEffect();
  const cleanupFrame = beforeFrame.run();
  cleanupFrame();
  assert.equal(beforeFrame.frames.size, 0);
  assert.equal(beforeFrame.idle.size, 0);
  const beforeIdle = preloadEffect();
  const cleanupIdle = beforeIdle.run();
  [...beforeIdle.frames.values()][0]();
  cleanupIdle();
  assert.equal(beforeIdle.idle.size, 0);
  assert.equal(beforeIdle.count(), 0);
});

test('background warming skips hidden/offline pages and recovers from a failed chunk request', async () => {
  const declaration = findSyntax(node => isFunctionDeclaration(node) && node.name?.text === 'preloadDeliveryWindows');
  let requests = 0;
  let renders = 0;
  let fail = true;
  const document = { visibilityState: 'visible' };
  const navigator = { onLine: false };
  const preload = runFunction(declaration.getText(wizardTree), {
    document, navigator,
    require(path) {
      requests++;
      assert.equal(path, '@/components/booking/TimeSlotPicker');
      if (fail) throw new Error('Chunk unavailable');
      return { default: () => { renders++; } };
    },
  });
  preload();
  navigator.onLine = true;
  document.visibilityState = 'hidden';
  preload();
  await new Promise(resolve => { setImmediate(resolve); });
  assert.equal(requests, 0);
  document.visibilityState = 'visible';
  preload();
  await new Promise(resolve => { setImmediate(resolve); });
  assert.equal(requests, 1);
  fail = false;
  preload();
  await new Promise(resolve => { setImmediate(resolve); });
  assert.equal(requests, 2);
  assert.equal(renders, 0, 'Warming must not mount a picker or freeze current availability');
});

test('idle warming respects resource hints without blocking customer intent', () => {
  const declaration = findSyntax(node => isFunctionDeclaration(node) && node.name?.text === 'preloadDeliveryWindowsWhenIdle');
  for (const hints of [
    { deviceMemory: 0.5 }, { deviceMemory: 1 }, { deviceMemory: 2 },
    { connection: { saveData: true } },
    { connection: { effectiveType: 'slow-2g' } },
    { connection: { effectiveType: '2g' } },
  ]) {
    let requests = 0;
    const warm = runFunction(declaration.getText(wizardTree), {
      navigator: hints, preloadDeliveryWindows() { requests++; },
    });
    warm();
    assert.equal(requests, 0, JSON.stringify(hints));
  }
  // Unsupported hints remain optional; re-read them each time, never cache a device policy.
  const navigator = { deviceMemory: 4, connection: { effectiveType: '4g', saveData: false } };
  let requests = 0;
  const warm = runFunction(declaration.getText(wizardTree), {
    navigator, preloadDeliveryWindows() { requests++; },
  });
  warm();
  assert.equal(requests, 1);
  navigator.connection.saveData = true;
  warm();
  assert.equal(requests, 1);
  const unknown = runFunction(declaration.getText(wizardTree), {
    navigator: {}, preloadDeliveryWindows() { requests++; },
  });
  unknown();
  assert.equal(requests, 2);
  // Focus/touch/navigation call the unrestricted loader, not the speculative policy.
  for (const event of ['onPointerEnter', 'onFocus', 'onPointerDown']) {
    assert.ok(wizardSource.includes(`${event}={view === 1 ? preloadDeliveryWindows : undefined}`));
  }
});

test('moving into Step 2 starts warming before updating navigation state', () => {
  const callback = findSyntax(node => isCallExpression(node) && node.expression.getText(wizardTree) === 'useCallback' &&
    isArrowFunction(node.arguments[0]) && node.arguments[0].getText(wizardTree).includes('setStep(clamped)'));
  const calls = [];
  const goTo = runFunction(callback.arguments[0].getText(wizardTree), {
    MAX_FORM_STEP: 3,
    preloadDeliveryWindows: () => calls.push('warm'),
    setStep: step => calls.push(step),
    setFurthest() {},
  });
  goTo(2);
  assert.deepEqual(calls, ['warm', 2]);
  calls.length = 0;
  goTo(1);
  assert.deepEqual(calls, [1]);
  for (const event of ['onPointerEnter', 'onFocus', 'onPointerDown']) {
    assert.ok(wizardSource.includes(`${event}={view === 1 ? preloadDeliveryWindows : undefined}`));
  }
});
