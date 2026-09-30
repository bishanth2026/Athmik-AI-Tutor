import React from 'react';
import { Student } from '../../types';
import { Button } from '../common/Button';
import { User, School, Calendar, Globe, Sparkles, Edit2 } from 'lucide-react';

interface StudentCardProps {
  student: Student;
  onEdit: () => void;
}

export const StudentCard: React.FC<StudentCardProps> = ({ student, onEdit }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-bold text-xl flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
            {student.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">{student.name}</h2>
              <span className="text-xs text-indigo-700 bg-indigo-50 font-medium px-2 py-0.5 rounded-md">
                Active Student
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 mt-0.5">
              <span>Class {student.class}</span>
              <span aria-hidden="true">·</span>
              <span>{student.board} Board</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">AY {student.academic_year}</span>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" icon={<Edit2 className="w-3.5 h-3.5" />} onClick={onEdit}>
          Edit Profile
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-5 text-xs sm:text-sm">
        <div className="flex items-start gap-2.5">
          <School className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <span className="text-slate-400 text-xs block">School</span>
            <span className="font-medium text-slate-800 truncate block">
              {student.school_name || 'Not specified'}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <Globe className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <span className="text-slate-400 text-xs block">Preferred Language</span>
            <span className="font-medium text-slate-800">{student.preferred_language}</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 sm:col-span-2 lg:col-span-1">
          <Sparkles className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <span className="text-slate-400 text-xs block">Learning Preference</span>
            <span className="font-medium text-slate-800 truncate block">
              {student.learning_preference}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
