import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Health from "./pages/Health";
import Budget from "./pages/Budget";
import Decisions from "./pages/Decisions";
import Retirement from "./pages/Retirement";
import StudentLoan from "./pages/StudentLoan";
import Chat from "./pages/Chat";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Health />} />
        <Route path="budget" element={<Budget />} />
        <Route path="decisions" element={<Decisions />} />
        <Route path="retirement" element={<Retirement />} />
        <Route path="student-loan" element={<StudentLoan />} />
        <Route path="chat" element={<Chat />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
