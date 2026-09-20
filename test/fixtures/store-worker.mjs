import { Store } from "../../dist/store.js";
const [filename, mode, owner] = process.argv.slice(2);
const store = new Store(filename);
process.on("message", () => {
  const lease = store.claim(owner, 10000);
  if (mode === "hold" && lease) {
    store.operation(lease, "remote-start", "turn", { marker: "fixture" });
    store.setPaused(true);
  }
  process.send({ lease });
  if (mode !== "hold") {
    store.close();
    process.disconnect();
  }
});
process.send({ ready: true });
