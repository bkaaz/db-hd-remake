import { describe, expect, it } from "vitest";
import { arenaList, dataDirs, readData, readEntity } from "./files";

describe("data/ read through the glob", () => {
  it("assembles a fighter from his section files, and a spawn from its own directory", async () => {
    const goku = await readEntity("goku");
    expect(goku?.name).toBe("goku");
    expect(Object.keys(goku?.frames ?? {}).length).toBeGreaterThan(0);
    expect(goku?.states).toBeDefined();
    expect((await readEntity("ki_blast"))?.look).toBeDefined();
  });

  it("says nothing of what is not there", async () => {
    expect(await readEntity("goku_old")).toBeNull();
    expect(await readData("nothing.json")).toBeNull();
  });

  it("lists a directory's directories, and each arena's lightings", async () => {
    expect(dataDirs("entities")).toContain("vegeta");
    expect(dataDirs("entities")).not.toContain("ki_blast");
    expect(await arenaList()).toContainEqual({ name: "shore", times: ["night"] });
  });
});
