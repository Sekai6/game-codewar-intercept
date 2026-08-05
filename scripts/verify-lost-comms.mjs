import assert from "node:assert/strict";
import { LostCommsRuntime } from "../dist-test/lost-comms/runtime.js";

const runtime = new LostCommsRuntime();
runtime.register("blue-cg-57", "us-ntu-picket", 0);
assert.equal(runtime.update("blue-cg-57", { time: 1, linkQuality: .1 }), null);
const entered = runtime.update("blue-cg-57", { time: 7, linkQuality: .1 });
assert.equal(entered?.kind, "entered");
const recovering = runtime.update("blue-cg-57", { time: 10, linkQuality: .8 });
assert.equal(recovering?.kind, "recovering");
const restored = runtime.update("blue-cg-57", { time: 19, linkQuality: .8 });
assert.equal(restored?.kind, "restored");
assert.equal(runtime.state("blue-cg-57")?.connected, true);
console.log("Lost-comms doctrine verification passed.");
