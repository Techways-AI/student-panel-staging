
"use client";
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CourseContent from '../../../components/CourseContent';
import ProtectedRoute from '../../../components/ProtectedRoute';

export default function SubjectPage() {
  const params = useParams();
  const router = useRouter();
  const [subject, setSubject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSubjectData = async () => {
      try {
        setLoading(true);
        
        // Decode the subject name from URL
        const subjectName = decodeURIComponent(params.subject);
        console.log('🔍 Looking for subject:', subjectName);
        
        // Define available subjects with content
        const availableSubjects = {
          // Year 1 Semester 1
          'PS101: Human Anatomy and Physiology I': {
            title: 'PS101: Human Anatomy and Physiology I',
            code: 'PS101',
            name: 'Human Anatomy and Physiology I',
            fullTitle: 'PS101: Human Anatomy and Physiology I',
            yearSemester: '1-1',
            content: [],
            isFreeTrial: false
          },
          'PS102: Pharmaceutical Analysis I': {
            title: 'PS102: Pharmaceutical Analysis I',
            code: 'PS102',
            name: 'Pharmaceutical Analysis I',
            fullTitle: 'PS102: Pharmaceutical Analysis I',
            yearSemester: '1-1',
            content: [],
            isFreeTrial: false
          },
          'PS103: Pharmaceutics': {
            title: 'PS103: Pharmaceutics',
            code: 'PS103',
            name: 'Pharmaceutics',
            fullTitle: 'PS103: Pharmaceutics',
            yearSemester: '1-1',
            content: [],
            isFreeTrial: false
          },
          'PS104: Pharmaceutical Inorganic Chemistry': {
            title: 'PS104: Pharmaceutical Inorganic Chemistry',
            code: 'PS104',
            name: 'Pharmaceutical Inorganic Chemistry',
            fullTitle: 'PS104: Pharmaceutical Inorganic Chemistry',
            yearSemester: '1-1',
            content: [],
            isFreeTrial: false
          },
          'HS105: Communication skills': {
            title: 'HS105: Communication skills',
            code: 'HS105',
            name: 'Communication skills',
            fullTitle: 'HS105: Communication skills',
            yearSemester: '1-1',
            content: [],
            isFreeTrial: false
          },
          'BS106: Remedial Biology': {
            title: 'BS106: Remedial Biology',
            code: 'BS106',
            name: 'Remedial Biology',
            fullTitle: 'BS106: Remedial Biology',
            yearSemester: '1-1',
            content: [],
            isFreeTrial: false
          },
          
          // Year 1 Semester 2
          'PS201: Human Anatomy and Physiology II': {
            title: 'PS201: Human Anatomy and Physiology II',
            code: 'PS201',
            name: 'Human Anatomy and Physiology II',
            fullTitle: 'PS201: Human Anatomy and Physiology II',
            yearSemester: '1-2',
            content: [],
            isFreeTrial: false
          },
          'PS202: Pharmaceutical Organic Chemistry-I': {
            title: 'PS202: Pharmaceutical Organic Chemistry-I',
            code: 'PS202',
            name: 'Pharmaceutical Organic Chemistry-I',
            fullTitle: 'PS202: Pharmaceutical Organic Chemistry-I',
            yearSemester: '1-2',
            content: [],
            isFreeTrial: false
          },
          'BS203: Biochemistry': {
            title: 'BS203: Biochemistry',
            code: 'BS203',
            name: 'Biochemistry',
            fullTitle: 'BS203: Biochemistry',
            yearSemester: '1-2',
            content: [],
            isFreeTrial: false
          },
          'BS204: Pathophysiology': {
            title: 'BS204: Pathophysiology',
            code: 'BS204',
            name: 'Pathophysiology',
            fullTitle: 'BS204: Pathophysiology',
            yearSemester: '1-2',
            content: [],
            isFreeTrial: false
          },
          'CS205: Computer Applications in Pharmacy': {
            title: 'CS205: Computer Applications in Pharmacy',
            code: 'CS205',
            name: 'Computer Applications in Pharmacy',
            fullTitle: 'CS205: Computer Applications in Pharmacy',
            yearSemester: '1-2',
            content: [],
            isFreeTrial: false
          },
          
          // Legacy mappings for backward compatibility
          'PS11': {
            title: 'PS101: Human Anatomy and Physiology I',
            code: 'PS101',
            name: 'Human Anatomy and Physiology I',
            fullTitle: 'PS101: Human Anatomy and Physiology I',
            yearSemester: '1-1',
            content: [],
            isFreeTrial: false
          },
          'PS12': {
            title: 'CS205: Computer Applications in Pharmacy',
            code: 'CS205',
            name: 'Computer Applications in Pharmacy',
            fullTitle: 'CS205: Computer Applications in Pharmacy',
            yearSemester: '1-2',
            content: [],
            isFreeTrial: false
          }
        };
        
        // Handle specific redirects for subjects without content
        const redirects = {
          'Pharmaceutical Inorganic Chemistry lab': '/course',
          'PS111: Pharmaceutical Inorganic Chemistry lab': '/course',
          'PS104: Pharmaceutical Inorganic Chemistry': '/course',
          'Pharmacy': '/course',
          'Introduction to Pharmacy': '/course'
        };
        
        // Check if this is a redirect case
        if (redirects[subjectName]) {
          console.log('🔄 Redirecting to:', redirects[subjectName]);
          router.push(redirects[subjectName]);
          return;
        }
        
        // Check if the subject exists
        if (availableSubjects[subjectName]) {
          setSubject(availableSubjects[subjectName]);
        } else {
          // Redirect to main course page if subject not found
          console.log('❌ Subject not found, redirecting to course page');
          router.push('/course');
          return;
        }
      } catch (error) {
        console.error('Error fetching subject data:', error);
        setError('Failed to load subject data');
      } finally {
        setLoading(false);
      }
    };

    fetchSubjectData();
  }, [params.subject, router]);

  if (loading) {
    return (
      <ProtectedRoute>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          fontSize: '1.2em',
          color: '#666'
        }}>
          Loading subject...
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          fontSize: '1.2em',
          color: '#e74c3c'
        }}>
          {error}
        </div>
      </ProtectedRoute>
    );
  }

  if (!subject) {
    return (
      <ProtectedRoute>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          fontSize: '1.2em',
          color: '#e74c3c'
        }}>
          Subject not found. Redirecting to course page...
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <CourseContent 
        subject={subject} 
        onBack={() => router.push('/course')} 
      />
    </ProtectedRoute>
  );
} 