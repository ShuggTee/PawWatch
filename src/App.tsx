import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./components/AuthContext";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Sitters from "./pages/Sitters";
import Book from "./pages/Book";
import Bookings from "./pages/Bookings";
import BookingDetail from "./pages/BookingDetail";
import SitterDashboard from "./pages/SitterDashboard";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import BecomeSitter from "./pages/BecomeSitter";
import Dogs from "./pages/Dogs";
import Track from "./pages/Track";

export default function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/track" element={<Track />} />
          <Route path="/sitters" element={<Sitters />} />
          <Route path="/book/:sitterId" element={<Book />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/booking/:bookingId" element={<BookingDetail />} />
          <Route path="/sitter-dashboard" element={<SitterDashboard />} />
          <Route path="/dogs" element={<Dogs />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/become-a-sitter" element={<BecomeSitter />} />
        </Routes>
      </Layout>
    </AuthProvider>
  );
}
