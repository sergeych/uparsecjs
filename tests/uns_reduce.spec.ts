import { UNS } from "../src/UNS";

describe('UNS', () => {

  function assertEquals(expected: string,result: string) {
    expect(result).toBe(expected);
  }

  it("reduce words",() => {
    const n1 = UNS.reduce("sergeychl");
    const n2 = UNS.reduce("sergeуchi");
    const n3 = UNS.reduce("sergeychI");
    const n4 = UNS.reduce("sergeychl");

    expect(n2).toBe(n1);
    expect(n3).toBe(n1);
    expect(n4).toBe(n1);
    expect(UNS.reduce("ьъ")).toBe("66");
    expect(UNS.reduce("abc")).toBe("a6c");
    expect(UNS.reduce("abcьъЬЪ")).toBe("a6c6666");
    expect(UNS.reduce("bьъ")).toBe("666");
    expect(UNS.reduce("bЬЪ")).toBe("666");

    assertEquals("he110111_vv0r1d1_1", UNS.reduce("hello!!!? world|-_1"))
    assertEquals("he110_vv0r1d1_1", UNS.reduce("hello[?]_world|-_1"))
    assertEquals("110n_ma5k", UNS.reduce("Ilon Ma\$k"))
    assertEquals("fvr_ma55", UNS.reduce("für, maß"))
    assertEquals("m00n", UNS.reduce("mo0n"))
    assertEquals("franca15_", UNS.reduce("français?"))
    // + UNS xlat finalizer combination test
    assertEquals("9ceh_neh61111", UNS.reduce("Ясен пень!!!!"))
    assertEquals("nvc6mev0", UNS.reduce("письмецо"))

  })
})
