import { HttpError } from '../errors.js';

const invalidTransition = () => {
  throw new HttpError(409, 'Недозволена зміна статусу.', 'INVALID_TRANSITION');
};

export class OrderState {
  get inventoryMovement() { return null; }
  confirm() { return invalidTransition(); }
  pack() { return invalidTransition(); }
  ship() { return invalidTransition(); }
  complete() { return invalidTransition(); }
  cancel() { return invalidTransition(); }
}

export class CancelableOrderState extends OrderState {
  cancel() { return new CancelledOrderState(); }
}

export class NewOrderState extends CancelableOrderState {
  status = 'Нове';
  confirm() { return new ConfirmedOrderState(); }
}

export class ConfirmedOrderState extends CancelableOrderState {
  status = 'Підтверджене';
  pack() { return new PackingOrderState(); }
}

export class PackingOrderState extends CancelableOrderState {
  status = 'Комплектується';
  ship() { return new ShippedOrderState(); }
}

export class ShippedOrderState extends CancelableOrderState {
  status = 'Відправлене';
  complete() { return new CompletedOrderState(); }
}

export class CompletedOrderState extends OrderState {
  status = 'Виконане';
  get inventoryMovement() { return 'FULFILL'; }
}

export class CancelledOrderState extends OrderState {
  status = 'Скасоване';
  get inventoryMovement() { return 'RELEASE'; }
}

const states = new Map([
  ['Нове', NewOrderState], ['Підтверджене', ConfirmedOrderState],
  ['Комплектується', PackingOrderState], ['Відправлене', ShippedOrderState],
  ['Виконане', CompletedOrderState], ['Скасоване', CancelledOrderState],
]);
const actions = new Map([
  ['Підтверджене', 'confirm'], ['Комплектується', 'pack'],
  ['Відправлене', 'ship'], ['Виконане', 'complete'], ['Скасоване', 'cancel'],
]);

export class OrderWorkflow {
  constructor(status = 'Нове') {
    const State = states.get(status);
    if (!State) invalidTransition();
    this.state = new State();
  }

  get status() { return this.state.status; }

  transitionTo(status) {
    const action = actions.get(status);
    if (!action) invalidTransition();
    // A rejected action throws before the context changes.
    const nextState = this.state[action]();
    this.state = nextState;
    return nextState;
  }
}
