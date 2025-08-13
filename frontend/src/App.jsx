import { useEffect, useState, useMemo } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";

const socket = io("https://dev2gether.onrender.com");

const App = () => {
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

  // NEW UI state
  const [editorFontSize, setEditorFontSize] = useState(14);
  const [showRoomMenu, setShowRoomMenu] = useState(false);
  const [leftBarHidden, setLeftBarHidden] = useState(false);
  const [rightSidebar, setRightSidebar] = useState(null); // "users" | "chat" | null

  // Chat state
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");

  // Toggles (placeholders for now)
  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 1800);
  };

  // ------ SOCKET BINDINGS ------
  useEffect(() => {
    socket.on("userJoined", (users) => setUsers(users));

    socket.on("codeUpdate", (newCode) => setCode(newCode));

    socket.on("userTyping", (user) => {
      setTyping(`${user.slice(0, 8)}... is Typing`);
      setTimeout(() => setTyping(""), 2000);
    });

    socket.on("languageUpdate", (newLanguage) => setLanguage(newLanguage));

    socket.on("codeResponse", (response) => setOutPut(response.run.output));

    // 💬 robust chat payload handler (string | object)
    socket.on("chatMessage", (payload) => {
      const msg =
        typeof payload === "string"
          ? { sender: "User", text: String(payload), time: Date.now() }
          : {
              sender: payload.sender || payload.user || "User",
              text: payload.text ?? String(payload),
              time: payload.time || Date.now(),
            };
      setMessages((prev) => [...prev, msg]);
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

  // Leave room on tab close
  useEffect(() => {
    const handleBeforeUnload = () => socket.emit("leaveRoom");
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const toggleSidebar = () => {
  setIsSidebarOpen(prev => !prev);
};

  // ------ ACTIONS ------
  const joinRoom = () => {
    if (roomId && userName) {
      socket.emit("join", { roomId, userName });
      setJoined(true);
      showToast("Joined room");
    }
  };

  const leaveRoom = () => {
    socket.emit("leaveRoom");
    setJoined(false);
    setRoomId("");
    setUserName("");
    setCode("// start code here");
    setLanguage("javascript");
    setRightSidebar(null);
    showToast("Left room");
  };

  const copyRoomId = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    setCopySuccess("Copied!");
    showToast("Room ID copied");
    setTimeout(() => setCopySuccess(""), 1500);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopySuccess("Code Copied!");
    showToast("Code copied");
    setTimeout(() => setCopySuccess(""), 1500);
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

  const zoomIn = () => setEditorFontSize((s) => Math.min(s + 1, 32));
  const zoomOut = () => setEditorFontSize((s) => Math.max(s - 1, 10));

  // Chat send (also render locally so sender sees it instantly)
  const sendMessage = () => {
    const txt = chatInput.trim();
    if (!txt) return;
    const msg = { sender: userName || "Me", text: txt, time: Date.now() };
    socket.emit("chatMessage", { roomId, ...msg });
    setMessages((prev) => [...prev, msg]);
    setChatInput("");
  };

  // Derived badge count
  const usersCount = useMemo(() => users?.length || 0, [users]);

  // ----------------- RENDER -----------------
  if (!joined) {
    return (
      <div className="join-container">
        <div className="join-form animated-border">
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

  return (
    <div className="editor-container">
      {/* ░░ NAVBAR ░░ */}
      <header className="top-navbar">
        <div className="brand">Dev2Gether</div>

        <div className="nav-controls">
          {/* Language selector */}
          <select
            className="nav-language-selector"
            value={language}
            onChange={handleLanguageChange}
            title="Language"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
          </select>

          {/* Zoom */}
          <div className="zoom-controls">
            <button className="zoom-btn" onClick={zoomOut} title="Zoom Out">
              <svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 11h10v2H7z"/></svg>
            </button>
            <span className="zoom-display">{editorFontSize}px</span>
            <button className="zoom-btn" onClick={zoomIn} title="Zoom In">
              <svg viewBox="0 0 24 24"><path fill="currentColor" d="M11 7h2v10h-2zM7 11h10v2H7z"/></svg>
            </button>
          </div>

          {/* Room menu */}
          <div className="room-menu">
            <button
              className="room-menu-toggle"
              onClick={() => setShowRoomMenu((v) => !v)}
              title="Room options"
            >
              Room
            </button>
            {showRoomMenu && (
              <div className="room-menu-popover">
                <div className="room-menu-row">
                  <span className="room-menu-label">Room ID</span>
                  <span className="room-menu-id">{roomId}</span>
                </div>
                <button className="copy-button" onClick={copyRoomId}>
                  Copy ID
                </button>
                {copySuccess && <span className="copy-success">{copySuccess}</span>}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ░░ LEFT ICON RAIL ░░ */}
      {!leftBarHidden ? (
        <aside className="icon-rail">
          {/* 1. Video toggle */}
          <button
            className={`icon-btn ${videoOn ? "on" : "off"}`}
            title="Video"
            onClick={() => setVideoOn((v) => !v)}
          >
            {/* camera svg */}
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M17 10.5V7a2 2 0 0 0-2-2H5C3.9 5 3 5.9 3 7v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5l4 4v-11l-4 4z"/></svg>
          </button>

          {/* 2. Audio toggle */}
          <button
            className={`icon-btn ${audioOn ? "on" : "off"}`}
            title="Mic"
            onClick={() => setAudioOn((v) => !v)}
          >
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>
          </button>

          {/* 3. Users (opens right panel) */}
          <button
            className={`icon-btn ${rightSidebar === "users" ? "active" : ""}`}
            title="Users"
            onClick={() => setRightSidebar(rightSidebar === "users" ? null : "users")}
          >
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zM8 11c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
            {usersCount > 0 && <span className="badge">{usersCount}</span>}
          </button>

          {/* 4. Chat (opens right panel) */}
          <button
            className={`icon-btn ${rightSidebar === "chat" ? "active" : ""}`}
            title="Chat"
            onClick={() => setRightSidebar(rightSidebar === "chat" ? null : "chat")}
          >
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>
          </button>

          {/* 5. AI (toast) */}
          <button
            className="icon-btn"
            title="AI"
            onClick={() => showToast("AI assistant coming soon")}
          >
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>
          </button>

          {/* 6. Copy code */}
          <button className="icon-btn" title="Copy Code" onClick={copyCode}>
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14h13a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/></svg>
          </button>

          {/* 7. Hide left sidebar */}
          <button className="icon-btn" title="Hide toolbar" onClick={() => setLeftBarHidden(true)}>
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M14 7l-5 5 5 5V7z"/></svg>
          </button>

          {/* 8. Leave room */}
          <button className="icon-btn danger" title="Leave room" onClick={leaveRoom}>
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M10 17l5-5-5-5v10zM4 3h2v18H4z"/></svg>
          </button>
        </aside>
      ) : (
        <button className="show-rail-tab" onClick={() => setLeftBarHidden(false)} title="Show toolbar">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M10 7l5 5-5 5V7z"/></svg>
        </button>
      )}

      {/* ░░ EDITOR AREA ░░ */}
      <main className={`workspace ${rightSidebar ? "shrink" : ""}`}>
        <div className="typing-inline">{typing}</div>

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

        <button className="run-btn" onClick={runCode}>Execute</button>

        <textarea
          className="output-console"
          value={outPut}
          readOnly
          placeholder="Output will appear here."
        />
      </main>

      {/* ░░ RIGHT SIDEBAR (overlays & shrinks editor) ░░ */}
      <aside className={`right-sidebar ${rightSidebar ? "open" : ""}`}>
        {rightSidebar === "users" && (
          <div className="panel">
            <h3>Users in Room</h3>
            <ul className="users-list">
              {users.map((u, i) => (
                <li key={i}>{typeof u === "string" ? u.slice(0, 8) + "..." : String(u)}</li>
              ))}
            </ul>
          </div>
        )}

        {rightSidebar === "chat" && (
          <div className="panel chat">
            <h3>Room Chat</h3>
            <div className="chat-messages">
              {messages.map((m, i) => (
                <div className="msg" key={i}>
                  <b>{m?.sender ?? "User"}:</b> <span>{m?.text ?? String(m)}</span>
                </div>
              ))}
            </div>
            <div className="chat-input-row">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type a message and press Enter"
              />
              <button onClick={sendMessage}>Send</button>
            </div>
          </div>
        )}
      </aside>

      {/* ░░ TOAST ░░ */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
};

export default App;
