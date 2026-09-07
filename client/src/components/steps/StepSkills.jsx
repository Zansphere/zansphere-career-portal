import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StepSkills({ application, saving, onNext, onPrev }) {
  // skills will be stored as an array of objects: { category: string, skills: string }
  const [skillEntries, setSkillEntries] = useState(
    Array.isArray(application.skills) && application.skills.length > 0
      ? application.skills
      : [{ category: '', skills: '' }]
  );

  const categories = [
    "Engineering/Tech",
    "Sales/Marketing",
    "HR/Admin/Finance",
    "Design"
  ];

  const handleEntryChange = (index, field, value) => {
    const updated = [...skillEntries];
    updated[index][field] = value;
    setSkillEntries(updated);
  };

  const addEntry = () => {
    if (skillEntries.length >= categories.length) return;
    setSkillEntries([...skillEntries, { category: '', skills: '' }]);
  };

  const removeEntry = (index) => {
    if (skillEntries.length > 1) {
      setSkillEntries(skillEntries.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Filter out completely empty entries
    const validEntries = skillEntries.filter(entry => entry.category && entry.skills.trim() !== '');

    for (const entry of validEntries) {
      const list = entry.skills.split(',').map(s => s.trim()).filter(Boolean);
      if (list.length > 7) {
        toast.error(`Maximum 7 skills allowed for "${entry.category || 'each category'}". Currently you have ${list.length}.`);
        return;
      }
    }

    onNext({ skills: validEntries });
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="step-title">Skills</h2>
      <p className="step-subtitle">
        Highlight your relevant skills by category (up to 7 skills per category)
      </p>

      <div className="step-form">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <label className="form-label" style={{ margin: 0 }}>Your Skills</label>
          <button 
            type="button" 
            className="btn btn-ghost btn-sm" 
            onClick={addEntry}
            disabled={skillEntries.length >= categories.length}
          >
             Add Category
          </button>
        </div>
        
        {skillEntries.map((entry, index) => {
          const skillCount = entry.skills ? entry.skills.split(',').map(s => s.trim()).filter(Boolean).length : 0;
          return (
            <div key={index} style={{ marginBottom: '16px', padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', position: 'relative' }}>
              {skillEntries.length > 1 && (
                <button 
                  type="button" 
                  onClick={() => removeEntry(index)}
                  style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', fontSize: '12px' }}
                >
                  Remove
                </button>
              )}
              <div className="form-group" style={{ marginBottom: '12px', paddingRight: '60px' }}>
                <label className="form-label text-xs">Category <span className="required">*</span></label>
                <select className="form-input form-select" value={entry.category} onChange={(e) => handleEntryChange(index, 'category', e.target.value)} required>
                  <option value="" disabled>Select category</option>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="form-label text-xs" style={{ margin: 0 }}>Skills (Max 7, comma-separated) <span className="required">*</span></label>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: skillCount > 7 ? 'var(--color-error, #ef4444)' : 'var(--text-muted)' }}>
                    {skillCount}/7 skills
                  </span>
                </div>
                <textarea 
                  className="form-input" 
                  placeholder="e.g., React, Node.js, Python" 
                  value={entry.skills} 
                  onChange={(e) => handleEntryChange(index, 'skills', e.target.value)} 
                  required 
                  rows={2}
                />
                {skillCount > 7 && (
                  <p style={{ color: 'var(--color-error, #ef4444)', fontSize: '0.75rem', margin: '4px 0 0 0' }}>
                    You have entered {skillCount} skills. Please limit to a maximum of 7 skills for this category.
                  </p>
                )}
              </div>
            </div>
          );
        })}
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
