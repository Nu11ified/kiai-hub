"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

interface Document {
  id: string;
  name: string;
  type: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export default function DocumentsPage() {
  const params = useParams();
  const dojoId = params.dojoId as string;
  const eventId = params.eventId as string;

  const [docs, setDocs] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api(`/documents/dojo/${dojoId}/event/${eventId}`).then(setDocs);
  }, [dojoId, eventId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const doc = await api(`/documents/dojo/${dojoId}/upload`, {
        method: "POST",
        body: JSON.stringify({
          name: file.name,
          fileName: file.name,
          type: "custom",
          mimeType: file.type,
          fileBase64: base64,
          eventId,
        }),
      });
      setDocs((prev) => [...prev, doc]);
    } finally {
      setUploading(false);
    }
  }

  async function generateRulesPdf() {
    setGenerating(true);
    try {
      const doc = await api(`/documents/dojo/${dojoId}/generate-rules-pdf`, {
        method: "POST",
        body: JSON.stringify({
          eventId,
          sections: [
            { title: "General Rules", content: "All participants must follow FIK kendo rules." },
            { title: "Equipment", content: "All bogu must be in safe, functional condition." },
          ],
        }),
      });
      setDocs((prev) => [...prev, doc]);
    } finally {
      setGenerating(false);
    }
  }

  async function getDownloadUrl(documentId: string) {
    const { url } = await api(`/documents/dojo/${dojoId}/${documentId}/url`);
    window.open(url, "_blank");
  }

  async function deleteDocument(documentId: string) {
    await api(`/documents/dojo/${dojoId}/${documentId}`, { method: "DELETE" });
    setDocs((prev) => prev.filter((d) => d.id !== documentId));
  }

  function formatBytes(bytes: number | null): string {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Documents</h1>
        <div className="flex gap-2">
          <button
            onClick={generateRulesPdf}
            disabled={generating}
            className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate Rules PDF"}
          </button>
          <label className="cursor-pointer rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
            {uploading ? "Uploading..." : "Upload Document"}
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="divide-y rounded-lg border">
        {docs.length === 0 && (
          <p className="p-4 text-gray-500 text-sm">No documents yet</p>
        )}
        {docs.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{doc.name}</p>
              <p className="text-xs text-gray-500">
                {doc.type} · {formatBytes(doc.sizeBytes)} · {doc.mimeType}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => getDownloadUrl(doc.id)}
                className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Download
              </button>
              <button
                onClick={() => deleteDocument(doc.id)}
                className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
