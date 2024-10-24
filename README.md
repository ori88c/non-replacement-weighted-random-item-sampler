<h2 align="middle">Non-Replacement Weighted Random Item Sampler</h2>

The `NonReplacementWeightedSampler` class implements a random sampler where the probability of selecting an item is proportional to its weight, and every item is sampled **exactly once** (without repetition or replacement). In other words, each sample attempt returns a **unique** item.

For example, given items [A, B] with respective weights [5, 12], the probability of sampling item B is 12/5 higher than the probability of sampling item A.

Weights must be positive numbers, and there are no restrictions on them being natural numbers. Floating point weights such as 0.95, 5.4, and 119.83 are also supported.

Use case examples include:
* __ML Model Training__: For building a training dataset, the sampler can be used to select **unique** data samples from weighted subsets, ensuring that the most relevant and diverse samples are included **without duplication**, leading to more robust models.
* __Attack Simulation__: Randomly select attack vectors for penetration testing based on weighted risk assessments (likelihood or impact).
* __Anomaly Detection in Security Logs__: When investigating potential security threats across numerous logs, the sampler can randomly select unique log entries based on their anomaly scores. Higher anomaly scores get a greater chance of being sampled early.

## Table of Contents

* [Key Features](#key-features)
* [API](#api)
* [Getter Methods](#getter-methods)
* [Use Case Example: Training Samples for a ML model](#use-case-example)
* [License](#license)

## Key Features :sparkles:<a id="key-features"></a>

- __Weighted Random Sampling :weight_lifting_woman:__: Sampling items with proportional probability to their weight.
- __No Replacement__: Every item is sampled **exactly once**. In other words, each sample attempt returns a unique item.
- __Efficiency :gear:__: Amortized O(log(n)) time and O(1) space per sample, making this class suitable for performance-critical applications with large item sets and high sampling frequency. In the worst case, both time and space complexity are O(n) during a restructure operation, which can occur at most O(log(n)) times.
- __Comprehensive documentation :books:__: The class is thoroughly documented, enabling IDEs to provide helpful tooltips that enhance the coding experience.
- __Tests :test_tube:__: **Fully covered** by comprehensive unit tests, including stress tests with randomized weights and a large number of samples. Specifically, the tests validate that sampling all n items has a complexity of O(nlogn). Practical benchmarks show that sampling n items typically requires *C * nlog(n)* operations, with *C* generally ranging between 8 and 9.
- No external runtime dependencies: Only development dependencies are used.
- ES2020 Compatibility: The `tsconfig` target is set to ES2020, ensuring compatibility with ES2020 environments.
- TypeScript support.

## API :globe_with_meridians:<a id="api"></a>

The `NonReplacementWeightedSampler` class provides the following method:

* __sample__: Randomly samples an item from the remaining (not previously chosen) items, with the probability of selecting a given item being proportional to its weight.

If needed, refer to the code documentation for a more comprehensive description.

## Getter Methods :mag:<a id="getter-methods"></a>

The `NonReplacementWeightedSampler` class provides the following getter methods to reflect the current state:

* __isEmpty__: Indicates whether there are no items left to sample from, meaning all items have already been sampled.
* __remainedItems__: The number of items that have not yet been sampled.
* __restructureAttempts__: The number of restructure operations that have occurred since the instance was created. This value is *O(logn)*, meaning it can be expressed as *C * log(n)*, where *C * log(n)* is **significantly** smaller than n. Stress tests on large datasets (over 6,500 items) have shown that C typically ranges between 8 and 9, regardless of whether the weight span is small or large.

To eliminate any ambiguity, all getter methods have **O(1)** time and space complexity.

## Use Case Example: Training Samples for a ML model :man_technologist:<a id="use-case-example"></a>

Consider a component responsible for selecting training-samples for a ML model. By assigning weights based on the importance or difficulty of each sample, we ensure a diverse and balanced training dataset.

```ts
import { NonReplacementWeightedSampler } from 'non-replacement-weighted-random-item-sampler';

interface TrainingSampleData {
  // ...
}

interface TrainingSampleMetadata {
  importance: number; // Weight for sampling.
  // ...
}

interface TrainingSample {
  data: TrainingSampleData;
  metadata: TrainingSampleMetadata;
}

class ModelTrainer {
  private readonly _trainingSampler: NonReplacementWeightedSampler<TrainingSample>;

  constructor(samples: TrainingSample[]) {
    this._trainingSampler = new NonReplacementWeightedSampler(
      samples, // Items array.
      samples.map(sample => sample.metadata.importance) // Respective weights array.
    );
  }

  public selectTrainingSample(): TrainingSample {
    return this._trainingSampler.sample();
  }

  public get remainedSamplesCount(): number {
    return this._trainingSampler.remainedItems;
  }
}
```

## License :scroll:<a id="license"></a>

[Apache 2.0](LICENSE)
