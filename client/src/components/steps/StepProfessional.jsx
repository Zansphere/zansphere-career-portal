import { useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react';

export default function StepProfessional({ application, saving, onNext, onPrev }) {
  const [form, setForm] = useState({
    employmentStatus: application.employmentStatus || 'FRESHER',
    currentCompany: application.currentCompany || '',
    currentDesignation: application.currentDesignation || '',
    totalExperience: application.totalExperienceYears !== undefined ? (application.totalExperienceYears + (application.totalExperienceMonths / 12)).toFixed(1).replace(/\.0$/, '') : '',
    relevantExperience: application.relevantExperienceYears !== undefined ? (application.relevantExperienceYears + (application.relevantExperienceMonths / 12)).toFixed(1).replace(/\.0$/, '') : '',
    currentCtcFixed: (application.currentCtcFixed && Number(application.currentCtcFixed) > 0) ? application.currentCtcFixed : '',
    currentCtcVariable: (application.currentCtcVariable && Number(application.currentCtcVariable) >= 0) ? application.currentCtcVariable : '',
    expectedCtc: (application.expectedCtc && Number(application.expectedCtc) > 0) ? application.expectedCtc : '',
    noticePeriod: application.noticePeriod || 'Immediate',
  });

  const [history, setHistory] = useState(
    application.employmentHistory?.length > 0
      ? application.employmentHistory.map(h => ({ company: h.company, role: h.role, durationFrom: h.durationFrom, durationTo: h.durationTo }))
      : [{ company: '', role: '', durationFrom: '', durationTo: '' }]
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    if ((name === 'expectedCtc' || name === 'currentCtcFixed' || name === 'currentCtcVariable') && value.length > 7) {
      return;
    }
    setForm({ ...form, [name]: value });
  };

  const handleHistoryChange = (index, field, value) => {
    const updated = [...history];
    updated[index][field] = value;
    setHistory(updated);
  };

  const addHistory = () => {
    setHistory([...history, { company: '', role: '', durationFrom: '', durationTo: '' }]);
  };

  const removeHistory = (index) => {
    if (history.length > 1) {
      setHistory(history.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Parse experience
    const totalExp = parseFloat(form.totalExperience) || 0;
    const relExp = parseFloat(form.relevantExperience) || 0;

    if (form.employmentStatus !== 'FRESHER') {
      if (totalExp < 0 || totalExp > 30) {
        toast.error('Total experience must be between 0 and 30 years.');
        return;
      }
      if (relExp < 0 || relExp > 30) {
        toast.error('Relevant experience must be between 0 and 30 years.');
        return;
      }
      if (relExp > totalExp) {
        toast.error('Relevant experience cannot exceed total experience.');
        return;
      }

      // Temporal cross-validation with Education (Bug 18)
      if (application.educationHistory && application.educationHistory.length > 0 && totalExp > 0) {
        const currentYear = new Date().getFullYear();
        const gradYears = application.educationHistory.map((h) => parseInt(h.yearOfPassing) || currentYear);
        const maxGradYear = Math.max(...gradYears);
        const maxPossibleExp = Math.max(0, (currentYear - maxGradYear) + 1);
        if (totalExp > maxPossibleExp) {
          toast.error(`Work experience (${totalExp} years) is inconsistent with your graduation year (${maxGradYear}). Maximum possible experience is ${maxPossibleExp} years.`);
          return;
        }
      }
    }
    
    const submissionData = {
      ...form,
      totalExperienceYears: Math.floor(totalExp),
      totalExperienceMonths: Math.round((totalExp % 1) * 12),
      relevantExperienceYears: Math.floor(relExp),
      relevantExperienceMonths: Math.round((relExp % 1) * 12),
      employmentHistory: history,
    };

    // Remove non-schema fields
    delete submissionData.totalExperience;
    delete submissionData.relevantExperience;
    
    if (form.employmentStatus === 'FRESHER') {
      submissionData.currentCompany = 'N/A';
      submissionData.currentDesignation = 'N/A';
      submissionData.totalExperienceYears = 0;
      submissionData.totalExperienceMonths = 0;
      submissionData.relevantExperienceYears = 0;
      submissionData.relevantExperienceMonths = 0;
      submissionData.currentCtcFixed = null;
      submissionData.currentCtcVariable = null;
      submissionData.employmentHistory = [];
    }
    
    onNext(submissionData);
  };

  const isFresher = form.employmentStatus === 'FRESHER';

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="step-title">Professional Profile</h2>
      <p className="step-subtitle">Your work experience and compensation details</p>

      <div className="step-form">
        <div className="form-group">
          <label className="form-label">Employment Status <span className="required">*</span></label>
          <select name="employmentStatus" className="form-input form-select" value={form.employmentStatus} onChange={handleChange} required>
            <option value="EMPLOYED">Employed</option>
            <option value="FRESHER">Fresher</option>
          </select>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Current Company <span className="required">*</span></label>
            <input type="text" name="currentCompany" className="form-input" placeholder="Company name" value={form.currentCompany} onChange={handleChange} maxLength={100} required={!isFresher} disabled={isFresher} />
          </div>
          <div className="form-group">
            <label className="form-label">Current Designation <span className="required">*</span></label>
            <input type="text" name="currentDesignation" className="form-input" placeholder="Your role/designation" value={form.currentDesignation} onChange={handleChange} maxLength={100} required={!isFresher} disabled={isFresher} />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Total Experience (Years) <span className="required">*</span></label>
            <input type="number" step="0.1" name="totalExperience" className="form-input" placeholder="e.g. 2.5" min="0" max="30" value={form.totalExperience} onChange={handleChange} required={!isFresher} disabled={isFresher} />
          </div>
          <div className="form-group">
            <label className="form-label">Relevant Experience (Years) <span className="required">*</span></label>
            <input type="number" step="0.1" name="relevantExperience" className="form-input" placeholder="e.g. 1.5" min="0" max="30" value={form.relevantExperience} onChange={handleChange} required={!isFresher} disabled={isFresher} />
          </div>
        </div>

        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Current CTC (Fixed) <span className="required">*</span></label>
            <input 
              type="number" 
              name="currentCtcFixed" 
              className="form-input" 
              placeholder="₹ per annum" 
              value={form.currentCtcFixed} 
              onChange={handleChange} 
              onInput={(e) => { if (e.target.value.length > 7) e.target.value = e.target.value.slice(0, 7); }}
              required={!isFresher} 
              disabled={isFresher} 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Current CTC (Variable) <span className="required">*</span></label>
            <input 
              type="number" 
              name="currentCtcVariable" 
              className="form-input" 
              placeholder="₹ per annum" 
              value={form.currentCtcVariable} 
              onChange={handleChange} 
              onInput={(e) => { if (e.target.value.length > 7) e.target.value = e.target.value.slice(0, 7); }}
              required={!isFresher} 
              disabled={isFresher} 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Expected CTC <span className="required">*</span></label>
            <input 
              type="number" 
              name="expectedCtc" 
              className="form-input" 
              placeholder="₹ per annum" 
              value={form.expectedCtc} 
              onChange={handleChange} 
              onInput={(e) => { if (e.target.value.length > 7) e.target.value = e.target.value.slice(0, 7); }}
              required 
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Notice Period <span className="required">*</span></label>
          <select name="noticePeriod" className="form-input form-select" value={form.noticePeriod} onChange={handleChange} required disabled={isFresher}>
            <option value="Immediate">Immediate</option>
            <option value="15 days">15 Days</option>
            <option value="30 days">30 Days</option>
            <option value="60 days">60 Days</option>
            <option value="90 days">90 Days</option>
          </select>
        </div>

        <div style={{ opacity: isFresher ? 0.6 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <label className="form-label" style={{ margin: 0 }}>Employment History <span className="required">*</span></label>
            <button type="button" className="btn btn-ghost btn-sm" onClick={addHistory} disabled={isFresher}>
              <Plus size={14} /> Add Entry
            </button>
          </div>
          {history.map((entry, index) => (
            <div key={index} className="history-entry" style={{ marginBottom: '12px' }}>
              {history.length > 1 && (
                <button type="button" className="remove-entry" onClick={() => removeHistory(index)} disabled={isFresher}>
                  <Trash2 size={12} /> Remove
                </button>
              )}
              <div className="grid-2" style={{ marginBottom: '8px' }}>
                <div className="form-group">
                  <label className="form-label text-xs">Company</label>
                  <input type="text" className="form-input" placeholder="Company name" value={entry.company} onChange={(e) => handleHistoryChange(index, 'company', e.target.value)} maxLength={100} required={!isFresher} disabled={isFresher} />
                </div>
                <div className="form-group">
                  <label className="form-label text-xs">Role</label>
                  <input type="text" className="form-input" placeholder="Your role" value={entry.role} onChange={(e) => handleHistoryChange(index, 'role', e.target.value)} maxLength={100} required={!isFresher} disabled={isFresher} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label text-xs">From</label>
                  <input type="date" className="form-input" value={entry.durationFrom} onChange={(e) => handleHistoryChange(index, 'durationFrom', e.target.value)} required={!isFresher} disabled={isFresher} />
                </div>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label className="form-label text-xs">To</label>
                    <label style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={entry.durationTo === 'Present'} 
                        onChange={(e) => {
                          if (e.target.checked) handleHistoryChange(index, 'durationTo', 'Present');
                          else handleHistoryChange(index, 'durationTo', '');
                        }}
                        disabled={isFresher}
                      />
                      Currently Working
                    </label>
                  </div>
                  {entry.durationTo === 'Present' ? (
                    <input type="text" className="form-input" value="Present" disabled style={{ opacity: 0.7 }} />
                  ) : (
                    <input type="date" className="form-input" value={entry.durationTo} onChange={(e) => handleHistoryChange(index, 'durationTo', e.target.value)} required={!isFresher && entry.durationTo !== 'Present'} disabled={isFresher} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="step-actions">
        <button type="button" className="btn btn-secondary" onClick={onPrev}>
          <ArrowLeft size={16} /> Previous
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <div className="spinner" /> : <>Save & Continue <ArrowRight size={16} /></>}
        </button>
      </div>
    </form>
  );
}
