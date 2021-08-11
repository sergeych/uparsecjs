import { TimeService } from "../src/TimeService";

import 'isomorphic-fetch'
window.fetch = require('node-fetch');
window.FormData = require('form-data');

jest.setTimeout(15000);

it("synchronizes time", async () => {
  const ts = new TimeService("https://api.myonly.cloud/api/p0");
  const t = await ts.shiftMillis;
  expect(Math.abs(t)).toBeLessThan(20000);
});

