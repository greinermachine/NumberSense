import { describe, expect, it } from 'vitest';
import { SURF_TUNING } from './config';
import { SURF_COURSES } from './courses';
import { sampleRampSurface } from './physics';

const bankedRamps = (course: (typeof SURF_COURSES)[number]) =>
  course.ramps.filter((ramp) => ramp.kind === 'bank');

const averageBankWidth = (course: (typeof SURF_COURSES)[number]) => {
  const banks = bankedRamps(course);
  return banks.reduce((sum, ramp) => sum + ramp.width, 0) / banks.length;
};

const averageGap = (course: (typeof SURF_COURSES)[number]) => {
  const gaps = course.ramps.slice(1).map(
    (ramp, index) => ramp.startZ - course.ramps[index].endZ,
  );
  return gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
};

describe('surf course progression', () => {
  it.each(SURF_COURSES.map((course, index) => [index, course] as const))(
    'ends course %i on a long, flat, goal-bearing landing plane',
    (_index, course) => {
      const landing = course.ramps.at(-1)!;
      expect(landing.kind).toBe('landing');
      expect(landing.id).toBe(course.goal.rampId);
      expect(landing.bankRadians).toBe(0);
      expect(landing.startY).toBe(landing.endY);
      expect(course.goal.position.z - landing.startZ).toBeGreaterThanOrEqual(28);
      expect(landing.endZ - course.goal.position.z).toBeGreaterThanOrEqual(14);

      const goalSurface = sampleRampSurface(
        landing,
        course.goal.position.x,
        course.goal.position.z,
      );
      expect(goalSurface).not.toBeNull();
      expect(course.goal.position.y).toBeCloseTo(
        goalSurface!.height + SURF_TUNING.playerHeight,
      );
      expect(goalSurface!.normal.x).toBeCloseTo(0);
      expect(goalSurface!.normal.y).toBeCloseTo(1);
      expect(goalSurface!.normal.z).toBeCloseTo(0);
    },
  );

  it('increases challenge through route geometry and speed only', () => {
    expect(SURF_COURSES.map((course) => bankedRamps(course).length)).toEqual([2, 3, 4]);
    expect(SURF_COURSES.map((course) => course.spawn.speed)).toEqual([15.5, 17, 18.5]);
    expect(SURF_COURSES.map((course) => course.goal.radius)).toEqual([7.2, 6.2, 5.4]);

    const widths = SURF_COURSES.map(averageBankWidth);
    expect(widths[0]).toBeGreaterThan(widths[1]);
    expect(widths[1]).toBeGreaterThan(widths[2]);

    const gaps = SURF_COURSES.map(averageGap);
    expect(gaps[0]).toBeLessThan(gaps[1]);
    expect(gaps[1]).toBeLessThan(gaps[2]);

    const lengths = SURF_COURSES.map((course) => course.goal.position.z);
    expect(lengths[0]).toBeLessThan(lengths[1]);
    expect(lengths[1]).toBeLessThan(lengths[2]);
    expect(SURF_COURSES.map((course) => course.completionDelayMs)).toEqual([700, 760, 900]);
  });

  it('teaches one bank side first, introduces the other, then alternates both', () => {
    const signs = SURF_COURSES.map((course) =>
      bankedRamps(course).map((ramp) => Math.sign(ramp.bankRadians)),
    );
    expect(signs[0]).toEqual([1, 1]);
    expect(signs[1]).toEqual([-1, 1, -1]);
    expect(signs[2]).toEqual([1, -1, 1, -1]);
  });

  it('keeps late-stage checkpoints on real banks beyond the trivial opening', () => {
    for (const course of SURF_COURSES.slice(1)) {
      expect(course.checkpoints.length).toBeGreaterThanOrEqual(2);
      const late = course.checkpoints.at(-1)!;
      const rampIndex = course.ramps.findIndex((ramp) => ramp.id === late.rampId);
      expect(rampIndex).toBeGreaterThan(0);
      expect(course.ramps[rampIndex].kind).toBe('bank');
      expect(late.triggerZ).toBeGreaterThan(course.ramps[rampIndex].startZ);
    }
  });
});
