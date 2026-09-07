import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import api from '../services/api';
import StepPersonal from '../components/steps/StepPersonal';
import StepProfessional from '../components/steps/StepProfessional';
import StepEducation from '../components/steps/StepEducation';
import StepSkills from '../components/steps/StepSkills';
import StepPreferences from '../components/steps/StepPreferences';
import StepDocuments from '../components/steps/StepDocuments';
import StepReview from '../components/steps/StepReview';
import { User, Briefcase, GraduationCap, Wrench, Heart, FileText, CheckCircle, ArrowLeft } from 'lucide-react';
import './ApplicationForm.css';

const STEPS = [
  { label: 'Personal Details', icon: User },
  { label: 'Professional Profile', icon: Briefcase },
  { label: 'Education', icon: GraduationCap },
  { label: 'Skills', icon: Wrench },
  { label: 'Job Preferences', icon: Heart },
  { label: 'Documents & Links', icon: FileText },
  { label: 'Review & Submit', icon: CheckCircle },
];

export default function ProfileForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showEditWarning, setShowEditWarning] = useState(false);
  const [pendingStepData, setPendingStepData] = useState(null);
  const [hasAcknowledgedWarning, setHasAcknowledgedWarning] = useState(false);

  useEffect(() => {
    initProfile();
  }, []);

  const initProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/profile');
      setProfile(res.data.profile);
      if (res.data.profile.isComplete) {
        setCurrentStep(7);
      } else {
        setCurrentStep(Math.min(res.data.profile.currentStep || 1, 7));
      }
    } catch (err) {
      toast.error('Failed to initialize profile.');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const saveStep = async (stepNum, data) => {
    if (!profile) return;
    setSaving(true);
    try {
      const res = await api.put(`/profile/step/${stepNum}`, data);
      setProfile(res.data.profile);
      toast.success('Step saved successfully!');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save step.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async (data) => {
    if (profile?.isComplete && !hasAcknowledgedWarning) {
      setPendingStepData(data);
      setShowEditWarning(true);
      return;
    }
    proceedWithSaveAndNext(data);
  };

  const proceedWithSaveAndNext = async (data) => {
    const saved = await saveStep(currentStep, data);
    if (saved && currentStep < 7) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const confirmEditWarning = () => {
    setHasAcknowledgedWarning(true);
    setShowEditWarning(false);
    if (pendingStepData) {
      proceedWithSaveAndNext(pendingStepData);
      setPendingStepData(null);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleGoToStep = (step) => {
    if (step <= (profile?.currentStep || 1) || step <= currentStep) {
      setCurrentStep(step);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (data) => {
    setSaving(true);
    try {
      const res = await api.put(`/profile/step/7`, { 
        ...data, 
        dpdpConsent: true, 
        termsVersionId: data?.termsVersionId || 'v1.0' 
      });
      toast.success('Profile completed successfully!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit application.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="container" style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
          <div className="spinner spinner-lg" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const stepProps = {
    application: profile,
    saving,
    onNext: handleNext,
    onPrev: handlePrev,
    onSubmit: handleSubmit,
    onGoToStep: handleGoToStep,
  };

  return (
    <div className="page-wrapper">
      <div className="container">
        {profile?.isComplete && (
          <button 
            className="btn btn-ghost" 
            onClick={() => navigate('/dashboard')}
            style={{ marginBottom: '20px', padding: 0 }}
          >
            <ArrowLeft size={16} style={{ marginRight: '8px' }} /> Back to Dashboard
          </button>
        )}

        {/* Stepper */}
        <div className="stepper animate-fadeIn" style={{ justifyContent: 'center' }}>
          {STEPS.map((step, index) => {
            const stepNum = index + 1;
            const Icon = step.icon;
            const isActive = currentStep === stepNum;
            const isCompleted = currentStep > stepNum || profile.isComplete;
            const isClickable = profile.isComplete || stepNum <= (profile?.currentStep || 1) || stepNum <= currentStep;

            return (
              <div key={stepNum} className="stepper-item-wrapper">
                <button
                  className={`stepper-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isClickable ? 'clickable' : ''}`}
                  onClick={() => isClickable && handleGoToStep(stepNum)}
                  disabled={!isClickable}
                >
                  <div className="stepper-circle" style={{ transform: isActive ? 'scale(1.2)' : 'scale(1)' }}>
                    {isCompleted ? <CheckCircle size={22} /> : <Icon size={22} />}
                  </div>
                  <span className="stepper-label" style={{ fontSize: isActive ? '1.1rem' : '0.9rem', fontWeight: isActive ? '600' : '500' }}>
                    {step.label}
                  </span>
                </button>
                {index < STEPS.length - 1 && (
                  <div className={`stepper-line ${isCompleted ? 'completed' : ''}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="step-content animate-fadeIn">
          {currentStep === 1 && <StepPersonal {...stepProps} />}
          {currentStep === 2 && <StepProfessional {...stepProps} />}
          {currentStep === 3 && <StepEducation {...stepProps} />}
          {currentStep === 4 && <StepSkills {...stepProps} />}
          {currentStep === 5 && <StepPreferences {...stepProps} />}
          {currentStep === 6 && <StepDocuments {...stepProps} />}
          {currentStep === 7 && <StepReview {...stepProps} />}
        </div>
      </div>

      {/* Edit Warning Modal */}
      {showEditWarning && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <h2 style={{ marginTop: 0, fontSize: '1.25rem' }}>Important Notice</h2>
            <p style={{ marginTop: '12px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              Any edited details will also reflect on the applications you have already submitted, as well as any future applications.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button 
                className="btn btn-ghost" 
                onClick={() => {
                  setShowEditWarning(false);
                  setPendingStepData(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={confirmEditWarning}
              >
                Got it, Save & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
