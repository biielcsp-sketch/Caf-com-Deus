// Gera a capa de um PDF (imagem JPEG da 1ª página) NO NAVEGADOR.
// Só deve ser importado por Client Components: usa canvas e Web Worker.
//
// Usa a build "legacy" do pdf.js, que roda também em navegadores de celular
// mais antigos. O worker vem do mesmo domínio (CSP: worker-src cai em
// script-src 'self').

const LARGURA_CAPA = 720; // px — nítida no celular sem pesar (JPEG ~100 KB)

export async function gerarCapaDePdf(pdf: Blob | ArrayBuffer): Promise<Blob> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = pdf instanceof Blob ? await pdf.arrayBuffer() : pdf;
  const tarefa = pdfjs.getDocument({ data });
  const documento = await tarefa.promise;
  try {
    const pagina = await documento.getPage(1);
    const base = pagina.getViewport({ scale: 1 });
    const viewport = pagina.getViewport({ scale: LARGURA_CAPA / base.width });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const contexto = canvas.getContext("2d");
    if (!contexto) throw new Error("Canvas indisponível.");

    // Fundo branco: páginas de PDF costumam ser transparentes e o JPEG
    // transformaria isso em preto.
    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, canvas.width, canvas.height);

    await pagina.render({ canvasContext: contexto, canvas, viewport }).promise;

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível gerar a capa."))),
        "image/jpeg",
        0.82,
      );
    });
  } finally {
    await tarefa.destroy();
  }
}
