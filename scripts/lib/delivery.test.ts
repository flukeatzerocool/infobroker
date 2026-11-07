// delivery.test — unit tests for the pure delivery metrics. Role: test.

import { describe, expect, it } from "vitest";
import { DAY, deliveryReport, median, percentile } from "./delivery.js";

describe("percentile", () => {
  it("returns NaN for an empty input", () => {
    expect(Number.isNaN(percentile([], 0.5))).toBe(true);
  });

  it("uses nearest-rank order statistics", () => {
    expect(percentile([4, 1, 3, 2], 0.5)).toBe(3);
    expect(percentile([4, 1, 3, 2], 0.9)).toBe(4);
    expect(median([4, 1, 3, 2])).toBe(3);
  });
});

describe("deliveryReport", () => {
  it("returns null without two push endpoints", () => {
    expect(deliveryReport([], [], [])).toBeNull();
    expect(deliveryReport([100], [100], [])).toBeNull();
  });

  it("computes the window, frequency, and lead time", () => {
    const pushes = [0, 2 * DAY, 4 * DAY];
    const commits = [0, DAY, 2 * DAY, 3 * DAY];
    const report = deliveryReport(pushes, commits, []);
    expect(report).not.toBeNull();
    expect(report?.windowDays).toBe(4);
    expect(report?.pushes).toBe(3);
    expect(report?.deploymentFrequency).toBeCloseTo(0.75);
    // Commit 3*DAY waits 1 day for the 4*DAY push.
    expect(report?.leadTimeMedian).toBe(DAY);
  });

  it("counts commits between pushes", () => {
    const pushes = [0, 10, 20];
    const commits = [1, 2, 3, 11, 21];
    const report = deliveryReport(pushes, commits, []);
    expect(report?.commitsPerPushMedian).toBe(1);
    expect(report?.commitsPerPushMax).toBe(3);
  });

  it("counts a pipeline commit followed within 48 hours", () => {
    const pushes = [0, 3 * DAY];
    const report = deliveryReport(pushes, [0], [0, DAY, 5 * DAY]);
    expect(report?.pipelineCommits).toBe(3);
    expect(report?.pipelineFollowUps).toBe(1);
  });
});
