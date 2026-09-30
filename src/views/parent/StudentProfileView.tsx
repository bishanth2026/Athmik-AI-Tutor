import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { studentService, StudentValidationErrors } from '../../services/studentService';
import { FormField } from '../../components/common/FormField';
import { Button } from '../../components/common/Button';
import { CheckCircle2, User, Save, RotateCcw, AlertCircle } from 'lucide-react';

export const StudentProfileView: React.FC = () => {
  const { student, refreshData } = useApp();

  const [formData, setFormData] = useState({
    name: student.name,
    class: student.class,
    board: student.board,
    academic_year: student.academic_year,
    school_name: student.school_name,
    date_of_birth: student.date_of_birth,
    profile_photo_url: student.profile_photo_url || '',
    preferred_language: student.preferred_language,
    learning_preference: student.learning_preference,
  });

  const [errors, setErrors] = useState<StudentValidationErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof StudentValidationErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage(null);

    const result = studentService.updateProfile(formData);

    setIsSaving(false);
    if (!result.success && result.errors) {
      setErrors(result.errors);
    } else if (result.success) {
      refreshData();
      setSuccessMessage('Student profile updated successfully and persisted to storage!');
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  const handleResetToCurrent = () => {
    setFormData({
      name: student.name,
      class: student.class,
      board: student.board,
      academic_year: student.academic_year,
      school_name: student.school_name,
      date_of_birth: student.date_of_birth,
      profile_photo_url: student.profile_photo_url || '',
      preferred_language: student.preferred_language,
      learning_preference: student.learning_preference,
    });
    setErrors({});
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div>
        <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider block mb-1">
          Profile Configuration
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Student Profile</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage Athmik&apos;s academic details, school info, and personal learning preferences.
        </p>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {Object.keys(errors).length > 0 && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>Please review and correct the required fields highlighted below.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs">
        {/* Avatar / Profile Graphic */}
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-bold text-2xl flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
            {formData.name.charAt(0) || 'A'}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{formData.name || 'Student Name'}</h3>
            <p className="text-xs text-slate-500">
              Class {formData.class} · {formData.board} · Academic Year {formData.academic_year}
            </p>
          </div>
        </div>

        {/* Section 1: Core Academic Information */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Academic Information
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Student Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              error={errors.name}
              placeholder="e.g. Athmik"
              required
            />

            <FormField
              label="Class / Grade"
              name="class"
              value={formData.class}
              onChange={handleChange}
              error={errors.class}
              placeholder="e.g. 5"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Educational Board"
              name="board"
              value={formData.board}
              onChange={handleChange}
              error={errors.board}
              placeholder="e.g. CBSE"
              required
            />

            <FormField
              label="Academic Year"
              name="academic_year"
              value={formData.academic_year}
              onChange={handleChange}
              error={errors.academic_year}
              placeholder="e.g. 2026-27"
              required
            />
          </div>
        </div>

        {/* Section 2: School & Personal Details */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            School & Personal Details
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="School Name"
              name="school_name"
              value={formData.school_name}
              onChange={handleChange}
              placeholder="e.g. Amrutha Public School, Vatakara"
              hint="Optional"
            />

            <FormField
              label="Date of Birth"
              name="date_of_birth"
              type="date"
              value={formData.date_of_birth}
              onChange={handleChange}
              hint="Optional"
            />
          </div>
        </div>

        {/* Section 3: Learning Preferences */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Learning Preferences & Tutoring Config
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Preferred Language"
              name="preferred_language"
              type="select"
              value={formData.preferred_language}
              onChange={handleChange}
              error={errors.preferred_language}
              options={[
                { value: 'English', label: 'English' },
                { value: 'Malayalam', label: 'Malayalam' },
                { value: 'Hindi', label: 'Hindi' },
                { value: 'Bilingual (English + Malayalam)', label: 'Bilingual (English + Malayalam)' },
              ]}
              required
            />

            <FormField
              label="Learning Preference"
              name="learning_preference"
              type="select"
              value={formData.learning_preference}
              onChange={handleChange}
              error={errors.learning_preference}
              options={[
                {
                  value: 'Visual + Explanation + Practice',
                  label: 'Visual + Explanation + Practice (Recommended)',
                },
                {
                  value: 'Storytelling + Conceptual Examples',
                  label: 'Storytelling + Conceptual Examples',
                },
                {
                  value: 'Interactive Q&A + Socratic Hints',
                  label: 'Interactive Q&A + Socratic Hints',
                },
                {
                  value: 'Bite-Sized Bullet Notes + Drills',
                  label: 'Bite-Sized Bullet Notes + Drills',
                },
              ]}
              required
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="md"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={handleResetToCurrent}
          >
            Discard Changes
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            icon={<Save className="w-4 h-4" />}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </form>
    </div>
  );
};
