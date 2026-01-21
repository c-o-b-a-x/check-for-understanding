const socket = io();

/* =====================
   ROOM CREATION
===================== */
const createRoomBtn = document.getElementById("createRoomBtn");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const startQuizBtn = document.getElementById("startQuizBtn");
const endQuizBtn = document.getElementById("endQuizBtn");

let currentRoom = null;
window.lastQuizData = null; // store quiz data locally

createRoomBtn.addEventListener("click", () => {
  let customCode = "";
  if (!roomInput.value) {
    customCode = "CMP";
  } else {
    customCode = roomInput.value;
  }

  socket.emit("create_room", customCode, (response) => {
    if (response.error) {
      alert(response.error);
      return;
    }

    currentRoom = response.roomCode;
    socket.emit("join_room", response.roomCode);

    roomCodeDisplay.textContent = `Room Code: ${response.roomCode}`;
  });
});

/* =====================
   CREATE QUIZ FROM INPUTS
===================== */
const createQuizBtn = document.getElementById("createQuizBtn");

createQuizBtn.addEventListener("click", () => {
  if (!currentRoom) {
    alert("Create a room first!");
    return;
  }

  const quizInputs = document.querySelectorAll(".question");
  const rightAnswers = document.querySelectorAll(".Right");
  const wrongAnswers = document.querySelectorAll(".Wrong");

  const quizData = [];

  for (let i = 0; i < quizInputs.length; i++) {
    const question = quizInputs[i].value.trim();
    const rightAnswer = rightAnswers[i].value.trim();
    const wrongAnswer1 = wrongAnswers[i * 3].value.trim();
    const wrongAnswer2 = wrongAnswers[i * 3 + 1].value.trim();
    const wrongAnswer3 = wrongAnswers[i * 3 + 2].value.trim();

    if (
      question &&
      rightAnswer &&
      wrongAnswer1 &&
      wrongAnswer2 &&
      wrongAnswer3
    ) {
      quizData.push({
        question,
        right_answer: rightAnswer,
        options: [wrongAnswer1, wrongAnswer2, wrongAnswer3, rightAnswer].sort(
          () => Math.random() - 0.5,
        ),
      });
    }
  }

  if (quizData.length > 0) {
    // send to server
    socket.emit("quizDataUploaded", { roomCode: currentRoom, quizData });

    window.lastQuizData = quizData;

    document.getElementById("written").textContent = JSON.stringify(
      quizData,
      null,
      2,
    );
    alert("Quiz uploaded successfully!");
  } else {
    alert("Please fill in all fields.");
  }
});

/* =====================
   UPLOAD JSON
===================== */
const fileInput = document.getElementById("fileInput");

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      if (!currentRoom) {
        alert("Create a room first!");
        return;
      }

      const quizData = JSON.parse(reader.result);
      const quizArray = quizData.quiz || quizData;

      socket.emit("quizDataUploaded", {
        roomCode: currentRoom,
        quizData: quizArray,
      });

      window.lastQuizData = quizArray; // ✅ Store the array, not wrapper
      console.log("Quiz Data Exists");

      document.getElementById("output").textContent = JSON.stringify(
        quizArray,
        null,
        2,
      );
      alert("Quiz uploaded successfully!");
    } catch (err) {
      document.getElementById("output").textContent = "Invalid JSON file";
    }
  };
  reader.readAsText(file);
});

/* =====================
   START QUIZ
===================== */
startQuizBtn.addEventListener("click", () => {
  if (!currentRoom) {
    alert("Create a room first!");
    return;
  }

  if (!window.lastQuizData) {
    alert("Create or upload quiz before starting!");
    return;
  }

  // Ensure server has quiz data
  socket.emit("quizDataUploaded", window.lastQuizData);

  // Start the quiz
  socket.emit("start_quiz", currentRoom);
});

/* =====================
   THEME TOGGLE
===================== */
function setCookie(name, value, days = 365) {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value}; expires=${date.toUTCString()}; path=/`;
}

function getCookie(name) {
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    const [key, value] = cookie.split("=");
    if (key === name) return value;
  }
  return null;
}

function applyTheme(theme) {
  document.body.classList.remove("light", "dark");
  document.body.classList.add(theme);
}

const savedTheme = getCookie("theme") || "light";
applyTheme(savedTheme);

document.getElementById("themeToggle").onclick = () => {
  const newTheme = document.body.classList.contains("light") ? "dark" : "light";
  applyTheme(newTheme);
  setCookie("theme", newTheme);
};

/* =====================
   SOCKET EVENTS
===================== */
endQuizBtn.addEventListener("click", () => {
  try {
    socket.emit("endquiz", currentRoom);
    roomCodeDisplay.textContent = `Ending Quiz`;
    setTimeout(() => {
      roomCodeDisplay.textContent = "";
    }, 1000);
  } catch {
    alert("Not In A Room");
  }
});
socket.on("connect", () => console.log("Connected:", socket.id));
socket.on("disconnect", () => console.log("Disconnected"));
socket.on("error", (err) => console.error("Socket error:", err));

socket.on("quizStarted", (data) => {
  console.log("✅ Admin received quizStarted:", data);
});

socket.on("question", (data) => {
  console.log("✅ Admin received question:", data);
});

socket.on("room_joined", (roomCode) => {
  console.log("✅ Admin joined room:", roomCode);
});

socket.on("adminReport", (reports) => {
  console.log("Admin Report:", reports);

  let reportHTML = "<h2>Quiz Results Report</h2>";

  reports.forEach((report) => {
    reportHTML += `
      <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0;">
        <h3>${report.username} - Score: ${report.score}/${report.totalQuestions}</h3>
        ${report.questions
          .map(
            (q) => `
          <p>
            <strong>Q${q.questionNumber}:</strong> ${q.question}<br>
            <span style="color: ${q.isCorrect ? "green" : "red"}">
              ${q.isCorrect ? "✓" : "✗"} Answer: ${q.playerAnswer}
            </span>
            ${!q.isCorrect ? `<br><small>Correct: ${q.correctAnswer}</small>` : ""}
          </p>
        `,
          )
          .join("")}
      </div>
    `;
  });

  document.body.innerHTML += reportHTML;
});

hide_btn = document.getElementById("Hide");
unhide_btn = document.getElementById("unhide");

hide_btn.addEventListener("click", () => {
  document.getElementById("create").classList.add("hidden");
  unhide_btn.classList.remove("hidden");
});
unhide_btn.addEventListener("click", () => {
  document.getElementById("create").classList.remove("hidden");
  unhide_btn.classList.add("hidden");
});
