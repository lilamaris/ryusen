import test from "node:test";
import assert from "node:assert/strict";
import { toTf2Sku } from "./tf2-sku";

void test("toTf2Sku builds defindex-based SKU with quality and attributes", () => {
  const sku = toTf2Sku(
    {
      name: "Professional Killstreak Australium Rocket Launcher",
      app_data: { def_index: "205" },
      tags: [
        { category: "Quality", internal_name: "Strange" },
        { category: "Exterior", internal_name: "Factory New" },
      ],
      descriptions: [
        { value: "★ Unusual Effect: Sunbeams" },
        { value: "( Not Tradable )" },
      ],
    },
    "111_222"
  );

  assert.equal(sku, "205;st;ks-3;u-sunbeams;wear-factory-new;australium;untradable");
});

void test("toTf2Sku falls back to raw key when defindex is missing", () => {
  const sku = toTf2Sku(
    {
      name: "Mann Co. Supply Crate Key",
      tags: [{ category: "Quality", internal_name: "Unique" }],
    },
    "5033_0"
  );

  assert.equal(sku, "raw-5033_0");
});
