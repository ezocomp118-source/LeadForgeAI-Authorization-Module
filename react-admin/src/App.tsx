import { QueryClientProvider } from "@tanstack/react-query";
import type { FC, ReactElement } from "react";
import { useState } from "react";

import { AdminInvitationsApp } from "./AdminApp.js";
import { LoginForm } from "./components/auth/LoginForm.js";
import { RegisterForm } from "./components/auth/RegisterForm.js";
import { useAuth } from "./hooks/useAuth.js";
import { queryClient } from "./lib/queryClient.js";
import "./styles.css";

const AuthGate: FC = () => {
  const { isLoading, isAuthenticated } = useAuth();
  const [showRegister, setShowRegister] = useState(false);

  if (isLoading) {
    return (
      <main className="register-page">
        <div className="card">
          <p className="eyebrow">Authorization Module</p>
          <h2>Checking authentication…</h2>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="register-page">
        <header className="hero" style={{ marginBottom: 8 }}>
          <div>
            <p className="eyebrow">Authorization Module</p>
            <h1>Sign in or register</h1>
            <p className="subtitle">
              Session-aware auth flow with diagnostic logging.
            </p>
          </div>
        </header>
        {showRegister
          ? (
            <RegisterForm
              onSwitchToLogin={() => {
                setShowRegister(false);
              }}
            />
          )
          : (
            <LoginForm
              onSwitchToRegister={() => {
                setShowRegister(true);
              }}
            />
          )}
      </main>
    );
  }

  return <AdminInvitationsApp />;
};

export const App: FC = (): ReactElement => (
  <QueryClientProvider client={queryClient}>
    <AuthGate />
  </QueryClientProvider>
);
