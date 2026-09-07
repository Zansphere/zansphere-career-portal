import { useState } from 'react';
import { ArrowLeft, Send, Edit3 } from 'lucide-react';

const QUAL_LABELS = { TENTH: '10th', TWELFTH: '12th', DIPLOMA: 'Diploma', UG: 'Undergraduate', PG: 'Postgraduate' };
const EMP_LABELS = { EMPLOYED: 'Employed', FRESHER: 'Fresher', STUDENT: 'Student', BETWEEN_JOBS: 'Between Jobs' };
const JOB_TYPE_LABELS = { FULL_TIME: 'Full-time', INTERNSHIP: 'Internship', CONTRACT: 'Contract' };
const WORK_MODE_LABELS = { REMOTE: 'Remote', HYBRID: 'Hybrid', ON_SITE: 'On-site' };

export default function StepReview({ application, saving, onPrev, onSubmit, onGoToStep }) {
  const [consent, setConsent] = useState(application.dpdpConsent || false);
  const isSubmitted = application.status === 'SUBMITTED';
  const skills = application.skills || {};

  const ReviewSection = ({ title, stepNum, children }) => (
    <div className="review-section">
      <div className="review-section-header">
        <h3>{title}</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onGoToStep(stepNum)}>
          <Edit3 size={14} /> Edit
        </button>
      </div>
      <div className="review-section-body">{children}</div>
    </div>
  );

  const Row = ({ label, value }) => (
    <div className="review-row">
      <span className="review-label">{label}</span>
      <span className="review-value">{value || '—'}</span>
    </div>
  );

  const handleSubmit = () => {
    if (!consent) return;
    onSubmit({ dpdpConsent: true, termsVersionId: 'v1.0' });
  };

  return (
    <div>
      <h2 className="step-title">{isSubmitted ? 'Application Submitted' : 'Review & Submit'}</h2>
      <p className="step-subtitle">
        {isSubmitted ? 'Your application has been submitted successfully.' : 'Review your application details before submitting.'}
      </p>

      <ReviewSection title="1. Personal Details" stepNum={1}>
        <Row label="Full Name" value={application.fullName} />
        <Row label="Email" value={application.email} />
        <Row label="Phone" value={application.phone} />
        <Row label="Date of Birth" value={application.dateOfBirth ? new Date(application.dateOfBirth).toLocaleDateString('en-IN') : ''} />
        <Row label="Location" value={`${application.city}, ${application.state}`} />
        <Row label="Willing to Relocate to Chennai" value={application.willingToRelocate ? 'Yes' : 'No'} />
      </ReviewSection>

      <ReviewSection title="2. Professional Profile" stepNum={2}>
        <Row label="Status" value={EMP_LABELS[application.employmentStatus]} />
        <Row label="Company" value={application.currentCompany} />
        <Row label="Designation" value={application.currentDesignation} />
        <Row label="Total Experience" value={`${application.totalExperienceYears} yrs ${application.totalExperienceMonths} months`} />
        <Row label="Relevant Experience" value={`${application.relevantExperienceYears} yrs ${application.relevantExperienceMonths} months`} />
        <Row label="Current CTC" value={application.currentCtcFixed ? `₹${Number(application.currentCtcFixed).toLocaleString('en-IN')} (Fixed) + ₹${Number(application.currentCtcVariable || 0).toLocaleString('en-IN')} (Variable)` : '—'} />
        <Row label="Expected CTC" value={application.expectedCtc ? `₹${Number(application.expectedCtc).toLocaleString('en-IN')}` : '—'} />
        <Row label="Notice Period" value={application.noticePeriod} />
        {application.employmentHistory?.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            <span className="review-label">Employment History</span>
            {application.employmentHistory.map((h, i) => (
              <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span className="review-value">{h.role} at {h.company} ({h.durationFrom} — {h.durationTo})</span>
              </div>
            ))}
          </div>
        )}
      </ReviewSection>

      <ReviewSection title="3. Education" stepNum={3}>
        {application.educationHistory?.length > 0 ? (
          application.educationHistory.map((edu, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: i < application.educationHistory.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
              <Row label="Institution" value={edu.institution} />
              <Row label="Degree" value={edu.degreeSpecialization} />
              <Row label="Year of Passing" value={edu.yearOfPassing} />
              <Row label="Score" value={edu.percentageOrCgpa} />
            </div>
          ))
        ) : (
          <Row label="Education" value="Not provided" />
        )}
      </ReviewSection>

      <ReviewSection title="4. Skills" stepNum={4}>
        {Array.isArray(skills) && skills.length > 0 ? (
          skills.map((entry, i) => (
            <Row key={i} label={entry.category || `Skill Set ${i + 1}`} value={entry.skills} />
          ))
        ) : (
          <Row label="Skills" value="Not provided" />
        )}
      </ReviewSection>

      <ReviewSection title="5. Job Preferences" stepNum={5}>
        <Row label="Job Type" value={JOB_TYPE_LABELS[application.preferredJobType]} />
        <Row label="Work Mode" value={WORK_MODE_LABELS[application.preferredWorkMode]} />
        <Row label="Department" value={application.preferredDepartment} />
        <Row label="Job Preference" value={application.roleOfInterest || '—'} />
        <Row label="Job Alerts" value={application.subscribeJobAlerts ? 'Subscribed' : 'Not subscribed'} />
      </ReviewSection>

      <ReviewSection title="6. Documents & Links" stepNum={6}>
        <Row label="Resume" value={application.resumeFileName || (application.resumeUrl ? 'Uploaded' : 'Not uploaded')} />
        <Row label="Portfolio" value={application.portfolioUrl || '—'} />
        <Row label="LinkedIn" value={application.linkedinUrl || '—'} />
        <Row label="GitHub" value={application.githubUrl || '—'} />
      </ReviewSection>

      {!isSubmitted && (
        <>
          <div className="consent-box" style={{ marginTop: 'var(--space-6)' }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} id="consent" />
            <label htmlFor="consent">
              I agree to the <strong>Privacy Policy &amp; Terms of Service (Version 1.0)</strong> and consent to my data being processed for recruitment purposes under the Digital Personal Data Protection Act, 2023 (DPDP Act).
            </label>
          </div>

          <div className="step-actions">
            <button type="button" className="btn btn-secondary" onClick={onPrev}>
              <ArrowLeft size={16} /> Previous
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={!consent || saving}
              onClick={handleSubmit}
            >
              {saving ? <div className="spinner" /> : <>Submit Application <Send size={16} /></>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
