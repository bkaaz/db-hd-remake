import { describe, expect, it } from "vitest";
import { Camera } from "./camera";

/** The original's sizes (`rom.md`, The camera). */
const ORIGINAL = { screen: 256, world: 512, floor: 200 };

function at(x: number): Camera {
  const camera = new Camera(ORIGINAL);
  camera.x = x;
  return camera;
}

describe("Camera", () => {
  it("keeps the original's numbers: a 512-px world, 16 px from every edge", () => {
    const camera = at(128);
    expect(camera.world).toEqual({ min: 16, max: 496 });
    expect(camera.screen).toEqual({ min: 144, max: 368 });
  });

  it("scrolls with a fighter walking into the screen's outer band", () => {
    const camera = at(128);
    const placed = camera.follow({ from: 328, to: 330 }, { from: 200, to: 200 });
    expect(camera.x).toBe(130);
    expect(placed).toEqual({ a: 330, b: 200 });
  });

  it("does not scroll for a fighter walking in the middle", () => {
    const camera = at(128);
    camera.follow({ from: 250, to: 252 }, null);
    expect(camera.x).toBe(128);
  });

  it("stops at the world's end", () => {
    const camera = at(255);
    camera.follow({ from: 470, to: 473 }, null);
    expect(camera.x).toBe(256);
  });

  it("will not drag a fighter at the far edge off the screen", () => {
    const camera = at(128);
    camera.follow({ from: 144, to: 144 }, { from: 358, to: 360 });
    expect(camera.x).toBe(128);
  });

  it("holds a fighter walking out while the other is pinned at the far side", () => {
    const camera = at(100);
    const placed = camera.follow({ from: 116, to: 114 }, { from: 340, to: 340 });
    expect(camera.x).toBe(100);
    expect(placed.a).toBe(116);
  });

  it("puts back a fighter more than 6 px past the margin, and only then", () => {
    expect(at(128).follow({ from: 200, to: 137 }, null).a).toBe(144);
    expect(at(128).follow({ from: 200, to: 139 }, null).a).toBe(139);
  });

  it("rises an eighth of the higher fighter's height, a pixel a frame", () => {
    const camera = new Camera(ORIGINAL);
    camera.lift([200, 104]);
    expect(camera.rise).toBe(1);
    for (let i = 0; i < 30; i++) camera.lift([200, 104]);
    expect(camera.rise).toBe(12);
    expect(camera.y).toBe(-12);
    for (let i = 0; i < 30; i++) camera.lift([200, 200]);
    expect(camera.rise).toBe(0);
  });

  it("counts the height in steps of 8 and stops at the top of the world", () => {
    const camera = new Camera(ORIGINAL);
    for (let i = 0; i < 40; i++) camera.lift([107]);
    expect(camera.rise).toBe(12); // 107 rounds down to 104: 96 up
    for (let i = 0; i < 40; i++) camera.lift([-50]);
    expect(camera.rise).toBe(25); // above the top counts as the top
  });
});
