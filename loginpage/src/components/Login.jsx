import React from "react";
import { useState } from "react";

export default function Login({ onAuth }) {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { fetchJson } = await import("../lib/fetchJson.js");
      const data = await fetchJson(`/api/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      setMessage({
        type: "success",
        text: data?.message || `${mode} successful`,
      });
      if (onAuth) {
        // Auto-authenticate on both login and register so the navbar becomes visible
        onAuth(data);
      }
    } catch (err) {
      const msg = err?.message || "Something went wrong";
      setMessage({
        type: "error",
        text: msg,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-fluid d-flex align-items-start bg-light">
      <div className="container my-4 p-0 border border-1 border-secondary rounded-3 overflow-hidden">
        <div className="row g-0 justify-content-center align-items-stretch">
          {/* Left decorative image (hidden on small screens) */}
          <div className="col-lg-3 d-none d-lg-block">
            <div className="h-100 overflow-hidden shadow-sm">
              <img
                src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1200&auto=format&fit=crop"
                alt="Decorative"
                className="w-100 h-100"
                style={{ objectFit: "cover" }}
              />
            </div>
          </div>

          {/* Center card with form */}
          <div className="col-12 col-md-8 col-lg-6 d-flex">
            <div className="card shadow-sm h-100 border-0 rounded-0 flex-fill">
              <div className="card-body p-4 p-md-5 d-flex flex-column justify-content-center">
                <h2 className="text-center mb-4" style={{ fontFamily: '"Limelight", serif' }}>
                  {mode === "login" ? "Welcome Back" : "Create Your Account"}
                </h2>

                {message && (
                  <div
                    className={`alert ${message.type === "error" ? "alert-danger" : "alert-success"} py-2`}
                    role="alert"
                  >
                    {message.text}
                  </div>
                )}

                <form
                  onSubmit={handleSubmit}
                  className="mt-3"
                  role="form"
                  aria-label={`auth-${mode}-form`}
                >
                  <div className="mb-3">
                    <label htmlFor="email" className="form-label">
                      Email
                    </label>
                    <div className="input-group">
                      <span className="input-group-text" id="email-addon">
                        <i className="fa-solid fa-envelope"></i>
                      </span>
                      <input
                        id="email"
                        type="email"
                        className="form-control"
                        aria-describedby="email-addon"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="password" className="form-label">
                      Password
                    </label>
                    <div className="input-group">
                      <span className="input-group-text" id="password-addon">
                        <i className="fa-solid fa-lock"></i>
                      </span>
                      <input
                        id="password"
                        type="password"
                        className="form-control"
                        aria-describedby="password-addon"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={loading}
                    data-testid="auth-submit"
                  >
                    {loading ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Please wait…
                      </>
                    ) : (
                      <>
                        <i
                          className={`fa-solid ${mode === "login" ? "fa-right-to-bracket" : "fa-user-plus"} me-2`}
                        ></i>
                        {mode === "login" ? "Login" : "Create Account"}
                      </>
                    )}
                  </button>

                  <div className="text-center mt-3">
                    {mode === "login" ? (
                      <span>
                        Don't have an account?{" "}
                        <button
                          type="button"
                          onClick={() => setMode("register")}
                          className="btn btn-link p-0 align-baseline"
                          data-testid="toggle-register"
                        >
                          <i className="fa-regular fa-id-card me-1"></i>
                          Register
                        </button>
                      </span>
                    ) : (
                      <span>
                        Already have an account?{" "}
                        <button
                          type="button"
                          onClick={() => setMode("login")}
                          className="btn btn-link p-0 align-baseline"
                          data-testid="toggle-login"
                        >
                          <i className="fa-solid fa-right-to-bracket me-1"></i>
                          Login
                        </button>
                      </span>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Right decorative image (hidden on small screens) */}
          <div className="col-lg-3 d-none d-lg-block">
            <div className="h-100 overflow-hidden shadow-sm">
              <img
                src="https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?q=80&w=1200&auto=format&fit=crop"
                alt="Decorative"
                className="w-100 h-100"
                style={{ objectFit: "cover" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
