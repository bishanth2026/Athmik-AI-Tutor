import React from 'react';
import {
  Calculator,
  FlaskConical,
  BookOpen,
  Languages,
  GraduationCap,
  Compass,
  Sparkles,
  Bookmark,
  Layers,
  Award,
  LucideProps,
} from 'lucide-react';

interface SubjectIconProps extends LucideProps {
  name: string;
}

export const SubjectIcon: React.FC<SubjectIconProps> = ({ name, ...props }) => {
  switch (name?.toLowerCase()) {
    case 'calculator':
    case 'mathematics':
    case 'maths':
      return <Calculator {...props} />;
    case 'flaskconical':
    case 'science':
    case 'evs':
      return <FlaskConical {...props} />;
    case 'bookopen':
    case 'english':
    case 'literature':
      return <BookOpen {...props} />;
    case 'languages':
    case 'hindi':
      return <Languages {...props} />;
    case 'graduationcap':
    case 'malayalam':
      return <GraduationCap {...props} />;
    case 'compass':
    case 'social science':
    case 'social':
      return <Compass {...props} />;
    case 'sparkles':
    case 'tutor':
      return <Sparkles {...props} />;
    case 'award':
      return <Award {...props} />;
    case 'layers':
      return <Layers {...props} />;
    default:
      return <Bookmark {...props} />;
  }
};
