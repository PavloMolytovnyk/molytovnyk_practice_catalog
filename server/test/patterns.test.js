import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeliveryPriceCalculator, DeliveryPricingStrategy } from '../src/patterns/delivery-strategies.js';
import { OrderWorkflow } from '../src/patterns/order-states.js';

const calculator = new DeliveryPriceCalculator();
const conflict = (error) => error.status === 409 && error.code === 'INVALID_TRANSITION';
const unfinished = ['Нове', 'Підтверджене', 'Комплектується', 'Відправлене'];
const allStates = [...unfinished, 'Виконане', 'Скасоване'];

test('Strategy: Nova Poshta uses the tariff below the exact free-delivery boundary', () => {
  assert.equal(calculator.calculateCents('Нова пошта', { subtotalCents: 249999, basePriceCents: 12000 }), 12000);
  for (const subtotalCents of [250000, 250001]) {
    assert.equal(calculator.calculateCents('Нова пошта', { subtotalCents, basePriceCents: 12000 }), 0);
  }
});

test('Strategy: courier keeps the database tariff even for an expensive basket', () => {
  for (const basePriceCents of [0, 16000, 19950]) {
    for (const subtotalCents of [0, 249999, 250000, 999999]) {
      assert.equal(calculator.calculateCents('Кур’єр', { subtotalCents, basePriceCents }), basePriceCents);
    }
  }
});

test('Strategy: a calculator accepts an independent pricing implementation', () => {
  class PickupStrategy extends DeliveryPricingStrategy {
    calculateCents() { return 0; }
  }
  const custom = new DeliveryPriceCalculator(new Map([['Самовивіз', new PickupStrategy()]]));
  assert.equal(custom.calculateCents('Самовивіз', { subtotalCents: 100, basePriceCents: 999 }), 0);
  assert.throws(() => calculator.calculateCents('Самовивіз', { subtotalCents: 100, basePriceCents: 999 }), RangeError);
});

test('Strategy: invalid money, unknown methods and invalid results are rejected', () => {
  for (const value of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '100', undefined]) {
    assert.throws(() => calculator.calculateCents('Кур’єр', { subtotalCents: value, basePriceCents: 100 }), RangeError);
    assert.throws(() => calculator.calculateCents('Кур’єр', { subtotalCents: 100, basePriceCents: value }), RangeError);
  }
  assert.throws(() => calculator.calculateCents('missing', { subtotalCents: 100, basePriceCents: 100 }), RangeError);
  const custom = new DeliveryPriceCalculator(new Map([['bad', { calculateCents: () => -1 }]]));
  assert.throws(() => custom.calculateCents('bad', { subtotalCents: 100, basePriceCents: 100 }), RangeError);
});

test('State: the full fulfillment path ends in a terminal state', () => {
  const flow = new OrderWorkflow();
  for (const status of ['Підтверджене', 'Комплектується', 'Відправлене']) {
    assert.equal(flow.transitionTo(status).inventoryMovement, null);
    assert.equal(flow.status, status);
  }
  assert.equal(flow.transitionTo('Виконане').inventoryMovement, 'FULFILL');
  assert.throws(() => flow.transitionTo('Виконане'), conflict);
  assert.equal(flow.status, 'Виконане');
});

test('State: every unfinished state can cancel and release its reservation', () => {
  for (const status of unfinished) {
    const flow = new OrderWorkflow(status);
    assert.equal(flow.transitionTo('Скасоване').inventoryMovement, 'RELEASE');
    assert.equal(flow.status, 'Скасоване');
    assert.throws(() => flow.transitionTo('Скасоване'), conflict);
  }
});

test('State: all 28 forbidden state pairs reject without changing the context', () => {
  const allowed = new Map([
    ['Нове', ['Підтверджене', 'Скасоване']],
    ['Підтверджене', ['Комплектується', 'Скасоване']],
    ['Комплектується', ['Відправлене', 'Скасоване']],
    ['Відправлене', ['Виконане', 'Скасоване']],
    ['Виконане', []], ['Скасоване', []],
  ]);
  let rejected = 0;
  for (const from of allStates) for (const to of allStates) {
    if (allowed.get(from).includes(to)) continue;
    const flow = new OrderWorkflow(from);
    const original = flow.state;
    assert.throws(() => flow.transitionTo(to), conflict, `${from} -> ${to}`);
    assert.equal(flow.state, original);
    assert.equal(flow.status, from);
    rejected++;
  }
  assert.equal(rejected, 28);
});

test('State: persisted states can be rehydrated and unknown statuses are rejected', () => {
  for (const status of allStates) assert.equal(new OrderWorkflow(status).status, status);
  assert.throws(() => new OrderWorkflow('missing'), conflict);
  const flow = new OrderWorkflow();
  assert.throws(() => flow.transitionTo('missing'), conflict);
  assert.equal(flow.status, 'Нове');
});
