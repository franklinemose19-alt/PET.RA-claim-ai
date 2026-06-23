// src/pages/Login.jsx
//
// PET.RA Claims AI — Login / Signup
//
// Single page handling: customer login, customer signup, company login,
// company signup. Tab-based switch between customer/company, and
// login/signup within each.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { signIn, signUpCustomer, signUpCompany } = useAuth();
  const navigate = useNavigate();

  const [accountType, setAccountType] = useState('customer'); // 'customer' | 'company'
  const [mode, setMode] = useState('login'); // 'login' | 'signup'

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  function resetMessages() {
    setError('');
    setInfoMessage('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    resetMessages();
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await signIn({ email, password });
        navigate('/');
        return;
      }

      // Signup
      if (accountType === 'customer') {
        const result = await signUpCustomer({ email, password, fullName, phone });
        if (result.needsEmailConfirmation) {
          setInfoMessage('Check your email to confirm your account, then log in.');
          setMode('login');
        } else {
          navigate('/');
        }
      } else {
        if (!companyName.trim()) {
          setError('Company name is required.');
          setSubmitting(false);
          return;
        }
        const result = await signUpCompany({ email, password, fullName, companyName });
        if (result.needsEmailConfirmation) {
          setInfoMessage('Check your email to confirm your account, then log in.');
          setMode('login');
        } else {
          setInfoMessage('Company registered. Your account is pending verification by PET.RA before you can receive claims.');
          navigate('/');
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            PET<span className="text-purple-400">.</span>RA
          </h1>
          <p className="text-slate-400 text-sm mt-1">Claims AI</p>
        </div>

        <div className="rounded-2xl bg-slate-900/60 backdrop-blur border border-slate-800 p-6">
          {/* Account type toggle */}
          <div className="flex rounded-xl bg-slate-800/50 p-1 mb-6">
            <button
              onClick={() => { setAccountType('customer'); resetMessages(); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                accountType === 'customer' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'text-slate-400'
              }`}
            >
              Customer
            </button>
            <button
              onClick={() => { setAccountType('company'); resetMessages(); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                accountType === 'company' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'text-slate-400'
              }`}
            >
              Insurance Company
            </button>
          </div>

          <h2 className="text-white font-medium mb-4">
            {mode === 'login' ? 'Log in' : `Create ${accountType === 'customer' ? 'customer' : 'company'} account`}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Field label="Full name" value={fullName} onChange={setFullName} required />
            )}

            {mode === 'signup' && accountType === 'customer' && (
              <Field label="Phone" value={phone} onChange={setPhone} type="tel" />
            )}

            {mode === 'signup' && accountType === 'company' && (
              <Field label="Company name" value={companyName} onChange={setCompanyName} required />
            )}

            <Field
              label={accountType === 'company' ? 'Business email' : 'Email'}
              value={email}
              onChange={setEmail}
              type="email"
              required
            />

            <Field label="Password" value={password} onChange={setPassword} type="password" required />

            {error && <p className="text-red-400 text-sm">{error}</p>}
            {infoMessage && <p className="text-emerald-400 text-sm">{infoMessage}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium disabled:opacity-50"
            >
              {submitting ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>

          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); resetMessages(); }}
            className="w-full text-center text-sm text-purple-400 mt-4"
          >
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }) {
  return (
    <div>
      <label className="block text-slate-400 text-xs mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-xl bg-slate-800/50 border border-slate-700 px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
      />
    </div>
  );
}
