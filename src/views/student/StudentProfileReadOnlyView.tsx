import React from 'react';
import { useApp } from '../../context/AppContext';
import { Button } from '../../components/common/Button';
import { School, Calendar, Globe, Sparkles, Shield, User } from 'lucide-react';

interface StudentProfileReadOnlyViewProps {
  onNavigate: (path: string) => void;
}

export const StudentProfileReadOnlyView: React.FC<StudentProfileReadOnlyViewProps> = ({
  onNavigate,
}) => {
  const { student, setRole } = useApp();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider block mb-1">
          Learner Details
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">My Profile</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Your personal student profile for CBSE Class 5 at Amrutha Public School.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-bold text-2xl flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
            {student.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{student.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Class {student.class} · {student.board} Board · AY {student.academic_year}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
              <School className="w-3.5 h-3.5" />
              <span>School</span>
            </span>
            <p className="font-bold text-slate-800">{student.school_name || 'Not provided'}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              <span>Language</span>
            </span>
            <p className="font-bold text-slate-800">{student.preferred_language}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 sm:col-span-2 space-y-1">
            <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Learning Style</span>
            </span>
            <p className="font-bold text-slate-800">{student.learning_preference}</p>
          </div>
        </div>

        {/* Parent Edit Notice */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-indigo-600 shrink-0" />
            <p className="text-xs text-slate-600">
              Need to change your school, name, or preferences? Your parent can edit these details in Parent Mode.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRole('parent');
              onNavigate('/parent/student');
            }}
          >
            Switch to Parent Mode
          </Button>
        </div>
      </div>
    </div>
  );
};
