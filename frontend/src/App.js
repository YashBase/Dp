import React, { Suspense, lazy } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Protected from "@/components/Protected";

const Landing = lazy(() => import("@/pages/Landing"));
const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const PublicResult = lazy(() => import("@/pages/PublicResult"));

const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminStudents = lazy(() => import("@/pages/admin/Students"));
const AdminQuestions = lazy(() => import("@/pages/admin/Questions"));
const AdminExams = lazy(() => import("@/pages/admin/Exams"));
const AdminResults = lazy(() => import("@/pages/admin/Results"));
const AdminPayments = lazy(() => import("@/pages/admin/Payments"));
const AdminEvaluation = lazy(() => import("@/pages/admin/Evaluation"));
const AdminCourses = lazy(() => import("@/pages/admin/Courses"));
const AdminTestSeries = lazy(() => import("@/pages/admin/TestSeries"));
const AdminSettings = lazy(() => import("@/pages/admin/Settings"));
const AdminBatches = lazy(() => import("@/pages/admin/Batches"));
const AdminTeachers = lazy(() => import("@/pages/admin/Teachers"));
const AdminAttendance = lazy(() => import("@/pages/admin/Attendance"));
const AdminNotifications = lazy(() => import("@/pages/admin/Notifications"));
const AdminStudyMaterial = lazy(() => import("@/pages/admin/StudyMaterial"));

const StudentLayout = lazy(() => import("@/pages/student/StudentLayout"));
const StudentDashboard = lazy(() => import("@/pages/student/StudentDashboard"));
const StudentExams = lazy(() => import("@/pages/student/Exams"));
const StudentCourses = lazy(() => import("@/pages/student/Courses"));
const CourseDetail = lazy(() => import("@/pages/student/CourseDetail"));
const StudentTestSeries = lazy(() => import("@/pages/student/TestSeries"));
const StudentPurchases = lazy(() => import("@/pages/student/MyPurchases"));
const ExamPortal = lazy(() => import("@/pages/student/ExamPortal"));
const Result = lazy(() => import("@/pages/student/Result"));
const StudentProfile = lazy(() => import("@/pages/student/Profile"));

function Fallback() {
  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      <span className="mono text-sm">Loading…</span>
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/r/:attemptId" element={<PublicResult />} />

            <Route
              path="/admin"
              element={<Protected role="admin"><AdminLayout /></Protected>}
            >
              <Route index element={<AdminDashboard />} />
              <Route path="students" element={<AdminStudents />} />
              <Route path="teachers" element={<AdminTeachers />} />
              <Route path="batches" element={<AdminBatches />} />
              <Route path="questions" element={<AdminQuestions />} />
              <Route path="exams" element={<AdminExams />} />
              <Route path="attendance" element={<AdminAttendance />} />
              <Route path="study-material" element={<AdminStudyMaterial />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="results" element={<AdminResults />} />
              <Route path="results/:attemptId" element={<AdminResults />} />
              <Route path="evaluation" element={<AdminEvaluation />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="courses" element={<AdminCourses />} />
              <Route path="test-series" element={<AdminTestSeries />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            <Route
              path="/app"
              element={<Protected role="student"><StudentLayout /></Protected>}
            >
              <Route index element={<StudentDashboard />} />
              <Route path="exams" element={<StudentExams />} />
              <Route path="courses" element={<StudentCourses />} />
              <Route path="courses/:id" element={<CourseDetail />} />
              <Route path="test-series" element={<StudentTestSeries />} />
              <Route path="purchases" element={<StudentPurchases />} />
              <Route path="profile" element={<StudentProfile />} />
              <Route path="result/:attemptId" element={<Result />} />
            </Route>

            <Route
              path="/exam/:attemptId"
              element={<Protected role="student"><ExamPortal /></Protected>}
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </div>
  );
}

export default App;
