import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "./lib/WalletContext";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Home } from "./pages/Home";
import { Register } from "./pages/Register";
import { Browse } from "./pages/Browse";
import { Donate } from "./pages/Donate";

export default function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/donate" element={<Donate />} />
        </Routes>
        <Footer />
      </BrowserRouter>
    </WalletProvider>
  );
}
