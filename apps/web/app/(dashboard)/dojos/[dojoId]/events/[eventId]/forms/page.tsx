"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../../../../../lib/api";

interface FormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
}

const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "email",
  "phone",
  "date",
  "select",
  "checkbox",
  "radio",
];

const TYPE_COLORS: Record<string, string> = {
  text: "bg-blue-100 text-blue-700",
  textarea: "bg-blue-100 text-blue-700",
  number: "bg-purple-100 text-purple-700",
  email: "bg-green-100 text-green-700",
  phone: "bg-green-100 text-green-700",
  date: "bg-yellow-100 text-yellow-700",
  select: "bg-orange-100 text-orange-700",
  checkbox: "bg-pink-100 text-pink-700",
  radio: "bg-pink-100 text-pink-700",
};

export default function FormsPage() {
  const params = useParams<{ dojoId: string; eventId: string }>();
  const { dojoId, eventId } = params;

  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [required, setRequired] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchFields();
  }, [dojoId, eventId]);

  function fetchFields() {
    setLoading(true);
    api
      .get<FormField[]>(`/events/dojo/${dojoId}/${eventId}/forms`)
      .then(setFields)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function handleAddField(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAdding(true);

    try {
      await api.post(`/events/dojo/${dojoId}/${eventId}/forms`, {
        label,
        type: fieldType,
        required,
      });
      setLabel("");
      setFieldType("text");
      setRequired(false);
      fetchFields();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add field");
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteField(fieldId: string) {
    setError("");
    try {
      await api.delete(`/events/dojo/${dojoId}/${eventId}/forms/${fieldId}`);
      fetchFields();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete field");
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Custom Form Fields</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <div className="mb-6 space-y-3">
        {fields.map((field) => (
          <div
            key={field.id}
            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="font-medium">{field.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  TYPE_COLORS[field.type] || "bg-gray-100 text-gray-700"
                }`}
              >
                {field.type}
              </span>
              {field.required && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  required
                </span>
              )}
            </div>
            <button
              onClick={() => handleDeleteField(field.id)}
              className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        ))}
        {fields.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
            No custom fields yet
          </div>
        )}
      </div>

      <form
        onSubmit={handleAddField}
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold">Add Field</h2>

        <div>
          <label htmlFor="label" className="mb-1 block text-sm font-medium text-gray-700">
            Label
          </label>
          <input
            id="label"
            type="text"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label htmlFor="fieldType" className="mb-1 block text-sm font-medium text-gray-700">
            Type
          </label>
          <select
            id="fieldType"
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="required"
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <label htmlFor="required" className="text-sm font-medium text-gray-700">
            Required
          </label>
        </div>

        <button
          type="submit"
          disabled={adding}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {adding ? "Adding..." : "Add Field"}
        </button>
      </form>
    </div>
  );
}
