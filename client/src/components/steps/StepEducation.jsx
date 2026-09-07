import { useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react';

export default function StepEducation({ application, saving, onNext, onPrev }) {
  const [history, setHistory] = useState(
    application.educationHistory?.length > 0
      ? application.educationHistory.map(h => ({
          institution: h.institution,
          degreeSpecialization: h.degreeSpecialization,
          yearOfPassing: h.yearOfPassing,
          percentageOrCgpa: h.percentageOrCgpa,
        }))
      : [{ institution: '', degreeSpecialization: '', yearOfPassing: new Date().getFullYear(), percentageOrCgpa: '' }]
  );

  const handleHistoryChange = (index, field, value) => {
    const updated = [...history];
    updated[index][field] = value;
    setHistory(updated);
  };

  const addHistory = () => {
    setHistory([...history, { institution: '', degreeSpecialization: '', yearOfPassing: new Date().getFullYear(), percentageOrCgpa: '' }]);
  };

  const removeHistory = (index) => {
    if (history.length > 1) {
      setHistory(history.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const currentYear = new Date().getFullYear();
    const maxGradYear = Math.max(2026, currentYear);

    for (const entry of history) {
      const year = parseInt(entry.yearOfPassing);
      if (isNaN(year) || year < 2000 || year > maxGradYear) {
        toast.error(`Graduation year must be between 2000 and ${maxGradYear}.`);
        return;
      }
      if (application.employmentStatus !== 'FRESHER' && application.totalExperienceYears && application.totalExperienceYears > 0) {
        const maxPossibleExp = Math.max(0, (currentYear - year) + 1);
        if (application.totalExperienceYears > maxPossibleExp) {
          toast.error(`Graduation year (${year}) is inconsistent with your recorded ${application.totalExperienceYears} years of work experience.`);
          return;
        }
      }
    }
    onNext({ educationHistory: history });
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="step-title">Education</h2>
      <p className="step-subtitle">Your academic qualifications</p>

      <div className="step-form">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <label className="form-label" style={{ margin: 0 }}>Education History <span className="required">*</span></label>
          <button type="button" className="btn btn-ghost btn-sm" onClick={addHistory}>
            <Plus size={14} /> Add Education
          </button>
        </div>

        {history.map((entry, index) => (
          <div key={index} className="history-entry" style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: index < history.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
            {history.length > 1 && (
              <button type="button" className="remove-entry" onClick={() => removeHistory(index)}>
                <Trash2 size={12} /> Remove
              </button>
            )}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Institution / University <span className="required">*</span></label>
                <input type="text" className="form-input" placeholder="University or institution name" value={entry.institution} onChange={(e) => handleHistoryChange(index, 'institution', e.target.value)} maxLength={300} required />
              </div>
              <div className="form-group">
                <label className="form-label">Degree & Specialization <span className="required">*</span></label>
                <input type="text" className="form-input" placeholder="e.g., B.Tech in Computer Science" value={entry.degreeSpecialization} onChange={(e) => handleHistoryChange(index, 'degreeSpecialization', e.target.value)} maxLength={300} required />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Year of Passing <span className="required">*</span></label>
                <input type="number" className="form-input" placeholder="e.g., 2024" min="2000" max={Math.max(2026, new Date().getFullYear())} value={entry.yearOfPassing} onChange={(e) => handleHistoryChange(index, 'yearOfPassing', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Percentage / CGPA <span className="required">*</span></label>
                <input type="text" className="form-input" placeholder="e.g., 85% or 8.5 CGPA" value={entry.percentageOrCgpa} onChange={(e) => handleHistoryChange(index, 'percentageOrCgpa', e.target.value)} maxLength={20} required />
              </div>
            </div>
          </div>
        ))}
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
