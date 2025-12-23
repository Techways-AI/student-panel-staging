"use client";
import './page.css';
import MySchedule from '../../components/MySchedule';
import ProtectedRoute from '../../components/ProtectedRoute';

export default function TimetablePage() {
    return (
        <ProtectedRoute>
            <MySchedule />
        </ProtectedRoute>
    );
}

