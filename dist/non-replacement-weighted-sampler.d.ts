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
export declare const DEFAULT_FAILED_SAMPLE_ATTEMPTS_BEFORE_RESTRUCTURE = 2;
/**
 * NonReplacementWeightedSampler
 *
 * The `NonReplacementWeightedSampler` class implements a random sampler where the probability of selecting
 * an item is proportional to its weight.
 * For example, given items [A, B] with respective weights [5, 12], the probability of sampling item B
 * is 12/5 higher than the probability of sampling item A.
 * Once an item is sampled, it will not be sampled again by this instance. In other words, each sample attempt
 * returns a unique item.
 *
 * Weights must be positive numbers, and there are no restrictions on them being natural numbers.
 * Floating point weights such as 0.95, 5.4, and 119.83 are also supported.
 *
 * The sampling method utilizes a binary search optimization, making it suitable for performance-demanding
 * applications where the set of items is large and the sampling frequency is high.
 *
 * ### Use Case Examples
 * 1. **Data Deduplication in Machine Learning**:
 *    For building a training dataset, the sampler can be used to select unique data samples from weighted
 *    subsets, ensuring that the most relevant and diverse samples are included without duplication, leading
 *    to more robust models.
 * 2. **Anomaly Detection in Security Logs**:
 *    When investigating potential security threats across numerous logs, the sampler can randomly select unique
 *    log entries based on their anomaly scores. Higher anomaly scores get a greater chance of being sampled early.
 * 3. **Penetration Testing Target Selection**:
 *    The sampler can randomly select a unique set of target systems for penetration tests, based on weighted risk
 *    assessments.
 */
export declare class NonReplacementWeightedSampler<T> {
    private _ascRangeEnds;
    private _lastRangeEnd;
    private _items;
    private _respectiveWeights;
    private _remainedItemsCounter;
    private _failedSamplesCounter;
    private _restructureAttemptsCounter;
    private readonly _failedSampleAttemptsBeforeRestructure;
    /**
     * Constructor
     *
     * Initializes the sampler by performing input validations and O(items.length) pre-processing.
     * The number of items must be positive and equal to the number of respective weights.
     * All weights must be positive. The value 'undefined' is **not allowed** as an item.
     *
     * ### Complexity
     * Performs pre-processing with O(n) time and space complexity, where n = items.length.
     *
     * ### Ownership Transfer
     * Ownership of the 'items' and 'respectiveWeights' arrays is transferred to the class upon instantiation.
     * The caller should **not modify** these arrays after passing them to the constructor.
     * While cloning could prevent this, in most cases, transferring ownership is more efficient.
     * If your use case requires retaining references to the original items for additional purposes,
     * consider storing them in separate data structures.
     *
     * @param items The array of items to sample from. The value 'undefined' is not allowed.
     * @param respectiveWeights The weights corresponding to each item, where respectiveWeights[i] is the weight
     *                          of items[i]. Weights must be positive.
     * @param failedSampleAttemptsBeforeRestructure The threshold of failed sample attempts before triggering a
     *                                              restructuring operation. This value is set at instantiation
     *                                              and remains constant.
     * @throws Error if validation fails, such as:
     *         - No items provided
     *         - A negative weight is provided
     *         - An 'undefined' item is provided
     *         - The length of items differs from the length of respectiveWeights
     */
    constructor(items: T[], respectiveWeights: readonly number[], failedSampleAttemptsBeforeRestructure?: number);
    /**
     * isEmpty
     *
     * Returns `true` if there are no items left to sample from, meaning all items
     * have already been sampled.
     */
    get isEmpty(): boolean;
    /**
     * remainedItems
     *
     * The number of items that have not yet been sampled. In other words,
     * the number of remaining items available for sampling.
     */
    get remainedItems(): number;
    /**
     * restructureAttempts
     *
     * The number of restructure operations that have occurred since the instance
     * was created. This value is O(logn), meaning it can be expressed as C * log(n),
     * where C * log(n) is significantly smaller than n.
     * Stress tests on large datasets (over 6,500 items) have shown that C typically
     * ranges between 8 and 9, regardless of whether the weight span is small or large.
     */
    get restructureAttempts(): number;
    /**
     * sample
     *
     * Randomly samples an item from the remaining (not previously chosen) items, with the probability of
     * selecting a given item being proportional to its weight.
     *
     * For example, given items [A, B] with respective weights [5, 12], the probability of sampling item B
     * is 12/5 higher than that of sampling item A.
     *
     * ### Complexity
     * O(log(n)) time and O(1) space complexity on average. However, if a restructure operation occurs due
     * to reaching the limit of fruitless internal sample attempts, the complexity becomes O(n) for both time
     * and space.
     * Overall, sampling all items takes O(nlogn), as the restructure operation happens only O(log(n)) times
     * on average.
     *
     * @returns An item from the items array provided to the constructor.
     * @throws Error if all items have already been sampled.
     */
    sample(): T;
    /**
     * _trySample
     *
     * Attempts to sample an item in a weighted manner. The attempt may fail if a previously sampled
     * item is randomly chosen. Unlike the public method, which is designed to succeed, this internal
     * method may fail, indicating that the restructure operation should be triggered when the threshold
     * of fruitless sample attempts is reached.
     *
     * @returns A sampled item if successful; otherwise, undefined.
     */
    private _trySample;
    /**
     * _findCorrespondingRangeIndex
     *
     * @param pointInRange A numeric point within the total range [0, this._lastRangeEnd)
     * @returns The index of the range where pointInRange is located.
     */
    private _findCorrespondingRangeIndex;
    /**
     * _restructureFromRemainedItems
     *
     * Rebuilds the internal state from the provided items. This operation is triggered when
     * the threshold of fruitless internal sample attempts is reached. Probabilistically,
     * this threshold is typically reached when approximately *half* of the items in
     * this._items have already been sampled. Therefore, we expect this operation to occur
     * O(log n) times during the lifespan of the instance.
     */
    private _restructureFromRemainedItems;
}
