// 👉 deno test --allow-read --allow-write
// 👉 deno test --allow-read --allow-write -- --save
// 👉 deno test --allow-read --allow-write -- --save -- --name=Sarah

import { assertEquals } from "https://deno.land/std@0.181.0/testing/asserts.ts";
import { parseArguments } from "./main.ts";

Deno.test("parseArguments should correctly parse CLI arguments", () => {
	const args = parseArguments(["--name", "Andy", "--color", "blue"]);
	assertEquals(args.name, "Andy");
	assertEquals(args.color, "blue");
});
