import { localMaterialEnabled, readLocalMaterial } from "@/lib/localMaterial";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!localMaterialEnabled()) return new Response(null, { status: 404 });
  try {
    const { id } = await params;
    const pdf = await readLocalMaterial(id, "pdf");
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="lesson.pdf"', "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response(null, { status: 404 }); }
}
