"use client";
import './page.css';
import Revision from '../../components/Examprep';
import ProtectedRoute from '../../components/ProtectedRoute';

export default function RevisionPage() {
    return (
        <ProtectedRoute>
            <Revision />
        </ProtectedRoute>
    );
}

