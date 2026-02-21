import type { Route } from "./+types/api.document-download";
import { requireAuth } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { processDocuments } from "drizzle/schema";
import { eq } from "drizzle-orm";
import { getSignedDownloadUrl } from "~/lib/storage.server";
import { logAudit } from "~/lib/audit.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);

  const [doc] = await db
    .select()
    .from(processDocuments)
    .where(eq(processDocuments.id, params.id))
    .limit(1);

  if (!doc) {
    throw new Response("Document not found", { status: 404 });
  }

  if (!doc.fileUrl) {
    throw new Response("Document has no file URL", { status: 400 });
  }

  // Extract key from fileUrl - the key is what we stored in S3
  // fileUrl format: http://endpoint/bucket/key
  const url = new URL(doc.fileUrl);
  const pathParts = url.pathname.split("/");
  // Remove first empty string and bucket name
  const key = pathParts.slice(2).join("/");

  const signedUrl = await getSignedDownloadUrl(key);

  await logAudit({
    userId: user.id,
    action: "download",
    entity: "document",
    entityId: doc.id,
    changes: { fileName: doc.name, processId: doc.processId },
    request,
  });

  return Response.redirect(signedUrl, 302);
}
