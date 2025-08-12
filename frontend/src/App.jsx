import { useEffect, useRef, useState } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";

const socket = io("https://dev2gether.onrender.com");

const App = () => {
  // --- existing states (kept as-is) ---
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// start code here");
  const [copySuccess, setCopySuccess] = useState("");
  const [users, setUsers] = useState([]);
  const [typing, setTyping] = useState("");
  const [outPut, setOutPut] = useState("");
  const [version, setVersion] = useState("*");

  // --- new UI / placeholder states (non-destructive) ---
  const [editorFontSize, setEditorFontSize] = useState(14); // zoom control
  const [videoOn, setVideoOn] = useState(false); // local toggle only
  const [audioOn, setAudioOn] = useState(false); // local toggle only
  const [rightPanel, setRightPanel] = useState(null); // 'users' | 'chat' | null
  const [messages, setMessages] = useState([]); // chat messages (client)
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socket.on("userJoined", (users) => {
      setUsers(users);
    });

    socket.on("codeUpdate", (newCode) => {
      setCode(newCode);
    });

    socket.on("userTyping", (user) => {
      setTyping(`${user.slice(0, 8)}... is Typing`);
      setTimeout(() => setTyping(""), 2000);
    });

    socket.on("languageUpdate", (newLanguage) => {
      setLanguage(newLanguage);
    });

    socket.on("codeResponse", (response) => {
      setOutPut(response.run.output);
    });

    // small chat message listener (server must emit 'chatMessage' for other clients)
    socket.on("chatMessage", (msg) => {
      setMessages((p) => [...p, msg]);
    });

    return () => {
      socket.off("userJoined");
      socket.off("codeUpdate");
      socket.off("userTyping");
      socket.off("languageUpdate");
      socket.off("codeResponse");
      socket.off("chatMessage");
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      socket.emit("leaveRoom");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // --- existing functions (kept unchanged) ---
  const joinRoom = () => {
    if (roomId && userName) {
      socket.emit("join", { roomId, userName });
      setJoined(true);
    }
  };

  const leaveRoom = () => {
    socket.emit("leaveRoom");
    setJoined(false);
    setRoomId("");
    setUserName("");
    setCode("// start code here");
    setLanguage("javascript");
    setRightPanel(null);
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopySuccess("Copied!");
    setTimeout(() => setCopySuccess(""), 2000);
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    socket.emit("codeChange", { roomId, code: newCode });
    socket.emit("typing", { roomId, userName });
  };

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    socket.emit("languageChange", { roomId, language: newLanguage });
  };

  const runCode = () => {
    socket.emit("compileCode", { code, roomId, language, version });
  };

  // --- new UI helpers (safe, local) ---
  const toggleVideo = () => {
    setVideoOn((v) => !v);
    // placeholder only: do not emit or change server state here
  };

  const toggleAudio = () => {
    setAudioOn((a) => !a);
    // placeholder only
  };

  const openRightPanel = (panel) => {
    setRightPanel((p) => (p === panel ? null : panel));
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code || "");
    setCopySuccess("Code copied!");
    setTimeout(() => setCopySuccess(""), 2000);
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    const msg = {
      user: userName || "Anon",
      text: newMessage,
      time: Date.now(),
    };
    // emit to server (server must handle and broadcast 'chatMessage' for multi-user chat)
    socket.emit("chatMessage", { roomId, msg });
    // also append locally so sender sees message instantly
    setMessages((p) => [...p, msg]);
    setNewMessage("");
    // auto-scroll
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  };

  // --- simple auto scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Join form (unchanged) ---
  if (!joined) {
    return (
      <div className="join-container">
        <div className="join-form">
          <h1>Join Code Room</h1>
          <input
            type="text"
            placeholder="Room Id"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <input
            type="text"
            placeholder="Your Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <button onClick={joinRoom}>Join Room</button>
        </div>
      </div>
    );
  }

  // --- Main editor + new UI layout ---
  return (
    <div className="app-shell">
      {/* LEFT ICON SIDEBAR */}
      <aside className="icon-sidebar">
        <button
          className={`icon-btn ${videoOn ? "active" : ""}`}
          title="Toggle Video"
          onClick={toggleVideo}
        >
          {/* camera icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M2 6h12v12H2z" stroke="currentColor" strokeWidth="1.2" />
            <path d="M16 9l6-3v12l-6-3" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>

        <button
          className={`icon-btn ${audioOn ? "active" : ""}`}
          title="Toggle Audio"
          onClick={toggleAudio}
        >
          {/* mic icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z" stroke="currentColor" strokeWidth="1.2" />
            <path d="M19 11v1a7 7 0 0 1-14 0v-1" stroke="currentColor" strokeWidth="1.2" />
            <path d="M12 21v-3" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>

        <button className="icon-btn" title="Users" onClick={() => openRightPanel("users")}>
          {/* users icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M16 11a4 4 0 1 0-8 0" stroke="currentColor" strokeWidth="1.2" />
            <path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>

        <button className="icon-btn" title="Chat" onClick={() => openRightPanel("chat")}>
          {/* chat icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>

        <button className="icon-btn" title="Copy Code" onClick={copyCode}>
          {/* copy icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="9" width="11" height="11" stroke="currentColor" strokeWidth="1.2" rx="2" />
            <rect x="4" y="4" width="11" height="11" stroke="currentColor" strokeWidth="1.2" rx="2" />
          </svg>
        </button>

        <div style={{ flex: 1 }} />

        <button className="icon-btn leave" title="Leave Room" onClick={leaveRoom}>
          {/* leave icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.2" />
            <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M21 12H9" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </aside>

      {/* MAIN AREA */}
      <div className="main-area">
        {/* NAVBAR */}
        <header className="top-navbar">
          <div className="nav-left">
            <div className="brand">Dev2Gether</div>
          </div>

          <div className="nav-center">
            {/* Language selector moved to navbar */}
            <select className="nav-language" value={language} onChange={handleLanguageChange}>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
            </select>
            {copySuccess && <span className="copy-success small">{copySuccess}</span>}
          </div>

          <div className="nav-right">
            <button className="zoom-btn" onClick={() => setEditorFontSize((s) => Math.max(8, s - 1))}>
              A-
            </button>
            <button className="zoom-btn" onClick={() => setEditorFontSize((s) => Math.min(30, s + 1))}>
              A+
            </button>
          </div>
        </header>

        {/* EDITOR + RUN + OUTPUT (kept same structure as before) */}
        <div className="editor-wrapper new-layout">
          <Editor
            height={"60%"}
            defaultLanguage={language}
            language={language}
            value={code}
            onChange={handleCodeChange}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: editorFontSize,
            }}
          />
          <button className="run-btn" onClick={runCode}>
            Execute
          </button>
          <textarea
            className="output-console"
            value={outPut}
            readOnly
            placeholder="Output will appear here."
          />
        </div>
      </div>

      {/* RIGHT PANEL (slides in) */}
      <aside className={`right-panel ${rightPanel ? "open" : ""}`}>
        <div className="right-panel-header">
          <h3>{rightPanel === "users" ? "Users in Room" : "Chat"}</h3>
          <button className="close-panel" onClick={() => setRightPanel(null)}>
            ×
          </button>
        </div>

        {rightPanel === "users" && (
          <div className="panel-body">
            <ul className="users-list">
              {users.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          </div>
        )}

        {rightPanel === "chat" && (
          <div className="panel-body chat-body">
            <div className="messages">
              {messages.map((m, i) => (
                <div className="message" key={i}>
                  <strong>{m.user}: </strong>
                  <span>{m.text}</span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <button onClick={sendMessage}>Send</button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};

export default App;
