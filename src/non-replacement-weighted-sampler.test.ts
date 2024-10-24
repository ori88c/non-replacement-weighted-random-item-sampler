/**
 * Copyright 2024 Ori Cohen https://github.com/ori88c
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { NonReplacementWeightedSampler } from './non-replacement-weighted-sampler';

function testReasonableSamplesOrder(): boolean {
  // Testing both proportionality and randomness is not straightforward, as weighted random sampling
  // does not guarantee a fixed order, even though there is a weight affinity.
  // To mitigate the influence of randomness, we use items with *significant weight differences*,
  // increasing the likelihood of sampling items in an almost strictly descending order, based on their weights.
      
  // Arrange.
  const maxWeight = 100 * 1000 * 1000;
  const itemToWeight = new Map<string, number>();
  for (let currWeight = maxWeight; currWeight > 1; currWeight /= 2) {
    itemToWeight.set(`unique_item_${currWeight}`, currWeight);
  }

  const items = Array.from(itemToWeight.keys());
  const respectiveWeights = Array.from(itemToWeight.values());
  const sampler = new NonReplacementWeightedSampler(items, respectiveWeights);

  const maxReasonableNonDescendingValues = 2 * Math.ceil(Math.log2(items.length));
  const sampledItemsInOrder: string[] = [];

  // Act.
  while (!sampler.isEmpty) {
    sampledItemsInOrder.push(sampler.sample());
  }

  // Assert.
  expect(sampler.remainedItems).toBe(0);
  let nonStrictlyDescendingItemsCounter = 0;
  for (let i = 1; i < sampledItemsInOrder.length; ++i) {
    const currWeight = itemToWeight.get(sampledItemsInOrder[i]);
    const prevWeight = itemToWeight.get(sampledItemsInOrder[i-1]);
    if (currWeight > prevWeight) {
      ++nonStrictlyDescendingItemsCounter;
    }
  }

  // Due to the significant weight differences, we expect a low amount of "misplaced" items.
  // Returning true if the number of non-strictly-descending items is within a reasonable limit.
  return nonStrictlyDescendingItemsCounter <= maxReasonableNonDescendingValues;
}

function testLogarithmicComplexity(
  samplesCount: number,
  sampleWeight: () => number,
  maxReasonableRestructureAttempts: number
): void {
  // Arrange.
  const respectiveWeights = new Array<number>(samplesCount)
    .fill(0)
    .map(_ => sampleWeight());
  // Using weights as items for simplicity, with each item equal to its corresponding weight.
  const items = respectiveWeights.map((_, index) => `item_${index}`);
  const sampler = new NonReplacementWeightedSampler<string>(items, respectiveWeights);

  // Act.
  let expectedRemainedItemsCount = items.length;
  const previouslySampledItems = new Set<string>();
  do {
    expect(sampler.remainedItems).toBe(expectedRemainedItemsCount);
    const item = sampler.sample();
    expect(previouslySampledItems.has(item)).toBe(false);
    previouslySampledItems.add(item);
  } while (--expectedRemainedItemsCount > 0);

  expect(sampler.restructureAttempts).toBeLessThanOrEqual(maxReasonableRestructureAttempts);
}

describe('NonReplacementWeightedSampler tests', () => {
  describe('Happy path tests', () => {
    test(
      'validating that remaining items are sampled proportionally to their weights, ' +
      'allowing for some error due to randomness', async () => {
      const repetitionsCount = 36;
      let successCounter = 0;
      for (let attempt = 0; attempt < repetitionsCount; ++attempt) {
        if (testReasonableSamplesOrder()) {
          ++successCounter;
        }
      }

      // Allowing some "failures" due to randomness, but expecting most of the attempts to succeed.
      expect(successCounter).toBeGreaterThanOrEqual(Math.floor(0.75 * repetitionsCount));
    });

    test(
      'validating that the number of restructure operations is O(logn) for random weights, ' +
      'confirming that the overall complexity of sampling n items is O(nlogn) for ' +
      'a large weight span', async () => {
      const samplesCount = 6543; // Large enough to be susceptible to statistical errors.
      const maxWeight = 114;
      const sampleWeight = (): number => maxWeight * Math.random();

      // Experiments show that the actual number of restructure attempts typically falls within the 
      // narrow interval [109,117], indicating low deviation.
      // The key finding is that even the upper bound (117) is significantly smaller than samplesCount, 
      // confirming the overall complexity of sampling n items is O(n log n), not O(n^2).
      const maxReasonableRestructureAttempts = 10 * Math.ceil(Math.log2(samplesCount)); // 10 * 13 = 130
      testLogarithmicComplexity(samplesCount, sampleWeight, maxReasonableRestructureAttempts);
    });

    test(
      'validating that the number of restructure operations is O(logn) for random weights, ' +
      'confirming that the overall complexity of sampling n items is O(nlogn) for ' +
      'a small weight span', async () => {
      const samplesCount = 6543; // Large enough to be susceptible to statistical errors.
      const maxWeight = 5;
      const sampleWeight = (): number => maxWeight * Math.random();

      // Experiments show that the actual number of restructure attempts typically falls within the 
      // narrow interval [108,118], indicating low deviation.
      // The key finding is that even the upper bound (118) is significantly smaller than samplesCount, 
      // confirming the overall complexity of sampling n items is O(n log n), not O(n^2).
      // Another interesting finding, is that despite the small weight span (relatively to the previous
      // test), the C constant is roughly the same.
      const maxReasonableRestructureAttempts = 10 * Math.ceil(Math.log2(samplesCount)); // 10 * 13 = 130
      testLogarithmicComplexity(samplesCount, sampleWeight, maxReasonableRestructureAttempts);
    });
  });

  describe('Negative path tests', () => {
    test('constructor should throw an error when given 0 items', () => {
      expect(() => new NonReplacementWeightedSampler<string>([], [])).toThrow();
      expect(() => new NonReplacementWeightedSampler<string>([], [4.77])).toThrow();
    });

    test('constructor should throw an error when the number of items does not match the number of weights', () => {
      expect(() => new NonReplacementWeightedSampler(["item1", "item2"], [1,2,3])).toThrow();
      expect(() => new NonReplacementWeightedSampler(["item1", "item2"], [51])).toThrow();
    });

    test(
      'constructor should throw an error when the failedSampleAttemptsBeforeRestructure ' +
      'argument is a non-natural number', () => {
      expect(() => new NonReplacementWeightedSampler(["item1", "item2"], [1,2], 0)).toThrow();
      expect(() => new NonReplacementWeightedSampler(["item1", "item2"], [3,4], -1)).toThrow();
    });

    test('constructor should throw an error when a non-positive weight is provided', () => {
      expect(() => new NonReplacementWeightedSampler(["item1", "item2"], [1, -2])).toThrow();
      expect(() => new NonReplacementWeightedSampler(["item1", "item2"], [0, 5.6])).toThrow();
      expect(() => new NonReplacementWeightedSampler(["item1", "item2", "item3"], [0.3, 4, 0])).toThrow();
      expect(() => new NonReplacementWeightedSampler(["item1", "item2", "item3"], [6, 4, -0.7])).toThrow();
    });

    test('constructor should throw an error when an undefined item value is provided', () => {
      expect(() => new NonReplacementWeightedSampler(["item1", undefined], [1, 2])).toThrow();
      expect(() => new NonReplacementWeightedSampler([undefined, "item2"], [4, 6])).toThrow();
      expect(() => new NonReplacementWeightedSampler(["item1", "item2", undefined], [1, 4, 3])).toThrow();
      expect(() => new NonReplacementWeightedSampler(["item1", undefined, "item3"], [6, 4, 1])).toThrow();
    });
  });
});
