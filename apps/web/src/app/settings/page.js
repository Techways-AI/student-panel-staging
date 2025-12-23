"use client";
import MySettings from '../../components/Settings';
import ProtectedRoute from '../../components/ProtectedRoute';

export default function ProfilePage() {
    return (
        <ProtectedRoute>
            <MySettings />
        </ProtectedRoute>
    );
}

