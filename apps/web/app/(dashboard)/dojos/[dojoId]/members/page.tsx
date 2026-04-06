"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../../../lib/api";

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
}

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  admin: "bg-blue-100 text-blue-700",
  volunteer: "bg-gray-100 text-gray-700",
};

export default function MembersPage() {
  const params = useParams<{ dojoId: string }>();
  const dojoId = params.dojoId;

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("volunteer");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, [dojoId]);

  function fetchMembers() {
    setLoading(true);
    api
      .get<Member[]>(`/dojos/${dojoId}/members`)
      .then(setMembers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInviting(true);

    try {
      await api.post(`/dojos/${dojoId}/members`, {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail("");
      setInviteRole("volunteer");
      fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite member");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    setError("");
    try {
      await api.patch(`/dojos/${dojoId}/members/${memberId}`, { role: newRole });
      fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change role");
    }
  }

  async function handleRemove(memberId: string) {
    setError("");
    try {
      await api.delete(`/dojos/${dojoId}/members/${memberId}`);
      fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Members</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <form
        onSubmit={handleInvite}
        className="mb-6 flex gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <input
          type="email"
          required
          placeholder="Email address"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <select
          value={inviteRole}
          onChange={(e) => setInviteRole(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="admin">Admin</option>
          <option value="volunteer">Volunteer</option>
        </select>
        <button
          type="submit"
          disabled={inviting}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {inviting ? "Inviting..." : "Invite"}
        </button>
      </form>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-6 py-3 text-left font-medium text-gray-500">Name</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Email</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Role</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-gray-100">
                <td className="px-6 py-3">{member.name}</td>
                <td className="px-6 py-3 text-gray-500">{member.email}</td>
                <td className="px-6 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      ROLE_COLORS[member.role] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {member.role}
                  </span>
                </td>
                <td className="px-6 py-3">
                  {member.role !== "owner" && (
                    <div className="flex gap-2">
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                      >
                        <option value="admin">Admin</option>
                        <option value="volunteer">Volunteer</option>
                      </select>
                      <button
                        onClick={() => handleRemove(member.id)}
                        className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-500">No members found</div>
        )}
      </div>
    </div>
  );
}
