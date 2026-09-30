import React, { useState } from 'react';
import { Subject } from '../../types';
import { useApp } from '../../context/AppContext';
import { subjectService } from '../../services/subjectService';
import { SubjectIcon } from '../common/SubjectIcon';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { FormField } from '../common/FormField';
import { Plus, Edit3, Trash2, CheckCircle2, XCircle } from 'lucide-react';

interface SubjectManagerProps {
  onSelectSubject?: (subjectId: string) => void;
}

export const SubjectManager: React.FC<SubjectManagerProps> = ({ onSelectSubject }) => {
  const { subjects, refreshData, getSubjectProgress } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'BookOpen',
    class: '5',
    board: 'CBSE',
    display_order: 1,
    active: true,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingSubject(null);
    setFormData({
      name: '',
      description: '',
      icon: 'BookOpen',
      class: '5',
      board: 'CBSE',
      display_order: subjects.length + 1,
      active: true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (subject: Subject) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name,
      description: subject.description,
      icon: subject.icon,
      class: subject.class,
      board: subject.board,
      display_order: subject.display_order,
      active: subject.active,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleToggleActive = (e: React.MouseEvent, subjectId: string) => {
    e.stopPropagation();
    subjectService.toggleActive(subjectId);
    refreshData();
  };

  const handleDelete = (e: React.MouseEvent, subjectId: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to remove this subject? Associated chapters will also be removed.')) {
      subjectService.deleteSubject(subjectId);
      refreshData();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Subject name is required.');
      return;
    }

    const payload = {
      ...(editingSubject ? { id: editingSubject.id } : {}),
      name: formData.name.trim(),
      description: formData.description.trim(),
      icon: formData.icon,
      class: formData.class,
      board: formData.board,
      display_order: Number(formData.display_order) || 1,
      active: formData.active,
    };

    const result = subjectService.saveSubject(payload);
    if (!result.success) {
      setFormError(result.error || 'Failed to save subject.');
      return;
    }

    refreshData();
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Configured Subjects</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Enable or disable subjects for Athmik. Only active subjects are visible on the student dashboard.
          </p>
        </div>
        <Button variant="primary" size="md" icon={<Plus className="w-4 h-4" />} onClick={openAddModal}>
          Add Subject
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map((sub) => {
          const stat = getSubjectProgress(sub.id);

          return (
            <div
              key={sub.id}
              onClick={() => onSelectSubject && onSelectSubject(sub.id)}
              className={`bg-white rounded-2xl border p-5 transition-all cursor-pointer ${
                sub.active
                  ? 'border-slate-200 hover:border-indigo-300 hover:shadow-sm'
                  : 'border-slate-200/60 bg-slate-50/60 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    sub.active ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  <SubjectIcon name={sub.icon} className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Status Toggle Button */}
                  <button
                    onClick={(e) => handleToggleActive(e, sub.id)}
                    className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                      sub.active
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                    title={sub.active ? 'Click to disable for student' : 'Click to enable for student'}
                  >
                    {sub.active ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Disabled</span>
                      </>
                    )}
                  </button>
                  {/* Edit Action */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(sub);
                    }}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                    title="Edit subject"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <h3 className="text-base font-bold text-slate-900 mb-1">{sub.name}</h3>
              <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                {sub.description || 'No description provided.'}
              </p>

              {/* Progress and chapter metadata */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>{stat.total_chapters} {stat.total_chapters === 1 ? 'Chapter' : 'Chapters'}</span>
                <span className="font-mono tabular-nums text-slate-700">
                  {stat.completed_chapters}/{stat.total_chapters} completed
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSubject ? 'Edit Subject' : 'Add Subject'}
        description="Configure curriculum subject details for Class 5 CBSE."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
              {formError}
            </div>
          )}

          <FormField
            label="Subject Name"
            name="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Mathematics or Computer Science"
            required
          />

          <FormField
            label="Description"
            name="description"
            type="textarea"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Curriculum learning scope and syllabus notes..."
            rows={2}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Icon"
              name="icon"
              type="select"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              options={[
                { value: 'BookOpen', label: 'Book (Literature/Reading)' },
                { value: 'Calculator', label: 'Calculator (Mathematics)' },
                { value: 'FlaskConical', label: 'Flask (Science/EVS)' },
                { value: 'Languages', label: 'Languages (Hindi/Languages)' },
                { value: 'GraduationCap', label: 'Cap (Malayalam/Regional)' },
                { value: 'Compass', label: 'Compass (Social Studies)' },
                { value: 'Sparkles', label: 'Sparkles (General/AI)' },
              ]}
            />

            <FormField
              label="Display Order"
              name="display_order"
              type="number"
              value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: Number(e.target.value) })}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <label htmlFor="active" className="text-xs font-medium text-slate-700">
              Active (Visible on Student Dashboard)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              {editingSubject ? 'Save Changes' : 'Create Subject'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
