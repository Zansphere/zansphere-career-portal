import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import api from '../../services/api';

export default function StepPreferences({ application, saving, onNext, onPrev }) {
  const [form, setForm] = useState({
    preferredJobType: application.preferredJobType || 'FULL_TIME',
    preferredWorkMode: application.preferredWorkMode || 'ON_SITE',
    preferredDepartment: application.preferredDepartment || '',
    roleOfInterest: application.roleOfInterest || '',
    subscribeJobAlerts: application.subscribeJobAlerts !== false,
  });

  const [jobs, setJobs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [isOtherRole, setIsOtherRole] = useState(false);
  const [otherRoleValue, setOtherRoleValue] = useState('');

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [jobsRes, deptsRes] = await Promise.allSettled([
          api.get('/jobs'),
          api.get('/jobs/departments/list'),
        ]);

        if (jobsRes.status === 'fulfilled' && jobsRes.value.data?.jobs) {
          setJobs(jobsRes.value.data.jobs);
          
          // Check if current roleOfInterest is not in the jobs list
          if (application.roleOfInterest && !jobsRes.value.data.jobs.find(j => j.id === application.roleOfInterest || j.title === application.roleOfInterest)) {
            setIsOtherRole(true);
            setOtherRoleValue(application.roleOfInterest);
            setForm(prev => ({ ...prev, roleOfInterest: 'OTHER' }));
          }
        }

        if (deptsRes.status === 'fulfilled' && deptsRes.value.data?.departments?.length > 0) {
          setDepartments(deptsRes.value.data.departments);
        } else {
          setDepartments([
            { id: '1', name: 'Engineering' },
            { id: '2', name: 'Design' },
            { id: '3', name: 'Sales & Marketing' },
            { id: '4', name: 'HR & Operations' },
          ]);
        }
      } catch (err) {
        console.error('Failed to fetch preference options', err);
      } finally {
        setLoadingJobs(false);
      }
    };
    fetchOptions();
  }, [application.roleOfInterest]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'roleOfInterest') {
      if (value === 'OTHER') {
        setIsOtherRole(true);
        setForm({ ...form, roleOfInterest: 'OTHER' });
      } else {
        setIsOtherRole(false);
        setForm({ ...form, roleOfInterest: value });
      }
    } else {
      setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
    }
  };

  const handleOtherRoleChange = (e) => {
    setOtherRoleValue(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const submissionData = { ...form };
    if (isOtherRole) {
      submissionData.roleOfInterest = otherRoleValue;
    }
    
    onNext(submissionData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="step-title">Job Preferences</h2>
      <p className="step-subtitle">Your ideal work setup</p>

      <div className="step-form">
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Preferred Job Type <span className="required">*</span></label>
            <select name="preferredJobType" className="form-input form-select" value={form.preferredJobType} onChange={handleChange} required>
              <option value="FULL_TIME">Full-time</option>
              <option value="INTERNSHIP">Internship</option>
              <option value="CONTRACT">Contract</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Preferred Work Mode <span className="required">*</span></label>
            <select name="preferredWorkMode" className="form-input form-select" value={form.preferredWorkMode} onChange={handleChange} required>
              <option value="REMOTE">Remote</option>
              <option value="HYBRID">Hybrid</option>
              <option value="ON_SITE">On-site</option>
            </select>
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Preferred Department <span className="required">*</span></label>
            <select
              name="preferredDepartment"
              className="form-input form-select"
              value={form.preferredDepartment}
              onChange={handleChange}
              required
            >
              <option value="" disabled>Select Department</option>
              {departments.map((dept) => (
                <option key={dept.id || dept.name} value={dept.name}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Job Preference <span className="required">*</span></label>
            <select name="roleOfInterest" className="form-input form-select" value={form.roleOfInterest} onChange={handleChange} required disabled={loadingJobs}>
              <option value="" disabled>{loadingJobs ? 'Loading roles...' : 'Select Role'}</option>
              {jobs.map(job => (
                <option key={job.id} value={job.title}>
                  {job.title} {job.departmentName ? `(${job.departmentName})` : ''}
                </option>
              ))}
              <option value="OTHER">Other (Please specify)</option>
            </select>
            
            {isOtherRole && (
              <input 
                type="text" 
                className="form-input" 
                placeholder="Type your desired role..." 
                value={otherRoleValue} 
                onChange={handleOtherRoleChange} 
                maxLength={100} 
                required 
                style={{ marginTop: '8px' }}
              />
            )}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="checkbox" name="subscribeJobAlerts" checked={form.subscribeJobAlerts} onChange={handleChange} style={{ width: '16px', height: '16px', accentColor: '#000' }} />
            Subscribe to job alerts
          </label>
        </div>
      </div>

      <div className="step-actions">
        <button type="button" className="btn btn-secondary" onClick={onPrev}>
          <ArrowLeft size={16} /> Previous
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving || loadingJobs || (isOtherRole && !otherRoleValue.trim())}>
          {saving ? <div className="spinner" /> : <>Save & Continue <ArrowRight size={16} /></>}
        </button>
      </div>
    </form>
  );
}
