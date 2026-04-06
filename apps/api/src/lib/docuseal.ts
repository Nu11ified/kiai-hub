import { getEnv } from "./env.js";

export interface DocuSealTemplate {
  id: number;
  name: string;
  [key: string]: unknown;
}

export interface DocuSealSubmitter {
  role: string;
  name: string;
  email: string;
  fields?: Array<{ name: string; default_value: string }>;
}

export interface DocuSealSubmissionParams {
  template_id: number | string;
  submitters: DocuSealSubmitter[];
  send_email?: boolean;
}

export interface DocuSealSubmission {
  id: number;
  status: string;
  template_id: number;
  submitters: Array<{
    id: number;
    status: string;
    email: string;
    name: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export async function docusealFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getEnv("DOCUSEAL_API_URL");
  const apiKey = getEnv("DOCUSEAL_API_KEY");

  const url = `${baseUrl.replace(/\/$/, "")}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": apiKey,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `DocuSeal API error ${response.status}: ${text}`
    );
  }

  return response.json() as Promise<T>;
}

export function listTemplates(): Promise<DocuSealTemplate[]> {
  return docusealFetch<DocuSealTemplate[]>("/templates");
}

export function createSubmission(
  params: DocuSealSubmissionParams
): Promise<DocuSealSubmission> {
  return docusealFetch<DocuSealSubmission>("/submissions", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function getSubmission(submissionId: number | string): Promise<DocuSealSubmission> {
  return docusealFetch<DocuSealSubmission>(`/submissions/${submissionId}`);
}
