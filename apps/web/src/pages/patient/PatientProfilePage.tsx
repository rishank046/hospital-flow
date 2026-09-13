import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { Spinner } from '../../components/common/Spinner';
import { patientService } from '../../services/patient.service';
import type { Gender, PatientProfile, PatientType } from '../../types/patient.types';

export function PatientProfilePage() {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [name, setName] = useState('');
  const [age, setAge] = useState<number>(0);
  const [gender, setGender] = useState<Gender>('Other');
  const [patientType, setPatientType] = useState<PatientType>('Online');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await patientService.getProfile();
      setProfile(data);
      setName(data.name || '');
      setAge(data.age || 0);
      setGender(data.gender || 'Other');
      setPatientType((data.patientType || data.patient_type || 'Online') as PatientType);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load profile details.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    patientService
      .getProfile()
      .then((data) => {
        if (!isMounted) return;
        setProfile(data);
        setName(data.name || '');
        setAge(data.age || 0);
        setGender(data.gender || 'Other');
        setPatientType((data.patientType || data.patient_type || 'Online') as PatientType);
      })
      .catch((err) => {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to load profile details.'
          );
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    setSaving(true);
    try {
      const parsedAge = Number(age);
      const updated = await patientService.updateProfile({
        name: name.trim(),
        age: parsedAge > 0 ? parsedAge : undefined,
        gender,
        patientType,
      });

      setProfile(updated);
      setSuccess('Profile updated successfully.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update profile.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      pageTitle="Patient Profile Settings"
      pageSubtitle="Update your personal health record details and care registration type."
    >
      {loading ? (
        <Spinner label="Loading profile information..." />
      ) : (
        <Card className="profile-edit-card max-w-2xl">
          {error && <Alert type="error" className="mb-4" onRetry={fetchProfile}>{error}</Alert>}
          {success && <Alert type="success" className="mb-4">{success}</Alert>}

          <form onSubmit={handleSubmit} className="profile-form">
            <Input
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Input
              label="Email Address"
              value={profile?.email || ''}
              disabled
              helperText="Email is bound to your login credentials."
            />

            <div className="form-row">
              <Input
                label="Age"
                type="number"
                min={0}
                max={130}
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                required
              />

              <div className="form-field">
                <label htmlFor="gender-select" className="form-label">Gender</label>
                <div className="input-wrap">
                  <select
                    id="gender-select"
                    className="form-input"
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Gender)}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="patient-type-select" className="form-label">
                Patient Registration Type
              </label>
              <div className="input-wrap">
                <select
                  id="patient-type-select"
                  className="form-input"
                  value={patientType}
                  onChange={(e) => setPatientType(e.target.value as PatientType)}
                >
                  <option value="Online">Online Consultation</option>
                  <option value="Walkin">Hospital Walk-in</option>
                </select>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={saving}
              className="mt-4"
            >
              Save Changes
            </Button>
          </form>
        </Card>
      )}
    </DashboardLayout>
  );
}
