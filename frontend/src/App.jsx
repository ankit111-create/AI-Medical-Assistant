import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

function App() {
  const [mode, setMode] = useState("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [user, setUser] = useState(null);

  const [message, setMessage] = useState("");
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // =========================
  // CHECK SAVED LOGIN
  // =========================

  useEffect(() => {
    const savedUserId = localStorage.getItem("user_id");
    const savedName = localStorage.getItem("user_name");

    if (savedUserId && savedName) {
      const savedUser = {
        id: Number(savedUserId),
        name: savedName,
      };

      setUser(savedUser);
      loadHistory(Number(savedUserId));
    }
  }, []);

  // =========================
  // REGISTER
  // =========================

  const register = async () => {
    setError("");

    if (!name || !email || !password) {
      setError("Please fill all fields.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Registration failed.");
        return;
      }

      alert("Registration successful! Please login.");

      setMode("login");
      setName("");
      setPassword("");
    } catch {
      setError("Backend se connection nahi ho pa raha.");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // LOGIN
  // =========================

  const login = async () => {
    setError("");

    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Login failed.");
        return;
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user_id", data.user_id);
      localStorage.setItem("user_name", data.name);

      const loggedInUser = {
        id: data.user_id,
        name: data.name,
      };

      setUser(loggedInUser);
      setEmail("");
      setPassword("");
      setError("");

      await loadHistory(data.user_id);
    } catch {
      setError("Backend se connection nahi ho pa raha.");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // LOAD HISTORY
  // =========================

  const loadHistory = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/history/${userId}`);

      const data = await res.json();

      if (res.ok) {
        setHistory(data.history || []);
      }
    } catch {
      console.log("History load failed");
    }
  };

  // =========================
  // SEND MESSAGE
  // =========================

  const sendMessage = async () => {
    if (!message.trim() || !user || loading) {
      return;
    }

    const currentMessage = message.trim();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`${API_URL}/chat/${user.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: currentMessage,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Something went wrong.");
        setMessage(currentMessage);
        return;
      }

      await loadHistory(user.id);
    } catch {
      setError("Backend se connection nahi ho pa raha.");
      setMessage(currentMessage);
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // ENTER TO SEND
  // =========================

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  // =========================
  // NEW CHAT
  // =========================

  const newChat = () => {
    setMessage("");
    setError("");
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // =========================
  // CLEAR HISTORY
  // =========================

  const clearHistory = async () => {
    if (!user || history.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to clear your chat history?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/history/${user.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Could not clear history.");
        return;
      }

      setHistory([]);
      alert(`History cleared. Deleted chats: ${data.deleted_count}`);
    } catch {
      setError("Backend se connection nahi ho pa raha.");
    }
  };

  // =========================
  // LOGOUT
  // =========================

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_name");

    setUser(null);
    setHistory([]);
    setMessage("");
    setError("");
  };

  // =========================
  // LOGIN / REGISTER SCREEN
  // =========================

  if (!user) {
    return (
      <div className="app">
        <div className="auth-container">
          <div className="auth-card">
            <div className="logo">🩺</div>

            <h1>AI Medical Assistant</h1>

            <p className="subtitle">
              Your personal AI health information assistant
            </p>

            {mode === "register" && (
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  mode === "login" ? login() : register();
                }
              }}
            />

            {error && <div className="error">{error}</div>}

            <button
              className="primary-button"
              onClick={mode === "login" ? login : register}
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "Login"
                : "Create Account"}
            </button>

            <div className="switch-mode">
              {mode === "login" ? (
                <>
                  Don't have an account?{" "}
                  <button onClick={() => setMode("register")}>
                    Register
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button onClick={() => setMode("login")}>
                    Login
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================
  // CHAT SCREEN
  // =========================

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>🩺 AI Medical Assistant</h1>
          <p>Welcome, {user.name}</p>
        </div>

        <div className="header-actions">
          <button className="new-chat-button" onClick={newChat}>
            + New Chat
          </button>

          <button className="logout-button" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main className="chat-container">
        {history.length === 0 && (
          <div className="welcome">
            <div className="welcome-icon">🩺</div>

            <h2>Hello, {user.name} 👋</h2>

            <p>
              How can I help you today? Describe your symptoms or ask a
              general health-related question.
            </p>
          </div>
        )}

        <div className="messages">
          {history.map((chat, index) => (
            <div className="chat-group" key={index}>
              <div className="message user-bubble">
                <div className="avatar">👤</div>

                <div className="message-content">
                  <strong>You</strong>
                  <p>{chat.user}</p>
                </div>
              </div>

              <div className="message assistant-bubble">
                <div className="avatar">🤖</div>

                <div className="message-content">
                  <strong>AI Medical Assistant</strong>
                  <ReactMarkdown>
                   {chat.assistant}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="message assistant-bubble">
              <div className="avatar">🤖</div>

              <div className="message-content">
                <strong>AI Medical Assistant</strong>

                <div className="typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && <div className="error">{error}</div>}

        <div className="input-area">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message AI Medical Assistant..."
            rows="3"
          />

          <div className="input-footer">
            <span>Press Enter to send • Shift + Enter for new line</span>

            <button
              className="send-button"
              onClick={sendMessage}
              disabled={loading || !message.trim()}
            >
              {loading ? "..." : "Send ➤"}
            </button>
          </div>
        </div>

        <div className="history-footer">
          <button
            className="clear-button"
            onClick={clearHistory}
            disabled={history.length === 0}
          >
            🗑️ Clear History
          </button>
        </div>

        <p className="medical-disclaimer">
          ⚠️ This AI provides general health information and is not a
          substitute for professional medical advice.
        </p>
      </main>
    </div>
  );
}

export default App;