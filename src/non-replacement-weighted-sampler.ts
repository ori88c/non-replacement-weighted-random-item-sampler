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

export const DEFAULT_FAILED_SAMPLE_ATTEMPTS_BEFORE_RESTRUCTURE = 2;

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
export class NonReplacementWeightedSampler<T> {
    // The 0th imaginary range corresponds interval [0, _ascRangeEnds[0]).
    // The ith imaginary range corresponds interval [_ascRangeEnds[i-1], _ascRangeEnds[i]).
    private _ascRangeEnds: readonly number[]; // Ascending exclusive-ends of ranges.
    private _lastRangeEnd: number;
    private _items: T[];
    private _respectiveWeights: readonly number[];
    private _remainedItemsCounter: number;

    // Tracks the number of sample attempts that resulted in an already-sampled item.
    // Once this count reaches the configured limit, an O(n) restructuring operation is triggered
    // to filter out previously sampled items.
    private _failedSamplesCounter = 0;
    // Counts the number of times the restructuring operation has been performed, 
    // helping to track how often the sampler needed to reorganize the internal state.
    private _restructureAttemptsCounter = 0;
    private readonly _failedSampleAttemptsBeforeRestructure: number;

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
     * While cloning the arrays would prevent unintended modifications, transferring ownership is generally more
     * efficient since callers rarely need to retain references for other purposes beyond sampling.  
     * If your use case does require retaining the original items for additional purposes, consider storing a copy
     * in a separate data structure.
     * 
     * @param items The array of items to sample from. The value 'undefined' is not allowed.
     * @param respectiveWeights The weights corresponding to each item, where respectiveWeights[i] is the weight
     *                          of items[i]. Weights must be positive.
     * @param failedSampleAttemptsBeforeRestructure The threshold of failed sample attempts before triggering a
     *                                              restructuring operation. This value is set at instantiation
     *                                              and remains constant.
     * @throws Error if validation fails; possible causes can be:
     *         - No items provided
     *         - A negative weight is provided
     *         - An 'undefined' item is provided
     *         - The length of items differs from the length of respectiveWeights
     *         - Non-natural number provided for argument 'failedSampleAttemptsBeforeRestructure'
     */
    constructor(
        items: T[],
        respectiveWeights: readonly number[],
        failedSampleAttemptsBeforeRestructure: number = DEFAULT_FAILED_SAMPLE_ATTEMPTS_BEFORE_RESTRUCTURE
    ) {
        if (items.length === 0) {
            throw new Error("No items provided");
        }

        if (items.length !== respectiveWeights.length) {
            throw new Error(
                `Mismatch: received ${items.length} items and ${respectiveWeights.length} weights. ` +
                `Each item must have exactly one corresponding weight.`
            );
        }

        if (!isNaturalNumber(failedSampleAttemptsBeforeRestructure)) {
            throw new Error(
                `Received a non-natural failedSampleAttemptsBeforeRestructure argument of ` +
                `${failedSampleAttemptsBeforeRestructure}`
            );
        }
        
        if (items.includes(undefined)) {
            throw new Error("Items cannot contain undefined values");
        }

        const nonPositiveWeight: number | undefined = respectiveWeights.find(weight => weight <= 0);
        if (nonPositiveWeight !== undefined) {
            throw new Error(`Received a non-positive weight of ${nonPositiveWeight}`);
        }

        this._remainedItemsCounter = items.length;
        this._failedSampleAttemptsBeforeRestructure = failedSampleAttemptsBeforeRestructure;
        this._restructureFromRemainedItems(items, respectiveWeights);
    }

    /**
     * isEmpty
     * 
     * Returns `true` if there are no items left to sample from, meaning all items 
     * have already been sampled.
     */
    public get isEmpty(): boolean {
        return this._remainedItemsCounter === 0;
    }

    /**
     * remainedItems
     * 
     * The number of items that have not yet been sampled. In other words, 
     * the number of remaining items available for sampling.
     */
    public get remainedItems(): number {
        return this._remainedItemsCounter;
    }

    /**
     * restructureAttempts
     * 
     * The number of restructure operations that have occurred since the instance 
     * was created. This value is O(logn), meaning it can be expressed as C * log(n),
     * where C * log(n) is significantly smaller than n.
     * Stress tests on large datasets (over 6,500 items) have shown that C typically 
     * ranges between 8 and 9, regardless of whether the weight span is small or large.
     */
    public get restructureAttempts(): number {
        return this._restructureAttemptsCounter;
    }

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
    public sample(): T {
        if (this._remainedItemsCounter === 0) {
            throw new Error("All items have already been sampled");
        }

        do {
            const item = this._trySample();
            if (item !== undefined) {
                return item;
            }
        } while (++this._failedSamplesCounter < this._failedSampleAttemptsBeforeRestructure);

        // Filter out only remained items, as a pre-processing step before internal restructure.
        const respectiveWeights: number[] = [];
        const remainedItems: T[] = [];
        let i = 0;
        for (const item of this._items) {
            if (item !== undefined) {
                remainedItems.push(item);
                respectiveWeights.push(this._respectiveWeights[i]);
            }

            ++i;
        }
        this._restructureFromRemainedItems(remainedItems, respectiveWeights);

        return this._trySample();
    }

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
    private _trySample(): T {
        const randomPoint = Math.random() * this._lastRangeEnd;
        const rangeIndex = this._findCorrespondingRangeIndex(randomPoint);
        const correspondingItem = this._items[rangeIndex];

        if (correspondingItem !== undefined) {
            // Assist the garbage collector by releasing references to sampled items,
            // as they are no longer needed after being returned to the caller.
            this._items[rangeIndex] = undefined;
            --this._remainedItemsCounter;
            return correspondingItem;
        }

        return undefined;
    }

    /**
     * _findCorrespondingRangeIndex
     * 
     * @param pointInRange A numeric point within the total range [0, this._lastRangeEnd)
     * @returns The index of the range where pointInRange is located.
     */
    private _findCorrespondingRangeIndex(pointInRange: number): number {
        // Find the leftmost (smallest) index i such that randomPoint < this._ascRangeEnds[i].
        // This index corresponds to the imaginary range in which the random point is located.
        let rangeIndex = 0;
        let left = 0;
        let right = this._ascRangeEnds.length - 1;
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            if (pointInRange < this._ascRangeEnds[mid]) {
                rangeIndex = mid; // This is an improving candidate.
                right = mid - 1; // If possible, find a lower index which satisfies the condition.
            } else { 
                left = mid + 1;
            }
        }

        return rangeIndex;
    }

    /**
     * _restructureFromRemainedItems
     * 
     * Rebuilds the internal state from the provided items. This operation is triggered when 
     * the threshold of fruitless internal sample attempts is reached. Probabilistically, 
     * this threshold is typically reached when approximately *half* of the items in 
     * this._items have already been sampled. Therefore, we expect this operation to occur 
     * O(log n) times during the lifespan of the instance.
     */
    private _restructureFromRemainedItems(
        items: T[],
        respectiveWeights: readonly number[]
    ): void {
        const ascRangeEnds = new Array<number>(items.length).fill(0);
        let currIndex = 0;
        let weightsPrefixSum = 0;
        for (const weight of respectiveWeights) {
            weightsPrefixSum += weight;
            ascRangeEnds[currIndex++] = weightsPrefixSum;
            // The ith item (0-indexed) is associated with the following imaginary range:
            // [previous prefix sum, current prefix sum)
            // Ranges are pairwise disjoint intervals with inclusive starts and exclusive ends.
        }

        this._items = items;
        this._respectiveWeights = respectiveWeights;
        this._ascRangeEnds = ascRangeEnds;
        this._lastRangeEnd = weightsPrefixSum;
        this._failedSamplesCounter = 0;
        ++this._restructureAttemptsCounter;
    }
}

function isNaturalNumber(num: number): boolean {
    const floored = Math.floor(num);
    return floored >= 1 && floored === num;
}
