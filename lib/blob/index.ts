import { put, head } from "@vercel/blob";

export async function uploadActPdf(actId: string, buffer: Buffer): Promise<string> {
  const blob = await put(`acts/${actId}.pdf`, buffer, {
    access: "public",
    contentType: "application/pdf",
    addRandomSuffix: false,
  });
  return blob.url;
}

export async function getActPdfDownloadUrl(blobUrl: string): Promise<string> {
  const blobInfo = await head(blobUrl);
  return blobInfo.url;
}
