import React, { useState, useMemo } from 'react';
import { Chapter } from '../../types';
import { useApp } from '../../context/AppContext';
import { chapterService } from '../../services/chapterService';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { FormField } from '../common/FormField';
import { SubjectIcon } from '../common/SubjectIcon';
import {
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  Info,
  BookOpen,
} from 'lucide-react';

interface ChapterManagerProps {
  initialSubjectId?: string;
}

export const ChapterManager: React.FC<ChapterManagerProps> = ({ initialSubjectId }) => {
  const { subjects, chapters, refreshData } = useApp();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    initialSubjectId || (subjects.length > 0 ? subjects[0].id : '')
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [formData, setFormData] = useState({
    subject_id: selectedSubjectId,
    chapter_number: 1,
    chapter_name: '',
    description: '',
    active: true,
    display_order: 1,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const currentSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId) || subjects[0];
  }, [subjects, selectedSubjectId]);

  const subjectChapters = useMemo(() => {
    if (!currentSubject) return [];
    return chapters
      .filter((c) => c.subject_id === currentSubject.id)
      .sort((a, b) => a.chapter_number - b.chapter_number);
  }, [chapters, currentSubject]);

  const openAddModal = () => {
    setEditingChapter(null);
    const nextNum =
      subjectChapters.length > 0
        ? Math.max(...subjectChapters.map((c) => c.chapter_number)) + 1
        : 1;

    setFormData({
      subject_id: currentSubject.id,
      chapter_number: nextNum,
      chapter_name: '',
      description: '',
      active: true,
      display_order: nextNum,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (chapter: Chapter) => {
    setEditingChapter(chapter);
    setFormData({
      subject_id: chapter.subject_id,
      chapter_number: chapter.chapter_number,
      chapter_name: chapter.chapter_name,
      description: chapter.description,
      active: chapter.active,
      display_order: chapter.display_order,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleToggleActive = (chapterId: string) => {
    chapterService.toggleActive(chapterId);
    refreshData();
  };

  const handleDelete = (chapterId: string) => {
    if (window.confirm('Are you sure you want to delete this chapter? Learning progress records for this chapter will also be removed.')) {
      chapterService.deleteChapter(chapterId);
      refreshData();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.chapter_name.trim()) {
      setFormError('Chapter name is required.');
      return;
    }

    const payload = {
      ...(editingChapter ? { id: editingChapter.id } : {}),
      subject_id: currentSubject.id,
      chapter_number: Number(formData.chapter_number) || 1,
      chapter_name: formData.chapter_name.trim(),
      description: formData.description.trim(),
      active: formData.active,
      display_order: Number(formData.display_order) || 1,
    };

    const result = chapterService.saveChapter(payload);
    if (!result.success) {
      setFormError(result.error || 'Failed to save chapter.');
      return;
    }

    refreshData();
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Subject Filter Bar / Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Chapter Management</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Select a subject to view and configure textbook chapters.
            </p>
          </div>
          {currentSubject && (
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4" />}
              onClick={openAddModal}
            >
              Add Chapter
            </Button>
          )}
        </div>

        {/* Horizontal interactive subject buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {subjects.map((s) => {
            const isSelected = s.id === currentSubject?.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSubjectId(s.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <SubjectIcon name={s.icon} className="w-4 h-4 shrink-0" />
                <span>{s.name}</span>
                {!s.active && <span className="text-[10px] opacity-75">(Inactive)</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Curriculum Source Transparency Banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 flex items-start gap-3 text-xs sm:text-sm text-amber-900">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-950">Curriculum Textbook Notice</p>
          <p className="text-amber-800 leading-relaxed text-xs">
            Initial chapters shown below are clearly marked sample CBSE curriculum chapters. As a parent,
            you can add, rename, or import the exact chapters from Athmik&apos;s school textbook (Amrutha Public School)
            using the <strong>&ldquo;Add Chapter&rdquo;</strong> button above.
          </p>
        </div>
      </div>

      {/* Chapter List */}
      {subjectChapters.length === 0 ? (
        <div className="text-center p-8 bg-white rounded-2xl border border-dashed border-slate-200">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-800">No chapters configured</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            No chapters have been added for {currentSubject?.name || 'this subject'} yet.
          </p>
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openAddModal}>
            Add First Chapter
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {subjectChapters.map((chapter) => (
            <div
              key={chapter.id}
              className={`bg-white rounded-xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                chapter.active ? 'border-slate-200 hover:border-slate-300' : 'border-slate-200/60 bg-slate-50/60 opacity-75'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 font-mono tabular-nums font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {chapter.chapter_number}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">
                      Chapter {chapter.chapter_number}
                    </span>
                    {!chapter.active && (
                      <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                        Hidden
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    {chapter.chapter_name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                    {chapter.description || 'No description provided.'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  onClick={() => handleToggleActive(chapter.id)}
                  className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                    chapter.active
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                  title={chapter.active ? 'Click to disable' : 'Click to enable'}
                >
                  {chapter.active ? (
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

                <button
                  onClick={() => openEditModal(chapter)}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                  title="Edit chapter"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleDelete(chapter.id)}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                  title="Delete chapter"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Chapter Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingChapter ? 'Edit Chapter' : `Add Chapter to ${currentSubject?.name || 'Subject'}`}
        description="Enter chapter details matching Athmik's CBSE Class 5 curriculum."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <FormField
                label="Chapter No."
                name="chapter_number"
                type="number"
                value={formData.chapter_number}
                onChange={(e) => setFormData({ ...formData, chapter_number: Number(e.target.value) })}
                required
              />
            </div>
            <div className="col-span-2">
              <FormField
                label="Chapter Name / Title"
                name="chapter_name"
                value={formData.chapter_name}
                onChange={(e) => setFormData({ ...formData, chapter_name: e.target.value })}
                placeholder="e.g. The Fish Tale or Shapes and Angles"
                required
              />
            </div>
          </div>

          <FormField
            label="Curriculum Description / Key Concepts"
            name="description"
            type="textarea"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Key concepts, syllabus topics covered in class..."
            rows={3}
          />

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="chapter-active"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <label htmlFor="chapter-active" className="text-xs font-medium text-slate-700">
              Active (Visible in student learning dashboard)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              {editingChapter ? 'Save Changes' : 'Create Chapter'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
