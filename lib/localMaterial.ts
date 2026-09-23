import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

export function localMaterialEnabled() { return process.env.CLASSFLOW_LOCAL_ONLY === "1" && !process.env.VERCEL; }
const folder = path.join(process.cwd(), ".classflow", "materials");
export function validMaterialId(id: string) { return /^[a-f0-9-]{36}$/.test(id); }
export async function saveLocalMaterial(id: string, pdf: Uint8Array, notes: unknown, original?: Uint8Array) {
  if (!validMaterialId(id)) throw new Error("잘못된 자료 ID입니다.");
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, `${id}.pdf`), pdf);
  await writeFile(path.join(folder, `${id}.json`), JSON.stringify(notes));
  if (original) await writeFile(path.join(folder, `${id}.pptx`), original);
}
export async function readLocalMaterial(id: string, extension: "pdf" | "json" | "pptx") {
  if (!validMaterialId(id)) throw new Error("잘못된 자료 ID입니다.");
  return readFile(path.join(folder, `${id}.${extension}`));
}
