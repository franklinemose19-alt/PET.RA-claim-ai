// src/pages/customer/ConnectInsurer.jsx
//
// PET.RA Claims AI — Connect Insurer
//
// Customer searches verified insurers, selects one, enters policy number
// + membership ID, and links the account. Only is_verified=true companies
// are searchable here (enforced both by RLS and a client-side filter).

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function ConnectInsurer() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedCompany, setSelectedCompany] = useState(null);
  const [policyNumber, setPolicyNumber] = useState('');
  const [membershipId, setMembershipId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadCompanies() {
      const { data, error: fetchError } = await supabase
        .from('companies')
        .select('id, name, logo_url')
        .eq('is_verified', true)
        .order('name');

      if (!fetchError && data) setCompanies(data);
      setLoadingCompanies(false);
    }
    loadCompanies();
  }, []);

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  async function handleConnect(e) {
    e.preventDefault();
    setError('');

    if (!selectedCompany || !policyNumber.trim()) {
      setError('Please select an insurer and enter your policy number.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from('policies').insert({
        customer_id: user.id,
        company_id: selectedCompany.id,
        policy_number: policyNumber.trim(),
        membership_id: membershipId.trim() || null,
      });

      if (insertError) {
        // unique constraint violation = already connected with this exact policy number
        if (insertError.code === '23505') {
          setError('You are already connected to this insurer with this policy number.');
        } else {
          throw insertError;
        }
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => navigate('/customer/claims'), 1500);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not connect insurer. Please try again.');
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-emerald-400 text-4xl mb-4">✓</div>
        <p className="text-white font-medium">Insurer connected</p>
        <p className="text-slate-400 text-sm mt-1">Redirecting to your claims...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-white mb-6">Connect Insurer</h1>

      {!selectedCompany ? (
        <>
          <input
            type="text"
            placeholder="Search insurance companies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl bg-slate-800/50 border border-slate-700 px-4 py-3 text-white mb-4 focus:outline-none focus:border-purple-500"
          />

          {loadingCompanies ? (
            <p className="text-slate-400 text-sm">Loading insurers...</p>
          ) : filteredCompanies.length === 0 ? (
            <p className="text-slate-400 text-sm">No verified insurers match your search.</p>
          ) : (
            <div className="space-y-2">
              {filteredCompanies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCompany(c)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-700 bg-slate-800/50 hover:border-purple-500 transition"
                >
                  {c.logo_url ? (
                    <img src={c.logo_url} alt={c.name} className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                      {c.name.charAt(0)}
                    </div>
                  )}
                  <span className="text-white font-medium">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <form onSubmit={handleConnect} className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl border border-purple-500 bg-purple-500/10">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
              {selectedCompany.name.charAt(0)}
            </div>
            <span className="text-white font-medium">{selectedCompany.name}</span>
            <button
              type="button"
              onClick={() => setSelectedCompany(null)}
              className="ml-auto text-slate-400 text-xs underline"
            >
              Change
            </button>
          </div>

          <div>
            <label className="block text-slate-400 text-xs mb-1">Policy number</label>
            <input
              type="text"
              value={policyNumber}
              onChange={(e) => setPolicyNumber(e.target.value)}
              required
              className="w-full rounded-xl bg-slate-800/50 border border-slate-700 px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-xs mb-1">Membership ID (optional)</label>
            <input
              type="text"
              value={membershipId}
              onChange={(e) => setMembershipId(e.target.value)}
              className="w-full rounded-xl bg-slate-800/50 border border-slate-700 px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium disabled:opacity-50"
          >
            {submitting ? 'Connecting...' : 'Connect'}
          </button>
        </form>
      )}
    </div>
  );
}
