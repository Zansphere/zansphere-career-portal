import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, FileText, Building2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import './Auth.css';

export default function Register() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    departmentOfInterest: '',
    dpdpConsent: false,
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    let value = e.target.value;
    if (e.target.name === 'firstName' || e.target.name === 'lastName') {
      value = value.replace(/\s/g, '');
    }
    setForm({ ...form, [e.target.name]: value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed for resume.');
      e.target.value = '';
      return;
    }
    setResumeFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.firstName || !form.lastName || !form.email || !form.password || !form.phone || !form.departmentOfInterest) {
      toast.error('All fields are required.');
      return;
    }

    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }

    if (!resumeFile) {
      toast.error('Resume (PDF) is required.');
      return;
    }

    if (!form.dpdpConsent) {
      toast.error('Please accept the Privacy Policy and DPDP consent.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      Object.keys(form).forEach(key => formData.append(key, form[key]));
      formData.append('termsVersionId', 'v1.0');
      formData.append('resume', resumeFile);

      const res = await api.post('/auth/register', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(res.data.message || 'Registration successful!');
      navigate('/verify-otp', { state: { email: form.email, purpose: 'EMAIL_VERIFICATION' } });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container animate-fadeIn">
        <div className="auth-header">
          <img src="/assets/zanSphereLogo.svg" alt="Zansphere Logo" style={{ height: '180px', margin: '0 auto 16px', display: 'block' }} />
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Join Zansphere Career Portal and explore opportunities</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">First Name <span className="required">*</span></label>
              <div className="input-icon-wrapper">
                <User size={16} className="input-icon" />
                <input
                  type="text"
                  name="firstName"
                  className="form-input with-icon"
                  placeholder="First name"
                  value={form.firstName}
                  onChange={handleChange}
                  maxLength={50}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Last Name <span className="required">*</span></label>
              <div className="input-icon-wrapper">
                <User size={16} className="input-icon" />
                <input
                  type="text"
                  name="lastName"
                  className="form-input with-icon"
                  placeholder="Last name"
                  value={form.lastName}
                  onChange={handleChange}
                  maxLength={50}
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address <span className="required">*</span></label>
            <div className="input-icon-wrapper">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                name="email"
                className="form-input with-icon"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                maxLength={100}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password <span className="required">*</span></label>
            <div className="input-icon-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                className="form-input with-icon"
                placeholder="Min. 8 chars with upper, lower, number & special"
                value={form.password}
                onChange={handleChange}
                maxLength={128}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="password-requirements">
              <span className={form.password.length >= 8 ? 'met' : ''}>8+ chars</span>
              <span className={/[A-Z]/.test(form.password) ? 'met' : ''}>Uppercase</span>
              <span className={/[a-z]/.test(form.password) ? 'met' : ''}>Lowercase</span>
              <span className={/[0-9]/.test(form.password) ? 'met' : ''}>Number</span>
              <span className={/[^A-Za-z0-9]/.test(form.password) ? 'met' : ''}>Special</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Mobile Number <span className="required">*</span></label>
            <div className="input-icon-wrapper">
              <Phone size={16} className="input-icon" />
              <input
                type="tel"
                name="phone"
                className="form-input with-icon"
                placeholder="9943XXXXXX"
                value={form.phone}
                onChange={handleChange}
                maxLength={10}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Department of Interest <span className="required">*</span></label>
            <div className="input-icon-wrapper">
              <Building2 size={16} className="input-icon" />
              <select
                name="departmentOfInterest"
                className="form-input with-icon"
                value={form.departmentOfInterest}
                onChange={handleChange}
                required
              >
                <option value="" disabled>Select Department</option>
                <option value="Engineering">Engineering</option>
                <option value="Design">Design</option>
                <option value="Sales & Marketing">Sales & Marketing</option>
                <option value="HR & Operations">HR & Operations</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Resume (PDF only) <span className="required">*</span></label>
            <input
              type="file"
              id="resume-upload"
              name="resume"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <label htmlFor="resume-upload" className="file-upload-btn">
              {resumeFile ? (
                <>
                  <FileText size={16} />
                  <span className="file-upload-name">{resumeFile.name}</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span>Choose PDF file</span>
                </>
              )}
            </label>
          </div>

          <div className="form-group" style={{ marginTop: '14px', marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                name="dpdpConsent"
                checked={form.dpdpConsent}
                onChange={(e) => setForm({ ...form, dpdpConsent: e.target.checked })}
                required
                style={{ marginTop: '3px' }}
              />
              <span>
                I agree to the <strong>Privacy Policy &amp; Terms of Service (Version 1.0)</strong> and consent to my data being processed for recruitment purposes under the DPDP Act. <span className="required">*</span>
              </span>
            </label>
          </div>

          <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
            {loading ? <div className="spinner" /> : <>Create Account <ArrowRight size={16} /></>}
          </button>
        </form>

        <div className="auth-footer">
          <p>Already have an account? <Link to="/login">Sign in</Link></p>
        </div>
      </div>

      <div className="auth-decoration">
        <div className="auth-deco-circle" />
        <div className="auth-deco-circle small" />
      </div>
    </div>
  );
}
