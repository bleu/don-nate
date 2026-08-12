import { Link, NavLink } from "react-router-dom";
import { useWallet } from "../lib/WalletContext";
import { truncateAddress } from "../lib/format";

export function Header() {
  const { address, connecting, connect, disconnect } = useWallet();

  return (
    <header className="site">
      <Link to="/" className="wordmark">
        Don <em>Nate</em>
      </Link>
      <nav className="site">
        <NavLink to="/browse" className={({ isActive }) => (isActive ? "active" : "")}>
          Browse
        </NavLink>
        <NavLink to="/register" className={({ isActive }) => (isActive ? "active" : "")}>
          Register
        </NavLink>
        {address ? (
          <button className="link" onClick={() => void disconnect()} title={address}>
            {truncateAddress(address)} — disconnect
          </button>
        ) : (
          <button className="link" onClick={() => void connect()} disabled={connecting}>
            {connecting ? "Connecting…" : "Connect wallet"}
          </button>
        )}
      </nav>
    </header>
  );
}
