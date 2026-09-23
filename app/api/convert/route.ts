// PPT(.pptx/.ppt/.odp) → PDF 변환.
//
// 슬라이드 뷰어는 PDF만 렌더하므로, 강사가 PPT를 그대로 올리면 여기서 바꿔서 돌려준다.
// 변환은 이 컴퓨터에 깔린 LibreOffice(soffice)가 한다 — 브라우저만으로는 못 하는 일이라
// 개발 서버가 도는 로컬에서만 동작한다. 없으면 안내 메시지를 돌려준다.

import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { localMaterialEnabled } from "@/lib/localMaterial";
import { isTeacher, readSession } from "@/lib/live/server";

export const runtime = "nodejs";

const TIMEOUT_MS = 180_000;
const MAX_BYTES = 200 * 1024 * 1024;
let converting = false;

/** soffice 실행 파일 찾기 — PATH에 없을 때가 많아 흔한 설치 경로도 본다 */
function findSoffice(): string | null {
  if (process.env.SOFFICE_PATH) return process.env.SOFFICE_PATH;
  const candidates = [
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/bin/soffice",
    "/usr/local/bin/soffice",
    "/snap/bin/libreoffice",
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // PATH에 있으면 이름만으로도 뜬다
  return "soffice";
}

function run(bin: string, args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    // shell을 거치지 않는다 (파일명이 명령으로 해석되지 않도록)
    const child = spawn(bin, args, { windowsHide: true });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("변환이 너무 오래 걸려서 중단했어요."));
    }, TIMEOUT_MS);

    child.stderr?.on("data", (d) => {
      stderr += String(d);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stderr });
    });
  });
}

export async function POST(request: Request) {
  if (!localMaterialEnabled()) return Response.json({ error: "PPT 변환은 현재 로컬 시험 환경에서만 가능합니다." }, { status: 503 });
  const sessionId = new URL(request.url).searchParams.get("sessionId") ?? "";
  const state = await readSession(sessionId);
  if (!state || !isTeacher(state, request.headers.get("x-teacher-token") ?? "")) return Response.json({ error: "강사 권한이 필요합니다." }, { status: 403 });
  if (converting) return Response.json({ error: "다른 자료를 변환 중이에요. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  converting = true;
  let workDir: string | null = null;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "파일이 없습니다." }, { status: 400 });
    }
    if (!file.size || file.size > MAX_BYTES) {
      return Response.json({ error: "파일이 너무 큽니다 (200MB 이하)." }, { status: 413 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (ext !== ".pptx") {
      return Response.json({ error: `변환할 수 없는 형식입니다 (${ext}).` }, { status: 400 });
    }

    workDir = await mkdtemp(path.join(tmpdir(), "classflow-"));
    // 원본 이름을 그대로 쓰지 않는다 — 확장자만 유지한 안전한 이름으로
    const input = path.join(workDir, `deck${ext}`);
    await writeFile(input, Buffer.from(await file.arrayBuffer()));

    const soffice = findSoffice();
    if (!soffice) {
      return Response.json({ error: "LibreOffice를 찾지 못했습니다." }, { status: 501 });
    }

    const { code, stderr } = await run(soffice, [
      `-env:UserInstallation=${pathToFileURL(path.join(workDir, "profile")).href}`,
      "--headless",
      "--norestore",
      "--convert-to",
      "pdf",
      "--outdir",
      workDir,
      input,
    ]);

    const produced = (await readdir(workDir)).find((f) => f.toLowerCase().endsWith(".pdf"));
    if (!produced) {
      return Response.json(
        {
          error:
            code === -1 || /ENOENT/.test(stderr)
              ? "이 컴퓨터에서 LibreOffice를 찾지 못했어요. PPT를 직접 PDF로 저장해서 올려주세요."
              : "PPT를 PDF로 바꾸지 못했어요. PPT를 직접 PDF로 저장해서 올려주세요.",
        },
        { status: 501 },
      );
    }

    const pdf = await readFile(path.join(workDir, produced));
    if (pdf.length > 60 * 1024 * 1024) return Response.json({ error: "변환한 PDF가 60MB를 넘어요. PPT의 이미지를 줄여 다시 올려주세요." }, { status: 413 });
    if (pdf.subarray(0, 5).toString() !== "%PDF-") throw new Error("변환 결과가 올바른 PDF가 아니에요.");
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="deck.pdf"`,
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "변환 중 문제가 생겼어요." },
      { status: 500 },
    );
  } finally {
    if (workDir && path.dirname(path.resolve(workDir)) === path.resolve(tmpdir()) && path.basename(workDir).startsWith("classflow-"))
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    converting = false;
  }
}
