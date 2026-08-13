import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Chat from "./pages/Chat.jsx";
import Groups from "./pages/Groups.jsx";
import GroupChat from "./pages/GroupChat.jsx";
import { useAuth } from "./context/useAuth.js";

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/chat"
        element={user ? <Chat /> : <Navigate to="/login" />}
      />
      <Route
        path="/groups"
        element={user ? <Groups /> : <Navigate to="/login" />}
      />
      <Route
        path="/groups/:groupId"
        element={user ? <GroupChat /> : <Navigate to="/login" />}
      />
      <Route path="/" element={<Navigate to={user ? "/chat" : "/login"} />} />
    </Routes>
  );
}

export default App;
