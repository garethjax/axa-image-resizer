self.addEventListener("message", async (event) => {
  const { id, buffer, type, quality } = event.data;

  try {
    if (typeof OffscreenCanvas === "undefined") {
      throw new Error("OffscreenCanvas non supportato dal browser.");
    }

    const inputBlob = new Blob([buffer], { type });
    const bitmap = await createImageBitmap(inputBlob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Impossibile inizializzare il canvas 2D.");
    }

    context.drawImage(bitmap, 0, 0);
    bitmap.close();

    const outputBlob = await canvas.convertToBlob({
      type: "image/webp",
      quality,
    });
    const blobBuffer = await outputBlob.arrayBuffer();

    self.postMessage(
      {
        id,
        ok: true,
        blobBuffer,
        width: canvas.width,
        height: canvas.height,
      },
      [blobBuffer]
    );
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : "Errore sconosciuto",
    });
  }
});
