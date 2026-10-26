// Prices are integer kopecks. Tariffs come from delivery_methods, not the UI.
export class DeliveryPricingStrategy {
  calculateCents(_context) {
    throw new Error('Delivery strategy must implement calculateCents');
  }
}

export class NovaPoshtaDeliveryStrategy extends DeliveryPricingStrategy {
  calculateCents({ subtotalCents, basePriceCents }) {
    return subtotalCents >= 250000 ? 0 : basePriceCents;
  }
}

export class CourierDeliveryStrategy extends DeliveryPricingStrategy {
  calculateCents({ basePriceCents }) {
    return basePriceCents;
  }
}

const isMoney = (value) => Number.isSafeInteger(value) && value >= 0;

export class DeliveryPriceCalculator {
  constructor(strategies = new Map([
    ['Нова пошта', new NovaPoshtaDeliveryStrategy()],
    ['Кур’єр', new CourierDeliveryStrategy()],
  ])) {
    this.strategies = new Map(strategies);
  }

  calculateCents(method, context) {
    if (!isMoney(context?.subtotalCents) || !isMoney(context?.basePriceCents)) {
      throw new RangeError('Delivery amounts must be non-negative safe integer kopecks');
    }
    const strategy = this.strategies.get(method);
    if (!strategy) throw new RangeError('Unknown delivery pricing strategy');
    const result = strategy.calculateCents(context);
    if (!isMoney(result)) throw new RangeError('Delivery strategy returned an invalid amount');
    return result;
  }
}

export const deliveryPriceCalculator = new DeliveryPriceCalculator();
