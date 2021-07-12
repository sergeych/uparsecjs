import { Estimator } from "../src";


test("estimator", () => {
  const e = new Estimator();

  e.addSample(1);
  e.addSample(2);
  e.addSample(3);
  e.addSample(5);
  expect(e.mean).toBe(2.75);
  expect(e.stdev).toBeCloseTo(1.7078251, 7 );
});
